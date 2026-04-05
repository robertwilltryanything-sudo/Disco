import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { GOOGLE_CLIENT_ID, GOOGLE_DRIVE_SCOPES, COLLECTION_FILENAME } from '../googleConfig';
import { CD, WantlistItem, DriveRevision, SyncStatus } from '../types';

export interface UnifiedStorage {
    collection: CD[];
    wantlist: WantlistItem[];
    lastUpdated: string;
}

export interface DriveFile {
  id: string;
  name: string;
  thumbnailLink?: string;
  mimeType: string;
}

const SIGNED_IN_KEY = 'disco_drive_signed_in';
const LAST_SYNC_TIME_KEY = 'disco_last_sync_time';
const AUTH_TIMEOUT_MS = 30000; // Reduced to 30s for better responsiveness
const INIT_TIMEOUT_MS = 8000;  // 8s for internal GAPI steps

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

  const loadScript = (src: string, globalCheck: string, forceReload = false): Promise<void> => {
    return new Promise((resolve, reject) => {
      const parts = globalCheck.split('.');
      const checkExists = () => {
        let current: any = window;
        for (const part of parts) {
          if (!current || !current[part]) return false;
          current = current[part];
        }
        return true;
      };
      
      if (checkExists() && !forceReload) return resolve();

      // Check if script already exists in DOM (ignoring query params)
      const baseUrl = src.split('?')[0];
      const existingScript = document.querySelector(`script[src^="${baseUrl}"]`);
      
      if (existingScript && forceReload) {
        existingScript.remove();
      } else if (existingScript && !forceReload) {
        // If it exists but globalCheck failed, it might still be loading or failed
        let attempts = 0;
        const interval = setInterval(() => {
          if (checkExists()) {
            clearInterval(interval);
            resolve();
          } else if (attempts >= 50) { // 5 seconds
            clearInterval(interval);
            resolve(); // Fallback
          }
          attempts++;
        }, 100);
        return;
      }

      const script = document.createElement('script');
      script.src = forceReload ? `${src}${src.includes('?') ? '&' : '?'}_t=${Date.now()}` : src;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        let attempts = 0;
        const interval = setInterval(() => {
          if (checkExists()) {
            clearInterval(interval);
            resolve();
          } else if (attempts >= 30) { // 3 seconds
            clearInterval(interval);
            resolve(); 
          }
          attempts++;
        }, 100);
      };
      script.onerror = () => {
        reject(new Error(`The script at ${src} was blocked or failed to load.`));
      };
      document.body.appendChild(script);
    });
  };

  const initializeSync = useCallback(async (retryCount = 0, force = false, skipAutoRefresh = false) => {
    if (!GOOGLE_CLIENT_ID || (initStartedRef.current && retryCount === 0 && !force)) return;
    initStartedRef.current = true;
    
    try {
      setError(null);
      await Promise.all([
        loadScript('https://apis.google.com/js/api.js', 'gapi', force || retryCount > 0),
        loadScript('https://accounts.google.com/gsi/client', 'google.accounts.oauth2', force || retryCount > 0)
      ]);
      
      await new Promise<void>((resolve, reject) => {
        if (!window.gapi) return reject(new Error("GAPI library missing"));
        const timeout = setTimeout(() => reject(new Error("Timeout loading GAPI client")), INIT_TIMEOUT_MS);
        window.gapi.load('client', {
          callback: () => {
            clearTimeout(timeout);
            resolve();
          },
          onerror: () => {
            clearTimeout(timeout);
            reject(new Error("Failed to load Google API client component"));
          }
        });
      });
      
      const initTimeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("GAPI client init timed out")), INIT_TIMEOUT_MS)
      );

      await Promise.race([
        window.gapi.client.init({
          discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
        }),
        initTimeout
      ]);

      // Small delay to ensure GIS is fully settled after script load
      await new Promise(resolve => setTimeout(resolve, 500));

      if (!window.google?.accounts?.oauth2) {
        throw new Error("Google Identity Services failed to initialize.");
      }

      window.tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GOOGLE_DRIVE_SCOPES,
        callback: (tokenResponse: any) => {
          console.log("Google Auth Callback received:", tokenResponse?.error || "success");
          if (authTimeoutRef.current) {
            window.clearTimeout(authTimeoutRef.current);
            authTimeoutRef.current = null;
          }
          
          if (tokenResponse && tokenResponse.access_token) {
            window.gapi.client.setToken(tokenResponse);
            setIsSignedIn(true);
            updateSyncStatus('idle');
            setError(null);
            localStorage.setItem(SIGNED_IN_KEY, 'true');
          } else if (tokenResponse && tokenResponse.error) {
            // Handle specific errors like 'popup_closed_by_user'
            if (tokenResponse.error === 'popup_closed_by_user') {
              setError("Sign-in cancelled. Please try again.");
              updateSyncStatus('idle');
            } else {
              handleApiError(tokenResponse, 'auth_callback');
            }
          } else {
            updateSyncStatus('idle');
          }
        },
      });

      setIsApiReady(true);

      if (localStorage.getItem(SIGNED_IN_KEY) === 'true' && !skipAutoRefresh) {
        // Silent refresh with a safety timeout to prevent hanging the init process
        const silentRefreshTimeout = setTimeout(() => {
          console.warn("Silent refresh taking too long, proceeding to ready state.");
          // We don't reject here, just let the app be ready so the user can click sign-in if needed
        }, 5000);

        window.tokenClient.requestAccessToken({ 
          prompt: '',
          // The callback is already defined in initTokenClient, but we can wrap it or just rely on it
          // GIS will call the main callback. We just want to ensure we don't block.
        });
        
        // We don't 'await' the token request here to avoid blocking the UI
        clearTimeout(silentRefreshTimeout);
      }
    } catch (e: any) {
      console.error(`Sync Initialization Failed (Attempt ${retryCount + 1}):`, e);
      
      if (retryCount < 1) {
        console.log("Retrying initialization...");
        await new Promise(resolve => setTimeout(resolve, 1000));
        initStartedRef.current = false;
        return initializeSync(retryCount + 1, force, skipAutoRefresh);
      }

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
      setError("Google Auth is still initializing. Please wait a moment and try again.");
      return;
    }

    updateSyncStatus('authenticating');
    setError(null);

    if (authTimeoutRef.current) window.clearTimeout(authTimeoutRef.current);
    authTimeoutRef.current = window.setTimeout(() => {
      if (syncStatusRef.current === 'authenticating') {
        console.warn("Google Auth Timeout reached");
        updateSyncStatus('idle');
        setError("Sign-in is taking longer than expected. Please check if a popup window is hidden behind your browser or blocked by a popup blocker.");
      }
    }, AUTH_TIMEOUT_MS);

    try {
      // Direct call without 'await' to ensure browser treats it as a user-initiated action
      window.tokenClient.requestAccessToken({ prompt: 'select_account' });
    } catch (e) {
      console.error("Error triggering requestAccessToken:", e);
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

  const fetchDriveImages = useCallback(async (pageToken?: string): Promise<{files: DriveFile[], nextPageToken?: string}> => {
    if (!isSignedIn) return { files: [] };
    try {
      const response = await window.gapi.client.drive.files.list({
        q: "mimeType contains 'image/' and trashed = false",
        fields: 'nextPageToken, files(id, name, thumbnailLink, mimeType)',
        pageSize: 40,
        pageToken: pageToken
      });
      return {
        files: response.result.files || [],
        nextPageToken: response.result.nextPageToken
      };
    } catch (e) {
      handleApiError(e, 'fetch_images');
      return { files: [] };
    }
  }, [isSignedIn, handleApiError]);

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
    getRevisions, loadRevision, syncStatus, error, lastSyncTime, resetSyncStatus, fetchDriveImages
  }), [isApiReady, isSignedIn, signIn, signOut, loadData, saveData, getRevisions, loadRevision, syncStatus, error, lastSyncTime, resetSyncStatus, fetchDriveImages]);
};