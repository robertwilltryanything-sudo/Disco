
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
const LAST_SYNC_HASH_KEY = 'disco_last_sync_hash';

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
  const [lastSyncHash, setLastSyncHash] = useState<string | null>(() => localStorage.getItem(LAST_SYNC_HASH_KEY));

  const fileIdRef = useRef<string | null>(null);
  const scriptsInitiatedRef = useRef(false);

  const clearAuthState = useCallback(() => {
    if (window.gapi?.client) {
      window.gapi.client.setToken(null);
    }
    localStorage.removeItem(SIGNED_IN_KEY);
    localStorage.removeItem(LAST_SYNC_TIME_KEY);
    localStorage.removeItem(LAST_SYNC_HASH_KEY);
    setIsSignedIn(false);
    fileIdRef.current = null;
    setSyncStatus('idle');
    setLastSyncTime(null);
    setLastSyncHash(null);
  }, []);

  const handleApiError = useCallback((e: any, context: string) => {
    const errorDetails = e?.result?.error || e?.error;
    const errorCode = errorDetails?.code;
    
    console.error(`Google Drive API Error (${context}):`, e);

    if (errorCode === 401) {
      clearAuthState();
      setError("Session expired. Please sign in again.");
      setSyncStatus('error');
    } else {
      setError(`Sync error: ${errorDetails?.message || 'Check your connection'}`);
      setSyncStatus('error');
    }
  }, [clearAuthState]);

  const initializeGis = useCallback(() => {
    if (!GOOGLE_CLIENT_ID) return;
    try {
      window.tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GOOGLE_DRIVE_SCOPES,
        callback: (tokenResponse: any) => {
          if (tokenResponse && tokenResponse.access_token) {
            setIsSignedIn(true);
            setSyncStatus('idle');
            setError(null);
            localStorage.setItem(SIGNED_IN_KEY, 'true');
          } else if (tokenResponse && tokenResponse.error) {
            setError(`Login failed: ${tokenResponse.error_description || tokenResponse.error}`);
            setSyncStatus('error');
          } else {
            setSyncStatus('idle');
          }
        },
      });
      setIsApiReady(true);
      
      // Attempt silent reconnect if previously signed in
      if (localStorage.getItem(SIGNED_IN_KEY) === 'true') {
        try {
          window.tokenClient.requestAccessToken({ prompt: '' });
        } catch (e) {
          console.warn("Silent re-auth failed, waiting for user gesture.");
          localStorage.removeItem(SIGNED_IN_KEY);
        }
      }
    } catch (e) {
      console.error("GIS Init Error:", e);
    }
  }, []);

  const initializeGapi = useCallback(async () => {
    try {
      await window.gapi.client.init({
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
      });
      initializeGis();
    } catch (e) {
      console.error("GAPI Init Error:", e);
    }
  }, [initializeGis]);

  useEffect(() => {
    if (scriptsInitiatedRef.current || !GOOGLE_CLIENT_ID) return;
    scriptsInitiatedRef.current = true;

    const loadScripts = () => {
      const gapiScript = document.createElement('script');
      gapiScript.src = 'https://apis.google.com/js/api.js';
      gapiScript.onload = () => window.gapi.load('client', initializeGapi);
      document.body.appendChild(gapiScript);

      const gisScript = document.createElement('script');
      gisScript.src = 'https://accounts.google.com/gsi/client';
      document.body.appendChild(gisScript);
    };

    loadScripts();
  }, [initializeGapi]);

  const signIn = useCallback(() => {
    if (!window.tokenClient) {
      setError("Sync system not ready. Please refresh.");
      return;
    }
    setSyncStatus('authenticating');
    setError(null);
    window.tokenClient.requestAccessToken({ prompt: 'select_account' });
  }, []);

  const resetSyncStatus = useCallback(() => {
    setSyncStatus('idle');
    setError(null);
  }, []);

  const getOrCreateFileId = useCallback(async () => {
    if (fileIdRef.current) return fileIdRef.current;
    
    const response = await window.gapi.client.drive.files.list({
      q: `name='${COLLECTION_FILENAME}' and trashed=false`,
      spaces: 'drive',
      fields: 'files(id, modifiedTime)',
      orderBy: 'modifiedTime desc'
    });
    
    if (response.result.files.length > 0) {
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

  const checkRemoteUpdate = useCallback(async (): Promise<boolean> => {
    if (!isSignedIn) return false;
    try {
      const id = await getOrCreateFileId();
      const metadata = await window.gapi.client.drive.files.get({ 
        fileId: id, 
        fields: 'modifiedTime' 
      });
      const remoteTime = new Date(metadata.result.modifiedTime).getTime();
      const localTime = lastSyncTime ? new Date(lastSyncTime).getTime() : 0;
      // Use a larger tolerance for mobile devices with potential clock drift
      return remoteTime > (localTime + 5000);
    } catch (e) {
      return false;
    }
  }, [isSignedIn, getOrCreateFileId, lastSyncTime]);

  const loadData = useCallback(async (): Promise<UnifiedStorage | null> => {
    if (!isSignedIn) return null;
    setSyncStatus('loading');
    try {
      const id = await getOrCreateFileId();
      
      // Use standard request for the body to ensure we can add cache-busters
      const response = await window.gapi.client.request({
        path: `/drive/v3/files/${id}`,
        method: 'GET',
        params: { alt: 'media', t: Date.now() } // Cache buster
      });
      
      const metadata = await window.gapi.client.drive.files.get({ 
        fileId: id, 
        fields: 'modifiedTime' 
      });

      const data = typeof response.body === 'string' ? JSON.parse(response.body) : response.result;
      const normalizedData = Array.isArray(data) 
        ? { collection: data, wantlist: [], lastUpdated: metadata.result.modifiedTime } 
        : { collection: data.collection || [], wantlist: data.wantlist || [], lastUpdated: metadata.result.modifiedTime };

      const time = metadata.result.modifiedTime;
      const hash = JSON.stringify({ collection: normalizedData.collection, wantlist: normalizedData.wantlist });
      
      setLastSyncTime(time);
      setLastSyncHash(hash);
      localStorage.setItem(LAST_SYNC_TIME_KEY, time);
      localStorage.setItem(LAST_SYNC_HASH_KEY, hash);
      
      setSyncStatus('synced');
      return normalizedData as UnifiedStorage;
    } catch (e: any) {
      handleApiError(e, 'load data');
      return null;
    }
  }, [isSignedIn, getOrCreateFileId, handleApiError]);

  const saveData = useCallback(async (data: UnifiedStorage) => {
    if (!isSignedIn || syncStatus === 'loading' || syncStatus === 'saving') return;
    
    const currentHash = JSON.stringify({ collection: data.collection, wantlist: data.wantlist });
    if (currentHash === lastSyncHash) {
        setSyncStatus('synced');
        return;
    }

    setSyncStatus('saving');
    try {
      const id = await getOrCreateFileId();
      await window.gapi.client.request({
        path: `/upload/drive/v3/files/${id}`,
        method: 'PATCH',
        params: { uploadType: 'media' },
        body: JSON.stringify(data),
      });
      
      const metadata = await window.gapi.client.drive.files.get({ fileId: id, fields: 'modifiedTime' });
      const time = metadata.result.modifiedTime;
      
      setLastSyncTime(time);
      setLastSyncHash(currentHash);
      localStorage.setItem(LAST_SYNC_TIME_KEY, time);
      localStorage.setItem(LAST_SYNC_HASH_KEY, currentHash);
      
      setSyncStatus('synced');
    } catch (e: any) {
      handleApiError(e, 'save data');
    }
  }, [isSignedIn, getOrCreateFileId, handleApiError, syncStatus, lastSyncHash]);

  const getRevisions = useCallback(async (): Promise<DriveRevision[]> => {
    if (!isSignedIn) return [];
    try {
      const id = await getOrCreateFileId();
      const response = await window.gapi.client.drive.revisions.list({ fileId: id, fields: 'revisions(id, modifiedTime)' });
      return response.result.revisions || [];
    } catch (e) {
      return [];
    }
  }, [isSignedIn, getOrCreateFileId]);

  const loadRevision = useCallback(async (revisionId: string): Promise<UnifiedStorage | null> => {
    if (!isSignedIn) return null;
    setSyncStatus('loading');
    try {
      const id = await getOrCreateFileId();
      const response = await window.gapi.client.drive.revisions.get({ fileId: id, revisionId, alt: 'media' });
      const data = typeof response.body === 'string' ? JSON.parse(response.body) : response.result;
      setSyncStatus('synced');
      return Array.isArray(data) ? { collection: data, wantlist: [], lastUpdated: new Date().toISOString() } : (data as UnifiedStorage);
    } catch (e) {
      handleApiError(e, 'load revision');
      return null;
    }
  }, [isSignedIn, getOrCreateFileId, handleApiError]);

  const signOut = useCallback(() => {
    const token = window.gapi?.client?.getToken();
    if (token && window.google?.accounts?.oauth2) {
      window.google.accounts.oauth2.revoke(token.access_token, () => clearAuthState());
    } else {
      clearAuthState();
    }
  }, [clearAuthState]);

  return useMemo(() => ({ 
    isApiReady, isSignedIn, signIn, signOut, loadData, saveData, checkRemoteUpdate,
    getRevisions, loadRevision, syncStatus, error, lastSyncTime, lastSyncHash, resetSyncStatus
  }), [isApiReady, isSignedIn, signIn, signOut, loadData, saveData, checkRemoteUpdate, getRevisions, loadRevision, syncStatus, error, lastSyncTime, lastSyncHash, resetSyncStatus]);
};
