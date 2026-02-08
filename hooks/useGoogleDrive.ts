import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { GOOGLE_CLIENT_ID, GOOGLE_DRIVE_SCOPES, COLLECTION_FILENAME } from '../googleConfig';
import { CD, WantlistItem, DriveRevision, SyncStatus } from '../types';

export interface UnifiedStorage {
    collection: CD[];
    wantlist: WantlistItem[];
    lastUpdated: string;
}

const SIGNED_IN_KEY = 'disco_drive_signed_in';
const LAST_SYNC_TIME_KEY = 'disco_last_sync_time';
const AUTH_TIMEOUT_MS = 30000;

declare global {
  interface Window {
    gapi: any;
    google: any;
    tokenClient: any;
  }
}

export const useGoogleDrive = () => {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isApiReady, setIsApiReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => localStorage.getItem(LAST_SYNC_TIME_KEY));

  const fileIdRef = useRef<string | null>(null);
  const scriptsLoadingRef = useRef(false);
  const authTimeoutRef = useRef<number | null>(null);
  const syncStatusRef = useRef<SyncStatus>('idle');
  
  const updateSyncStatus = useCallback((newStatus: SyncStatus) => {
    syncStatusRef.current = newStatus;
    setSyncStatus(newStatus);
  }, []);

  const clearAuthState = useCallback(() => {
    if (window.gapi?.client) {
      window.gapi.client.setToken(null);
    }
    localStorage.removeItem(SIGNED_IN_KEY);
    localStorage.removeItem(LAST_SYNC_TIME_KEY);
    setIsSignedIn(false);
    fileIdRef.current = null;
    updateSyncStatus('idle');
    setLastSyncTime(null);
  }, [updateSyncStatus]);

  const handleApiError = useCallback((e: any, context: string) => {
    console.error(`Google Drive API Error (${context}):`, e);
    
    const errorResult = e?.result?.error || e?.error || e;
    const errorCode = errorResult?.code || e?.status;
    const message = errorResult?.message || (typeof e === 'string' ? e : "Unknown error occurred");

    if (errorCode === 401 || errorCode === 403 || message.includes('invalid_grant')) {
      if (message.toLowerCase().includes('origin')) {
          setError("Check Authorized JavaScript Origins in Google Console.");
      } else {
          clearAuthState();
          setError("Auth session expired. Please sign in again.");
      }
      updateSyncStatus('error');
    } else {
      setError(`Sync error (${context}): ${message}`);
      updateSyncStatus('error');
    }
  }, [clearAuthState, updateSyncStatus]);

  const loadScript = (src: string, checkGlobal: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const parts = checkGlobal.split('.');
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
      script.onload = () => setTimeout(() => resolve(), 150);
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.body.appendChild(script);
    });
  };

  const initializeSync = useCallback(async () => {
    if (!GOOGLE_CLIENT_ID) {
        console.warn("Google Sync: No Client ID provided.");
        return;
    }
    
    try {
      // 1. Load GAPI (Google API Client Library)
      await loadScript('https://apis.google.com/js/api.js', 'gapi');
      
      // 2. Initialize GAPI Client
      await new Promise<void>((resolve, reject) => {
          window.gapi.load('client', { callback: resolve, onerror: reject });
      });
      
      await window.gapi.client.init({
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
      });

      // 3. Load GIS (Google Identity Services)
      await loadScript('https://accounts.google.com/gsi/client', 'google.accounts.oauth2');

      // 4. Initialize Token Client
      window.tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GOOGLE_DRIVE_SCOPES,
        callback: (tokenResponse: any) => {
          if (authTimeoutRef.current) window.clearTimeout(authTimeoutRef.current);
          
          if (tokenResponse && tokenResponse.access_token) {
            console.log("Google Sync: Permission granted.");
            // CRITICAL: Bridge token from GIS to GAPI
            window.gapi.client.setToken(tokenResponse);
            
            setIsSignedIn(true);
            updateSyncStatus('idle');
            setError(null);
            localStorage.setItem(SIGNED_IN_KEY, 'true');
          } else if (tokenResponse && tokenResponse.error) {
            handleApiError(tokenResponse, 'token callback');
          } else {
            updateSyncStatus('idle');
          }
        },
      });

      setIsApiReady(true);

      // 5. Auto-reconnect if previously used
      if (localStorage.getItem(SIGNED_IN_KEY) === 'true') {
        window.tokenClient.requestAccessToken({ prompt: '' });
      }
    } catch (e: any) {
      console.error("Google Sync Init Failed:", e);
      setError("Sync system failed to initialize. Refresh the page.");
      updateSyncStatus('error');
    }
  }, [updateSyncStatus, handleApiError]);

  useEffect(() => {
    if (scriptsLoadingRef.current) return;
    scriptsLoadingRef.current = true;
    initializeSync();
    return () => { if (authTimeoutRef.current) window.clearTimeout(authTimeoutRef.current); };
  }, [initializeSync]);

  const signIn = useCallback(() => {
    if (!window.tokenClient) {
      setError("Initializing... try again in 2 seconds.");
      return;
    }
    updateSyncStatus('authenticating');
    setError(null);

    if (authTimeoutRef.current) window.clearTimeout(authTimeoutRef.current);
    authTimeoutRef.current = window.setTimeout(() => {
      if (syncStatusRef.current === 'authenticating') {
        updateSyncStatus('idle');
        setError("Sign-in timed out. Check for popup blockers.");
      }
    }, AUTH_TIMEOUT_MS);

    try {
      window.tokenClient.requestAccessToken({ prompt: 'select_account' });
    } catch (e) {
      handleApiError(e, 'request access');
    }
  }, [updateSyncStatus, handleApiError]);

  const resetSyncStatus = useCallback(() => {
    updateSyncStatus('idle');
    setError(null);
  }, [updateSyncStatus]);

  const getOrCreateFileId = useCallback(async () => {
    if (fileIdRef.current) return fileIdRef.current;
    
    const response = await window.gapi.client.drive.files.list({
      q: `name='${COLLECTION_FILENAME}' and trashed=false`,
      spaces: 'drive',
      fields: 'files(id)',
    });
    
    if (response.result.files && response.result.files.length > 0) {
      fileIdRef.current = response.result.files[0].id;
      return fileIdRef.current;
    } else {
      const createResponse = await window.gapi.client.drive.files.create({
        resource: { name: COLLECTION_FILENAME, mimeType: 'application/json' },
        fields: 'id',
      });
      fileIdRef.current = createResponse.result.id;
      return fileIdRef.current;
    }
  }, []);

  const loadData = useCallback(async (): Promise<UnifiedStorage | null> => {
    if (!isSignedIn) return null;
    updateSyncStatus('loading');
    try {
      const id = await getOrCreateFileId();
      const response = await window.gapi.client.request({
        path: `/drive/v3/files/${id}`,
        method: 'GET',
        params: { alt: 'media', t: Date.now() }
      });

      let data = response.result;
      if (typeof data === 'string' && data.trim()) {
          data = JSON.parse(data);
      }

      const metadata = await window.gapi.client.drive.files.get({ fileId: id, fields: 'modifiedTime' });
      const normalizedData = {
          collection: (Array.isArray(data) ? data : data.collection) || [],
          wantlist: (data.wantlist) || [],
          lastUpdated: metadata.result.modifiedTime || new Date().toISOString()
      };

      const time = metadata.result.modifiedTime || new Date().toISOString();
      setLastSyncTime(time);
      localStorage.setItem(LAST_SYNC_TIME_KEY, time);
      updateSyncStatus('synced');
      return normalizedData as UnifiedStorage;
    } catch (e: any) {
      handleApiError(e, 'load data');
      return null;
    }
  }, [isSignedIn, getOrCreateFileId, handleApiError, updateSyncStatus]);

  const saveData = useCallback(async (data: UnifiedStorage) => {
    if (!isSignedIn) return;
    updateSyncStatus('saving');
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
      updateSyncStatus('synced');
    } catch (e: any) {
      handleApiError(e, 'save data');
    }
  }, [isSignedIn, getOrCreateFileId, handleApiError, updateSyncStatus]);

  const getRevisions = useCallback(async (): Promise<DriveRevision[]> => {
    if (!isSignedIn) return [];
    try {
      const id = await getOrCreateFileId();
      const response = await window.gapi.client.drive.revisions.list({ fileId: id, fields: 'revisions(id, modifiedTime)' });
      return response.result.revisions || [];
    } catch (e) { return []; }
  }, [isSignedIn, getOrCreateFileId]);

  const loadRevision = useCallback(async (revisionId: string): Promise<UnifiedStorage | null> => {
    if (!isSignedIn) return null;
    updateSyncStatus('loading');
    try {
      const id = await getOrCreateFileId();
      const response = await window.gapi.client.revisions.get({ fileId: id, revisionId, alt: 'media' });
      const data = typeof response.body === 'string' ? JSON.parse(response.body) : response.result;
      updateSyncStatus('synced');
      return Array.isArray(data) ? { collection: data, wantlist: [], lastUpdated: new Date().toISOString() } : (data as UnifiedStorage);
    } catch (e) {
      handleApiError(e, 'load revision');
      return null;
    }
  }, [isSignedIn, getOrCreateFileId, handleApiError, updateSyncStatus]);

  const signOut = useCallback(() => {
    const token = window.gapi?.client?.getToken();
    if (token && window.google?.accounts?.oauth2) {
      window.google.accounts.oauth2.revoke(token.access_token, () => clearAuthState());
    } else { clearAuthState(); }
  }, [clearAuthState]);

  return useMemo(() => ({ 
    isApiReady, isSignedIn, signIn, signOut, loadData, saveData,
    getRevisions, loadRevision, syncStatus, error, lastSyncTime, resetSyncStatus
  }), [isApiReady, isSignedIn, signIn, signOut, loadData, saveData, getRevisions, loadRevision, syncStatus, error, lastSyncTime, resetSyncStatus]);
};