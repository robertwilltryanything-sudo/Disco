
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { GOOGLE_CLIENT_ID, GOOGLE_DRIVE_SCOPES, COLLECTION_FILENAME } from '../googleConfig';
import { CD, WantlistItem, DriveRevision, SyncStatus } from '../types';

export interface UnifiedStorage {
    collection: CD[];
    wantlist: WantlistItem[];
    sort_exceptions?: string[];
    lastUpdated: string;
}

const SIGNED_IN_KEY = 'disco_drive_signed_in';
const LAST_SYNC_TIME_KEY = 'disco_last_sync_time';

// Check if running as an iOS standalone Home Screen app
const isIOSStandalone = () => {
    return (
        (window.navigator as any).standalone || 
        window.matchMedia('(display-mode: standalone)').matches
    );
};

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
  const scriptsInitiatedRef = useRef(false);
  const authTimeoutRef = useRef<number | null>(null);
  const syncStatusRef = useRef<SyncStatus>('idle');
  const isStandalone = useMemo(() => isIOSStandalone(), []);
  
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
    const message = errorResult?.message || "Unknown error occurred";

    if (errorCode === 401 || errorCode === 403) {
      if (message.toLowerCase().includes('origin')) {
          setError("Domain mismatch. Ensure this URL is authorized in Google Console.");
      } else {
          clearAuthState();
          if (isStandalone) {
              setError("Authentication failed. iOS Home Screen apps often block Google sign-in. Try using the app in Safari if problems persist.");
          } else {
              setError("Session expired or unauthorized. Please sign in again.");
          }
      }
      updateSyncStatus('error');
    } else {
      setError(`Sync error (${context}): ${message}`);
      updateSyncStatus('error');
    }
  }, [clearAuthState, updateSyncStatus, isStandalone]);

  const initializeGis = useCallback(() => {
    if (!GOOGLE_CLIENT_ID) return;
    try {
      window.tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GOOGLE_DRIVE_SCOPES,
        callback: (tokenResponse: any) => {
          if (authTimeoutRef.current) window.clearTimeout(authTimeoutRef.current);
          if (tokenResponse && tokenResponse.access_token) {
            setIsSignedIn(true);
            updateSyncStatus('idle');
            setError(null);
            localStorage.setItem(SIGNED_IN_KEY, 'true');
          } else if (tokenResponse && tokenResponse.error) {
            let errorMsg = tokenResponse.error_description || tokenResponse.error;
            if (isStandalone && tokenResponse.error === 'popup_closed_by_user') {
                errorMsg = "The sign-in window was closed. On iPhone Home Screen, you must complete sign-in immediately without switching apps.";
            }
            setError(`Login failed: ${errorMsg}`);
            updateSyncStatus('error');
          } else {
            updateSyncStatus('idle');
          }
        },
      });
      setIsApiReady(true);
      
      // Standalone PWAs have high failure rates for silent (prompt: '') token acquisition
      // due to ITP. We skip the silent attempt if in standalone mode to avoid loops.
      if (!isStandalone && localStorage.getItem(SIGNED_IN_KEY) === 'true') {
        try {
          window.tokenClient.requestAccessToken({ prompt: '' });
        } catch (e) {
          localStorage.removeItem(SIGNED_IN_KEY);
        }
      }
    } catch (e) {
      console.error("GIS Init Error:", e);
    }
  }, [updateSyncStatus, isStandalone]);

  const initializeGapi = useCallback(async () => {
    try {
      await window.gapi.client.init({
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
      });
      initializeGis();
    } catch (e) {
      console.error("GAPI Error:", e);
    }
  }, [initializeGis]);

  useEffect(() => {
    if (scriptsInitiatedRef.current || !GOOGLE_CLIENT_ID) return;
    scriptsInitiatedRef.current = true;
    const gapiScript = document.createElement('script');
    gapiScript.src = 'https://apis.google.com/js/api.js';
    gapiScript.onload = () => window.gapi.load('client', initializeGapi);
    document.body.appendChild(gapiScript);
    const gisScript = document.createElement('script');
    gisScript.src = 'https://accounts.google.com/gsi/client';
    document.body.appendChild(gisScript);
    return () => { if (authTimeoutRef.current) window.clearTimeout(authTimeoutRef.current); };
  }, [initializeGapi]);

  const signIn = useCallback(() => {
    if (!window.tokenClient) {
      setError("Sync system not ready. Please refresh.");
      return;
    }
    updateSyncStatus('authenticating');
    setError(null);
    window.tokenClient.requestAccessToken({ prompt: 'select_account' });
  }, [updateSyncStatus]);

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

  const loadData = useCallback(async (): Promise<UnifiedStorage | null> => {
    if (!isSignedIn) return null;
    updateSyncStatus('loading');
    try {
      const id = await getOrCreateFileId();
      const response = await window.gapi.client.request({
        path: `/drive/v3/files/${id}`,
        method: 'GET',
        params: { alt: 'media', t: Date.now() },
        headers: { 'Cache-Control': 'no-cache' }
      });

      let data: any = null;
      const body = response.body;
      
      if (!body || body.trim() === '') {
          data = { collection: [], wantlist: [], sort_exceptions: [], lastUpdated: '' };
      } else {
          try {
              data = typeof body === 'string' ? JSON.parse(body) : body;
          } catch (pErr) {
              console.error("JSON Parse error:", pErr);
              data = { collection: [], wantlist: [], sort_exceptions: [], lastUpdated: '' };
          }
      }

      const metadata = await window.gapi.client.drive.files.get({ fileId: id, fields: 'modifiedTime' });
      
      const normalizedData = {
          collection: (Array.isArray(data) ? data : data.collection) || [],
          wantlist: (data.wantlist) || [],
          sort_exceptions: (data.sort_exceptions) || [],
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
      const response = await window.gapi.client.request({
        path: `/upload/drive/v3/files/${id}`,
        method: 'PATCH',
        params: { uploadType: 'media' },
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (response.status >= 400) throw response;

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
      
      let data: any = null;
      if (!response.body || response.body.trim() === '') {
          data = { collection: [], wantlist: [], sort_exceptions: [], lastUpdated: '' };
      } else {
          data = typeof response.body === 'string' ? JSON.parse(response.body) : response.result;
      }
      
      updateSyncStatus('synced');
      return Array.isArray(data) 
        ? { collection: data, wantlist: [], sort_exceptions: [], lastUpdated: new Date().toISOString() } 
        : (data as UnifiedStorage);
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
    getRevisions, loadRevision, syncStatus, error, lastSyncTime, resetSyncStatus,
    isStandalone
  }), [isApiReady, isSignedIn, signIn, signOut, loadData, saveData, getRevisions, loadRevision, syncStatus, error, lastSyncTime, resetSyncStatus, isStandalone]);
};
