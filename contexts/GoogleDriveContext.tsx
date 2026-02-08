import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { GOOGLE_CLIENT_ID, GOOGLE_DRIVE_SCOPES, COLLECTION_FILENAME } from '../googleConfig';
import { CD, WantlistItem, DriveRevision, SyncStatus } from '../types';

// Extend the global Window interface to include properties added by Google scripts
declare global {
  interface Window {
    gapi: any;
    google: any;
    tokenClient: any;
  }
}

export interface UnifiedStorage {
    collection: CD[];
    wantlist: WantlistItem[];
    lastUpdated: string;
}

export interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
    thumbnailLink?: string;
    iconLink?: string;
}

interface GoogleDriveContextType {
    isApiReady: boolean;
    isSignedIn: boolean;
    syncStatus: SyncStatus;
    error: string | null;
    lastSyncTime: string | null;
    signIn: () => void;
    signOut: () => void;
    loadData: () => Promise<UnifiedStorage | null>;
    saveData: (data: UnifiedStorage) => Promise<void>;
    getRevisions: () => Promise<DriveRevision[]>;
    loadRevision: (revisionId: string) => Promise<UnifiedStorage | null>;
    resetSyncStatus: () => void;
    searchDriveFiles: (folderId?: string, query?: string) => Promise<DriveFile[]>;
}

const GoogleDriveContext = createContext<GoogleDriveContextType | undefined>(undefined);

const SIGNED_IN_KEY = 'disco_drive_signed_in';
const LAST_SYNC_TIME_KEY = 'disco_last_sync_time';
const AUTH_TIMEOUT_MS = 30000;

