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
  const authTimeoutRef = useRef<number | null>(null);
  const lastSyncHashRef = useRef<string | null>(localStorage.getItem(LAST_SYNC_HASH_KEY));
  
  const syncStatusRef = useRef<SyncStatus>('idle');
  
  const updateSyncStatus = useCallback((newStatus: SyncStatus) => {
    if (syncStatusRef.current !== newStatus) {
      syncStatusRef.current = newStatus;
      setSyncStatus(newStatus);
    }
  }, []);

  const clearAuthState = useCallback(() => {
    if (window.gapi?.client) {
      window.gapi.client.setToken(null);
    }
    localStorage.removeItem(SIGNED_IN_KEY);
    localStorage.removeItem(LAST_SYNC_TIME_KEY);
    localStorage.removeItem(LAST_SYNC_HASH_KEY);
    setIsSignedIn(false);
    fileIdRef.current = null;
    updateSyncStatus('idle');
    setLastSyncTime(null);
    setLastSyncHash(null);
    lastSyncHashRef.current = null;
  }, [updateSyncStatus]);

  const handleApiError = useCallback((e: any, context: string) => {
    const errorDetails = e?.result?.error || e?.error;
    const errorCode = errorDetails?.code;
    
    console.error(`Google Drive API Error (${context}):`, e);

    if (errorCode === 401) {
      clearAuthState();
      setError("Session expired. Please sign in again.");
      updateSyncStatus('error');
    } else {
      setError(`Sync error: ${errorDetails?.message || 'Check your connection'}`);
      updateSyncStatus('error');
    }
  }, [clearAuthState, updateSyncStatus]);

  const initializeGis = useCallback(() => {
    if (!GOOGLE_CLIENT_ID || !window.google?.accounts?.oauth2) return false;
    // Prevent double initialization
    if (window.tokenClient) {
        setIsApiReady(true);
        return true;
    }

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
          } else if (tokenResponse && (tokenResponse.error || tokenResponse.error_description)) {
            console.error("GIS Auth Error:", tokenResponse);
            setError(`Sign-in failed: ${tokenResponse.error_description || tokenResponse.error || 'User cancelled'}`);
            updateSyncStatus('error');
          } else {
            // Likely user closed the window without finishing
            updateSyncStatus('idle');
          }
        },
      });
      setIsApiReady(true);
      
      // Attempt silent refresh if we previously had a session
      if (localStorage.getItem(SIGNED_IN_KEY) === 'true') {
        try {
          window.tokenClient.requestAccessToken({ prompt: '' });
        } catch (e) {
          console.warn("Silent token refresh skipped or failed.");
        }
      }
      return true;
    } catch (e) {
      console.error("GIS Init Error:", e);
      return false;
    }
  }, [updateSyncStatus]);

  const initializeGapi = useCallback(async () => {
    if (!window.gapi) return;
    try {
      await window.gapi.client.init({
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
      });
      // GAPI is ready, but we still need GIS
      if (window.google?.accounts?.oauth2) {
        initializeGis();
      }
    } catch (e) {
      console.error("GAPI Init Error:", e);
      setError("Failed to initialize Google Drive client library.");
    }
  }, [initializeGis]);

  useEffect(() => {
    if (scriptsInitiatedRef.current || !GOOGLE_CLIENT_ID) return;
    scriptsInitiatedRef.current = true;

    const loadScript = (src: string, id: string): Promise<void> => {
        return new Promise((resolve, reject) => {
            if (document.getElementById(id)) return resolve();
            const script = document.createElement('script');
            script.src = src;
            script.id = id;
            script.async = true;
            script.defer = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load ${src}`));
            document.body.appendChild(script);
        });
    };

    const initAll = async () => {
        try {
            // Load scripts sequentially to avoid some browser race conditions
            await loadScript('https://apis.google.com/js/api.js', 'gapi-script');
            await loadScript('https://accounts.google.com/gsi/client', 'gis-script');
            
            // Initialization for GAPI
            if (window.gapi) {
                window.gapi.load('client', initializeGapi);
            }
            
            // Polling interval for GIS availability (as back-stop)
            const checkGisInterval = setInterval(() => {
                if (window.google?.accounts?.oauth2 && window.gapi?.client?.drive) {
                    const success = initializeGis();
                    if (success) clearInterval(checkGisInterval);
                }
            }, 1000);
            
            // Give up polling after 15 seconds
            setTimeout(() => clearInterval(checkGisInterval), 15000);

        } catch (e) {
            console.error("Script load error:", e);
            setError("Google Drive libraries failed to load. Please check your internet connection or ad-blocker.");
        }
    };

    initAll();
    
    return () => {
        if (authTimeoutRef.current) window.clearTimeout(authTimeoutRef.current);
    };
  }, [initializeGapi, initializeGis]);

  const signIn = useCallback(() => {
    // Check for blocking conditions
    if (!window.google?.accounts?.oauth2) {
        setError("Sign-in security library is still loading. Please wait a few seconds and try again.");
        return;
    }

    if (!window.tokenClient) {
      const success = initializeGis();
      if (!success) {
        setError("Could not initialize the sign-in window. Please try refreshing the page.");
        return;
      }
    }

    updateSyncStatus('authenticating');
    setError(null);
    
    // Auth Timeout
    if (authTimeoutRef.current) window.clearTimeout(authTimeoutRef.current);
    authTimeoutRef.current = window.setTimeout(() => {
        if (syncStatusRef.current === 'authenticating') {
            updateSyncStatus('idle');
            setError('Sign-in timed out. Please look for a "Pop-up blocked" icon in your browser address bar and enable pop-ups for this site.');
        }
    }, 45000); // 45s is safer for mobile/slow networks

    try {
        window.tokenClient.requestAccessToken({ prompt: 'select_account' });
    } catch (e) {
        console.error("Token request error:", e);
        updateSyncStatus('error');
        setError("Could not open the sign-in window. This is usually due to a pop-up blocker.");
    }
  }, [updateSyncStatus, initializeGis]);

  const resetSyncStatus = useCallback(() => {
    updateSyncStatus('idle');
    setError(null);
    if (authTimeoutRef.current) window.clearTimeout(authTimeoutRef.current);
  }, [updateSyncStatus]);

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
      
      const response = await window.gapi.client.request({
        path: `/drive/v3/files/${id}`,
        method: 'GET',
        params: { fields: 'modifiedTime', t: Date.now() },
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
      });
      
      const remoteTime = new Date(response.result.modifiedTime).getTime();
      const localTime = localStorage.getItem(LAST_SYNC_TIME_KEY) ? new Date(localStorage.getItem(LAST_SYNC_TIME_KEY)!).getTime() : 0;
      
      return remoteTime > (localTime + 1000);
    } catch (e) {
      return false;
    }
  }, [isSignedIn, getOrCreateFileId]);

  const loadData = useCallback(async (): Promise<UnifiedStorage | null> => {
    if (!isSignedIn) return null;
    updateSyncStatus('loading');
    try {
      const id = await getOrCreateFileId();
      
      const response = await window.gapi.client.request({
        path: `/drive/v3/files/${id}`,
        method: 'GET',
        params: { alt: 'media', t: Date.now() },
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
      });
      
      const metadata = await window.gapi.client.request({
        path: `/drive/v3/files/${id}`,
        method: 'GET',
        params: { fields: 'modifiedTime', t: Date.now() }
      });

      const data = typeof response.body === 'string' ? JSON.parse(response.body) : response.result;
      const normalizedData = {
          collection: data.collection || [],
          wantlist: data.wantlist || [],
          lastUpdated: metadata.result.modifiedTime
      };

      const time = metadata.result.modifiedTime;
      const hash = JSON.stringify({ collection: normalizedData.collection, wantlist: normalizedData.wantlist });
      
      setLastSyncTime(time);
      setLastSyncHash(hash);
      lastSyncHashRef.current = hash;
      localStorage.setItem(LAST_SYNC_TIME_KEY, time);
      localStorage.setItem(LAST_SYNC_HASH_KEY, hash);
      
      updateSyncStatus('synced');
      return normalizedData as UnifiedStorage;
    } catch (e: any) {
      handleApiError(e, 'load data');
      return null;
    }
  }, [isSignedIn, getOrCreateFileId, handleApiError, updateSyncStatus]);

  const saveData = useCallback(async (data: UnifiedStorage) => {
    if (!isSignedIn || syncStatusRef.current === 'loading' || syncStatusRef.current === 'saving') return;
    
    const currentHash = JSON.stringify({ collection: data.collection, wantlist: data.wantlist });
    if (currentHash === lastSyncHashRef.current) {
        if (syncStatusRef.current !== 'synced') updateSyncStatus('synced');
        return;
    }

    updateSyncStatus('saving');
    try {
      const id = await getOrCreateFileId();
      const remoteChanged = await checkRemoteUpdate();
      
      if (remoteChanged) {
          updateSyncStatus('error');
          setError("Cloud updates detected. Please refresh to avoid overwriting changes.");
          return;
      }

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
      lastSyncHashRef.current = currentHash;
      localStorage.setItem(LAST_SYNC_TIME_KEY, time);
      localStorage.setItem(LAST_SYNC_HASH_KEY, currentHash);
      
      updateSyncStatus('synced');
    } catch (e: any) {
      handleApiError(e, 'save data');
    }
  }, [isSignedIn, getOrCreateFileId, handleApiError, checkRemoteUpdate, updateSyncStatus]);

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
      const response = await window.gapi.client.drive.revisions.get({ fileId: id, revisionId, alt: 'media' });
      const data = typeof response.body === 'string' ? JSON.parse(response.body) : response.result;
      updateSyncStatus('synced');
      return { 
          collection: data.collection || [], 
          wantlist: data.wantlist || [], 
          lastUpdated: new Date().toISOString() 
      };
    } catch (e) {
      handleApiError(e, 'load revision');
      return null;
    }
  }, [isSignedIn, getOrCreateFileId, handleApiError, updateSyncStatus]);

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
