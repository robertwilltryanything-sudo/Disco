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
  const authTimeoutRef = useRef<number | null>(null);
  const syncStatusRef = useRef<SyncStatus>('idle');
  const initStartedRef = useRef(false);
  
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
    const message = errorResult?.message || (typeof e === 'string' ? e : "Sync operation failed.");

    if (errorCode === 401 || errorCode === 403 || message.includes('invalid_grant')) {
      clearAuthState();
      setError("Session expired. Please sign in again.");
      updateSyncStatus('idle');
    } else if (message.toLowerCase().includes('origin')) {
      setError("Origin Mismatch: This URL is not authorized in your Google Cloud Console.");
      updateSyncStatus('error');
    } else {
      setError(`Sync error: ${message}`);
      updateSyncStatus('error');
    }
  }, [clearAuthState, updateSyncStatus]);

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
      script.onload = () => {
        setTimeout(() => resolve(), 200);
      };
      script.onerror = () => {
        reject(new Error(`The script at ${src} was blocked.`));
      };
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
          onerror: () => reject(new Error("Failed to load Google API client component"))
        });
      });
      
      await window.gapi.client.init({
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
      });

      if (!window.google?.accounts?.oauth2) {
        throw new Error("Google Identity Services failed to initialize.");
      }

      window.tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GOOGLE_DRIVE_SCOPES,
        callback: (tokenResponse: any) => {
          if (authTimeoutRef.current) window.clearTimeout(authTimeoutRef.current);
          
          if (tokenResponse && tokenResponse.access_token) {
            window.gapi.client.setToken(tokenResponse);
            setIsSignedIn(true);
            updateSyncStatus('idle');
            setError(null);
            localStorage.setItem(SIGNED_IN_KEY, 'true');
          } else if (tokenResponse && tokenResponse.error) {
            handleApiError(tokenResponse, 'auth_callback');
          } else {
            updateSyncStatus('idle');
          }
        },
      });

      setIsApiReady(true);

      if (localStorage.getItem(SIGNED_IN_KEY) === 'true') {
        window.tokenClient.requestAccessToken({ prompt: '' });
      }
    } catch (e: any) {
      console.error("Sync Initialization Failed:", e);
      initStartedRef.current = false;
      const errorMsg = e.message || "Google infrastructure failed to load.";
      setError(`${errorMsg} Please check your connection.`);
      updateSyncStatus('error');
    }
  }, [updateSyncStatus, handleApiError]);

  useEffect(() => {
    initializeSync();
    return () => { 
      if (authTimeoutRef.current) window.clearTimeout(authTimeoutRef.current); 
    };
  }, [initializeSync]);

  const signIn = useCallback(() => {
    if (!window.tokenClient) {
      setError("Authentication system is not ready.");
      return;
    }
    updateSyncStatus('authenticating');
    setError(null);

    if (authTimeoutRef.current) window.clearTimeout(authTimeoutRef.current);
    authTimeoutRef.current = window.setTimeout(() => {
      if (syncStatusRef.current === 'authenticating') {
        updateSyncStatus('idle');
        setError("Sign-in timed out. Check for blocked popups.");
      }
    }, AUTH_TIMEOUT_MS);

    try {
      window.tokenClient.requestAccessToken({ prompt: 'select_account' });
    } catch (e) {
      handleApiError(e, 'signin_trigger');
    }
  }, [updateSyncStatus, handleApiError]);

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
      if (typeof data === 'string' && data.trim()) data = JSON.parse(data);
      const metadata = await window.gapi.client.drive.files.get({ fileId: id, fields: 'modifiedTime' });
      const normalizedData = {
          collection: (Array.isArray(data) ? data : data.collection) || [],
          wantlist: (data.wantlist) || [],
          lastUpdated: metadata.result.modifiedTime || new Date().toISOString()
      };
      setLastSyncTime(metadata.result.modifiedTime || new Date().toISOString());
      updateSyncStatus('synced');
      return normalizedData as UnifiedStorage;
    } catch (e: any) {
      handleApiError(e, 'load_data');
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
      setLastSyncTime(metadata.result.modifiedTime || new Date().toISOString());
      updateSyncStatus('synced');
    } catch (e: any) {
      handleApiError(e, 'save_data');
    }
  }, [isSignedIn, getOrCreateFileId, handleApiError, updateSyncStatus]);

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
    updateSyncStatus('loading');
    try {
      const id = await getOrCreateFileId();
      const response = await window.gapi.client.revisions.get({ fileId: id, revisionId, alt: 'media' });
      const data = typeof response.body === 'string' ? JSON.parse(response.body) : response.result;
      const metadata = await window.gapi.client.drive.revisions.get({ fileId: id, revisionId, fields: 'modifiedTime' });
      updateSyncStatus('synced');
      return Array.isArray(data) ? { collection: data, wantlist: [], lastUpdated: metadata.result.modifiedTime || new Date().toISOString() } : (data as UnifiedStorage);
    } catch (e) {
      handleApiError(e, 'load_revision');
      return null;
    }
  }, [isSignedIn, getOrCreateFileId, handleApiError, updateSyncStatus]);

  const pickImage = useCallback((): Promise<string | null> => {
    return new Promise((resolve) => {
      if (!isSignedIn || !window.google || !window.gapi) {
        resolve(null);
        return;
      }

      window.gapi.load('picker', () => {
        const token = window.gapi.client.getToken()?.access_token;
        if (!token) { resolve(null); return; }

        const view = new window.google.picker.DocsView(window.google.picker.ViewId.DOCS_IMAGES);
        view.setMode(window.google.picker.DocsViewMode.GRID);

        const picker = new window.google.picker.PickerBuilder()
          .addView(view)
          .setOAuthToken(token)
          .setDeveloperKey(process.env.API_KEY)
          .setCallback((data: any) => {
            if (data.action === window.google.picker.Action.PICKED) {
              const fileId = data.docs[0].id;
              resolve(`https://lh3.googleusercontent.com/u/0/d/${fileId}`);
            } else if (data.action === window.google.picker.Action.CANCEL) {
              resolve(null);
            }
          })
          .setTitle('Select Album Artwork')
          .build();
        picker.setVisible(true);
      });
    });
  }, [isSignedIn]);

  const signOut = useCallback(() => {
    const token = window.gapi?.client?.getToken();
    if (token && window.google?.accounts?.oauth2) {
      window.google.accounts.oauth2.revoke(token.access_token, () => clearAuthState());
    } else { 
      clearAuthState(); 
    }
  }, [clearAuthState]);

  const resetSyncStatus = useCallback(() => {
    initStartedRef.current = false;
    updateSyncStatus('idle');
    setError(null);
    initializeSync(); 
  }, [updateSyncStatus, initializeSync]);

  return useMemo(() => ({ 
    isApiReady, isSignedIn, signIn, signOut, loadData, saveData,
    getRevisions, loadRevision, syncStatus, error, lastSyncTime, resetSyncStatus, pickImage
  }), [isApiReady, isSignedIn, signIn, signOut, loadData, saveData, getRevisions, loadRevision, syncStatus, error, lastSyncTime, resetSyncStatus, pickImage]);
};