export const GoogleDriveProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isApiReady, setIsApiReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => localStorage.getItem(LAST_SYNC_TIME_KEY));

  const fileIdRef = useRef<string | null>(null);
  const authTimeoutRef = useRef<number | null>(null);
  const initStartedRef = useRef(false);

  const clearAuthState = useCallback(() => {
    if (window.gapi?.client) {
      window.gapi.client.setToken(null);
    }
    localStorage.removeItem(SIGNED_IN_KEY);
    localStorage.removeItem(LAST_SYNC_TIME_KEY);
    setIsSignedIn(false);
    fileIdRef.current = null;
    setSyncStatus('idle');
    setLastSyncTime(null);
  }, []);

  const handleApiError = useCallback((e: any, context: string) => {
    console.error(`Google Drive API Error (${context}):`, e);
    const errorResult = e?.result?.error || e?.error || e;
    const errorCode = errorResult?.code || e?.status;
    const message = errorResult?.message || (typeof e === 'string' ? e : "Sync operation failed.");

    if (errorCode === 401 || errorCode === 403 || message.includes('invalid_grant')) {
      clearAuthState();
      setError("Session expired. Please sign in again.");
      setSyncStatus('idle');
    } else if (message.toLowerCase().includes('origin')) {
      setError("Origin Mismatch: This URL is not authorized in your Google Cloud Console.");
      setSyncStatus('error');
    } else {
      setError(`Sync error: ${message}`);
      setSyncStatus('error');
    }
  }, [clearAuthState]);

  const loadScript = (src: string, globalCheck: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const parts = globalCheck.split('.');
      let current: any = window;
      let exists = true;
      for (const part of parts) {
        if (!current[part]) {
          exists = false;
          break;
        }
        current = current[part];
      }
      if (exists) return resolve();

      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.defer = true;
      script.onload = () => setTimeout(() => resolve(), 200);
      script.onerror = () => reject(new Error(`The script at ${src} was blocked. Check your ad-blocker.`));
      document.body.appendChild(script);
    });
  };

  const initializeSync = useCallback(async () => {
    if (!GOOGLE_CLIENT_ID || initStartedRef.current) return;
    initStartedRef.current = true;
    
    try {
      setError(null);
      await Promise.all([
        loadScript('https://apis.google.com/js/api.js', 'gapi'),
        loadScript('https://accounts.google.com/gsi/client', 'google.accounts.oauth2')
      ]);
      
      await new Promise<void>((resolve, reject) => {
        if (!window.gapi) return reject(new Error("GAPI library missing"));
        window.gapi.load('client', {
          callback: resolve,
          onerror: () => reject(new Error("Failed to load Google API client"))
        });
      });
      
      await window.gapi.client.init({
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
      });

      window.tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GOOGLE_DRIVE_SCOPES,
        callback: (tokenResponse: any) => {
          if (authTimeoutRef.current) window.clearTimeout(authTimeoutRef.current);
          if (tokenResponse && tokenResponse.access_token) {
            window.gapi.client.setToken(tokenResponse);
            setIsSignedIn(true);
            setSyncStatus('idle');
            setError(null);
            localStorage.setItem(SIGNED_IN_KEY, 'true');
          } else {
            setSyncStatus('idle');
          }
        },
      });

      setIsApiReady(true);
      if (localStorage.getItem(SIGNED_IN_KEY) === 'true') {
        window.tokenClient.requestAccessToken({ prompt: '' });
      }
    } catch (e: any) {
      initStartedRef.current = false;
      setError(e.message || "Google infrastructure failed to load.");
      setSyncStatus('error');
    }
  }, []);

  useEffect(() => {
    initializeSync();
  }, [initializeSync]);

  const signIn = useCallback(() => {
    if (!window.tokenClient) return;
    setSyncStatus('authenticating');
    setError(null);
    if (authTimeoutRef.current) window.clearTimeout(authTimeoutRef.current);
    authTimeoutRef.current = window.setTimeout(() => {
      setSyncStatus('idle');
      setError("Sign-in timed out. Check for popup blockers.");
    }, AUTH_TIMEOUT_MS);
    window.tokenClient.requestAccessToken({ prompt: 'select_account' });
  }, []);

  const signOut = useCallback(() => {
    const token = window.gapi?.client?.getToken();
    if (token && window.google?.accounts?.oauth2) {
      window.google.accounts.oauth2.revoke(token.access_token, () => clearAuthState());
    } else { 
      clearAuthState(); 
    }
  }, [clearAuthState]);

  const getOrCreateFileId = useCallback(async () => {
    if (fileIdRef.current) return fileIdRef.current;
    const response = await window.gapi.client.drive.files.list({
      q: `name='${COLLECTION_FILENAME}' and trashed=false`,
      spaces: 'drive',
      fields: 'files(id)',
    });
    if (response.result.files?.[0]) {
      fileIdRef.current = response.result.files[0].id;
      return fileIdRef.current;
    }
    const createResponse = await window.gapi.client.drive.files.create({
      resource: { name: COLLECTION_FILENAME, mimeType: 'application/json' },
      fields: 'id',
    });
    fileIdRef.current = createResponse.result.id;
    return fileIdRef.current;
  }, []);

  const loadData = useCallback(async () => {
    setSyncStatus('loading');
    try {
      const id = await getOrCreateFileId();
      const response = await window.gapi.client.request({
        path: `/drive/v3/files/${id}`,
        method: 'GET',
        params: { alt: 'media', t: Date.now() }
      });
      let data = response.result;
      if (typeof data === 'string' && data.trim()) data = JSON.parse(data);
      const metadata = await window.gapi.client.drive.files.get({ fileId: id, fields: 'modifiedTime' });
      const time = metadata.result.modifiedTime || new Date().toISOString();
      setLastSyncTime(time);
      localStorage.setItem(LAST_SYNC_TIME_KEY, time);
      setSyncStatus('synced');
      return {
        collection: (Array.isArray(data) ? data : data.collection) || [],
        wantlist: (data.wantlist) || [],
        lastUpdated: time
      };
    } catch (e) {
      handleApiError(e, 'load_data');
      return null;
    }
  }, [getOrCreateFileId, handleApiError]);

  const saveData = useCallback(async (data: UnifiedStorage) => {
    setSyncStatus('saving');
    try {
      const id = await getOrCreateFileId();
      await window.gapi.client.request({
        path: `/upload/drive/v3/files/${id}`,
        method: 'PATCH',
        params: { uploadType: 'media' },
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const metadata = await window.gapi.client.drive.files.get({ fileId: id, fields: 'modifiedTime' });
      const time = metadata.result.modifiedTime || new Date().toISOString();
      setLastSyncTime(time);
      localStorage.setItem(LAST_SYNC_TIME_KEY, time);
      setSyncStatus('synced');
    } catch (e) {
      handleApiError(e, 'save_data');
    }
  }, [getOrCreateFileId, handleApiError]);

  const searchDriveFiles = useCallback(async (folderId: string = 'root', query: string = '') => {
    if (!isSignedIn) return [];
    try {
      let q = `'${folderId}' in parents and trashed = false`;
      if (query) q = `name contains '${query}' and trashed = false`;
      const response = await window.gapi.client.drive.files.list({
        q: query ? q : `${q} and (mimeType = 'application/vnd.google-apps.folder' or mimeType contains 'image/')`,
        fields: 'files(id, name, mimeType, thumbnailLink, iconLink)',
        orderBy: 'folder, name',
        pageSize: 100
      });
      return response.result.files || [];
    } catch (e) {
      console.error("Search Drive error:", e);
      return [];
    }
  }, [isSignedIn]);

  const getRevisions = useCallback(async () => {
    const id = await getOrCreateFileId();
    const response = await window.gapi.client.drive.revisions.list({ fileId: id, fields: 'revisions(id, modifiedTime)' });
    return response.result.revisions || [];
  }, [getOrCreateFileId]);

  const loadRevision = useCallback(async (revisionId: string) => {
    setSyncStatus('loading');
    try {
      const id = await getOrCreateFileId();
      const response = await window.gapi.client.revisions.get({ fileId: id, revisionId, alt: 'media' });
      const data = typeof response.body === 'string' ? JSON.parse(response.body) : response.result;
      setSyncStatus('synced');
      return Array.isArray(data) ? { collection: data, wantlist: [], lastUpdated: new Date().toISOString() } : (data as UnifiedStorage);
    } catch (e) {
      handleApiError(e, 'load_revision');
      return null;
    }
  }, [getOrCreateFileId, handleApiError]);

  const value = useMemo(() => ({
    isApiReady, isSignedIn, syncStatus, error, lastSyncTime,
    signIn, signOut, loadData, saveData, getRevisions, loadRevision,
    resetSyncStatus: () => { initStartedRef.current = false; initializeSync(); },
    searchDriveFiles
  }), [isApiReady, isSignedIn, syncStatus, error, lastSyncTime, signIn, signOut, loadData, saveData, getRevisions, loadRevision, initializeSync, searchDriveFiles]);

  return <GoogleDriveContext.Provider value={value}>{children}</GoogleDriveContext.Provider>;
};

export const useGoogleDriveContext = () => {
  const context = useContext(GoogleDriveContext);
  if (context === undefined) throw new Error('useGoogleDriveContext must be used within a GoogleDriveProvider');
  return context;
};