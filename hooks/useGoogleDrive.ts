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
const AUTH_TIMEOUT_MS = 60000;

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
    const message = errorResult?.message || "Unknown error occurred";

    if (errorCode === 401 || errorCode === 403) {
      if (message.toLowerCase().includes('origin')) {
          setError("Authorized Origin Mismatch. Ensure this URL is in your Google Console settings.");
      } else {
          clearAuthState();
          setError("Auth session invalid. Please sign in again.");
      }
      updateSyncStatus('error');
    } else {
      setError(`Sync error (${context}): ${message}`);
      updateSyncStatus('error');
    }
  }, [clearAuthState, updateSyncStatus]);

  const loadScript = (src: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
          // If script exists, check if global objects are ready, otherwise wait a bit
          const checkReady = () => {
              if (src.includes('api.js') && window.gapi) return true;
              if (src.includes('client') && window.google?.accounts) return true;
              return false;
          };
          if (checkReady()) return resolve();
      }

      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.body.appendChild(script);
    });
  };

  const initializeSync = useCallback(async () => {
    if (!GOOGLE_CLIENT_ID) {
        console.log("Google Sync: No Client ID provided, skipping init.");
        return;
    }
    
    try {
      console.log("Google Sync: Loading scripts...");
      // 1. Load GAPI
      await loadScript('https://apis.google.com/js/api.js');
      await new Promise<void>((resolve) => window.gapi.load('client', resolve));
      
      // 2. Initialize GAPI Client
      await window.gapi.client.init({
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
      });

      // 3. Load GIS
      await loadScript('https://accounts.google.com/gsi/client');

      // 4. Initialize Token Client
      if (!window.google?.accounts?.oauth2) {
          throw new Error("Google Identity Services not fully loaded.");
      }

      window.tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GOOGLE_DRIVE_SCOPES,
        callback: (tokenResponse: any) => {
          console.log("Google Sync: Token response received");
          if (authTimeoutRef.current) window.clearTimeout(authTimeoutRef.current);
          
          if (tokenResponse && tokenResponse.access_token) {
            setIsSignedIn(true);
            updateSyncStatus('idle');
            setError(null);
            localStorage.setItem(SIGNED_IN_KEY, 'true');
          } else if (tokenResponse && tokenResponse.error) {
            console.error("Google Sync: GIS Token Error:", tokenResponse.error);
            setError(`Login failed: ${tokenResponse.error_description || tokenResponse.error}`);
            updateSyncStatus('error');
          } else {
            console.log("Google Sync: Login popup closed or cancelled");
            updateSyncStatus('idle');
          }
        },
      });

      console.log("Google Sync: API ready.");
      setIsApiReady(true);

      // 5. Silent refresh if previously signed in
      if (localStorage.getItem(SIGNED_IN_KEY) === 'true') {
        window.tokenClient.requestAccessToken({ prompt: '' });
      }
    } catch (e: any) {
      console.error("Google Sync: Initialization Failed:", e);
      setError("Cloud sync components failed to load. Check your connection.");
      updateSyncStatus('error');
    }
  }, [updateSyncStatus]);

  useEffect(() => {
    if (scriptsLoadingRef.current) return;
    scriptsLoadingRef.current = true;
    initializeSync();
    
    return () => { 
      if (authTimeoutRef.current) window.clearTimeout(authTimeoutRef.current); 
    };
  }, [initializeSync]);

  const signIn = useCallback(() => {
    if (!window.tokenClient) {
      setError("The sync system is still initializing. Please wait.");
      return;
    }

    updateSyncStatus('authenticating');
    setError(null);

    if (authTimeoutRef.current) window.clearTimeout(authTimeoutRef.current);
    authTimeoutRef.current = window.setTimeout(() => {
      if (syncStatusRef.current === 'authenticating') {
        console.warn("Google Sync: Auth timeout reached");
        updateSyncStatus('idle');
        setError("Authentication timed out. If no popup appeared, check your popup blocker.");
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
      
      if (!body || (typeof body === 'string' && body.trim() === '')) {
          data = { collection: [], wantlist: [], lastUpdated: '' };
      } else {
          try {
              data = typeof body === 'string' ? JSON.parse(body) : body;
          } catch (pErr) {
              console.error("Google Sync: JSON Parse error on cloud body:", pErr);
              data = { collection: [], wantlist: [], lastUpdated: '' };
          }
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
      
      const response = await window.gapi.client.request({
        path: `/upload/drive/v3/files/${id}`,
        method: 'PATCH',
        params: { uploadType: 'media' },
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data),
      });

      if (response.status >= 400) {
          throw response;
      }

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
      if (!response.body || (typeof response.body === 'string' && response.body.trim() === '')) {
          data = { collection: [], wantlist: [], lastUpdated: '' };
      } else {
          data = typeof response.body === 'string' ? JSON.parse(response.body) : response.result;
      }
      
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