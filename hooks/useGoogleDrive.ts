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
const AUTH_TIMEOUT_MS = 30000; 

declare global {
  interface Window {
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

  const accessTokenRef = useRef<string | null>(null);
  const fileIdRef = useRef<string | null>(null);
  const authTimeoutRef = useRef<number | null>(null);
  const syncStatusRef = useRef<SyncStatus>('idle');
  const initStartedRef = useRef(false);
  
  const updateSyncStatus = useCallback((newStatus: SyncStatus) => {
    syncStatusRef.current = newStatus;
    setSyncStatus(newStatus);
  }, []);

  const clearAuthState = useCallback(() => {
    accessTokenRef.current = null;
    localStorage.removeItem(SIGNED_IN_KEY);
    localStorage.removeItem(LAST_SYNC_TIME_KEY);
    setIsSignedIn(false);
    fileIdRef.current = null;
    updateSyncStatus('idle');
    setLastSyncTime(null);
  }, [updateSyncStatus]);

  const handleApiError = useCallback((e: any, context: string) => {
    console.error(`Google Drive API Error (${context}):`, e);
    
    const message = e?.message || (typeof e === 'string' ? e : "Sync operation failed.");
    const status = e?.status;

    if (status === 401 || status === 403 || message.includes('invalid_grant')) {
      clearAuthState();
      setError("Session expired. Please sign in again.");
      updateSyncStatus('idle');
    } else {
      setError(`Sync error: ${message}`);
      updateSyncStatus('error');
    }
  }, [clearAuthState, updateSyncStatus]);

  const driveApiFetch = useCallback(async (path: string, options: RequestInit = {}) => {
    if (!accessTokenRef.current) throw new Error("Not authenticated");
    
    const url = path.startsWith('http') ? path : `https://www.googleapis.com${path}`;
    const headers = new Headers(options.headers || {});
    headers.set('Authorization', `Bearer ${accessTokenRef.current}`);
    
    const response = await fetch(url, { ...options, headers });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const error = new Error(errorData.error?.message || response.statusText) as any;
      error.status = response.status;
      throw error;
    }
    
    if (response.status === 204) return null;
    return response.json();
  }, []);

  const initializeSync = useCallback(async (retryCount = 0) => {
    if (!GOOGLE_CLIENT_ID || (initStartedRef.current && retryCount === 0)) return;
    initStartedRef.current = true;
    
    try {
      setError(null);
      
      // Load only the GIS script (much faster than GAPI)
      if (!window.google?.accounts?.oauth2) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://accounts.google.com/gsi/client';
          script.async = true;
          script.defer = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Failed to load Google Identity Services"));
          document.body.appendChild(script);
        });
      }

      window.tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GOOGLE_DRIVE_SCOPES,
        callback: (tokenResponse: any) => {
          if (authTimeoutRef.current) {
            window.clearTimeout(authTimeoutRef.current);
            authTimeoutRef.current = null;
          }
          
          if (tokenResponse && tokenResponse.access_token) {
            accessTokenRef.current = tokenResponse.access_token;
            setIsSignedIn(true);
            updateSyncStatus('idle');
            setError(null);
            localStorage.setItem(SIGNED_IN_KEY, 'true');
          } else if (tokenResponse && tokenResponse.error) {
            if (tokenResponse.error === 'popup_closed_by_user') {
              setError("Sign-in cancelled. Please try again.");
              updateSyncStatus('idle');
            } else {
              handleApiError(tokenResponse, 'auth_callback');
            }
          }
        },
      });

      setIsApiReady(true);

      // Silent refresh if previously signed in
      if (localStorage.getItem(SIGNED_IN_KEY) === 'true') {
        window.tokenClient.requestAccessToken({ prompt: '' });
      }
    } catch (e: any) {
      console.error(`Sync Initialization Failed:`, e);
      initStartedRef.current = false;
      setError("Google services failed to load. Please check your connection.");
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
      setError("Google Auth is still initializing. Please wait a moment.");
      return;
    }

    updateSyncStatus('authenticating');
    setError(null);

    if (authTimeoutRef.current) window.clearTimeout(authTimeoutRef.current);
    authTimeoutRef.current = window.setTimeout(() => {
      if (syncStatusRef.current === 'authenticating') {
        updateSyncStatus('idle');
        setError("Sign-in timed out. Please check for blocked popups.");
      }
    }, AUTH_TIMEOUT_MS);

    window.tokenClient.requestAccessToken({ prompt: 'select_account' });
  }, [updateSyncStatus]);

  const getOrCreateFileId = useCallback(async () => {
    if (fileIdRef.current) return fileIdRef.current;
    
    const listResponse = await driveApiFetch(`/drive/v3/files?q=name='${COLLECTION_FILENAME}' and trashed=false&spaces=drive&fields=files(id)`);
    
    if (listResponse.files && listResponse.files.length > 0) {
      fileIdRef.current = listResponse.files[0].id;
      return fileIdRef.current;
    } else {
      const createResponse = await driveApiFetch('/drive/v3/files?fields=id', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: COLLECTION_FILENAME, mimeType: 'application/json' }),
      });
      fileIdRef.current = createResponse.id;
      return fileIdRef.current;
    }
  }, [driveApiFetch]);

  const loadData = useCallback(async (): Promise<UnifiedStorage | null> => {
    if (!isSignedIn) return null;
    updateSyncStatus('loading');
    try {
      const id = await getOrCreateFileId();
      
      // Get file content
      const contentResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, {
        headers: { 'Authorization': `Bearer ${accessTokenRef.current}` }
      });
      
      if (!contentResponse.ok) throw new Error("Failed to load file content");
      
      let data = await contentResponse.json();
      
      // Get metadata for modified time
      const metadata = await driveApiFetch(`/drive/v3/files/${id}?fields=modifiedTime`);
      
      const normalizedData = {
          collection: (Array.isArray(data) ? data : data.collection) || [],
          wantlist: (data.wantlist) || [],
          lastUpdated: metadata.modifiedTime || new Date().toISOString()
      };
      
      setLastSyncTime(metadata.modifiedTime || new Date().toISOString());
      updateSyncStatus('synced');
      return normalizedData as UnifiedStorage;
    } catch (e: any) {
      handleApiError(e, 'load_data');
      return null;
    }
  }, [isSignedIn, getOrCreateFileId, handleApiError, updateSyncStatus, driveApiFetch]);

  const saveData = useCallback(async (data: UnifiedStorage) => {
    if (!isSignedIn) return;
    updateSyncStatus('saving');
    try {
      const id = await getOrCreateFileId();
      
      // Simple upload for small files
      const uploadResponse = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`, {
        method: 'PATCH',
        headers: { 
          'Authorization': `Bearer ${accessTokenRef.current}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data),
      });
      
      if (!uploadResponse.ok) throw new Error("Failed to save data");
      
      const metadata = await driveApiFetch(`/drive/v3/files/${id}?fields=modifiedTime`);
      setLastSyncTime(metadata.modifiedTime || new Date().toISOString());
      updateSyncStatus('synced');
    } catch (e: any) {
      handleApiError(e, 'save_data');
    }
  }, [isSignedIn, getOrCreateFileId, handleApiError, updateSyncStatus, driveApiFetch]);

  const getRevisions = useCallback(async (): Promise<DriveRevision[]> => {
    if (!isSignedIn) return [];
    try {
      const id = await getOrCreateFileId();
      const response = await driveApiFetch(`/drive/v3/files/${id}/revisions?fields=revisions(id, modifiedTime)`);
      return response.revisions || [];
    } catch (e) { 
      return []; 
    }
  }, [isSignedIn, getOrCreateFileId, driveApiFetch]);

  const loadRevision = useCallback(async (revisionId: string): Promise<UnifiedStorage | null> => {
    if (!isSignedIn) return null;
    updateSyncStatus('loading');
    try {
      const id = await getOrCreateFileId();
      
      const contentResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${id}/revisions/${revisionId}?alt=media`, {
        headers: { 'Authorization': `Bearer ${accessTokenRef.current}` }
      });
      
      if (!contentResponse.ok) throw new Error("Failed to load revision content");
      
      const data = await contentResponse.json();
      const metadata = await driveApiFetch(`/drive/v3/files/${id}/revisions/${revisionId}?fields=modifiedTime`);
      
      updateSyncStatus('synced');
      return Array.isArray(data) ? { collection: data, wantlist: [], lastUpdated: metadata.modifiedTime || new Date().toISOString() } : (data as UnifiedStorage);
    } catch (e) {
      handleApiError(e, 'load_revision');
      return null;
    }
  }, [isSignedIn, getOrCreateFileId, handleApiError, updateSyncStatus, driveApiFetch]);

  const fetchDriveImages = useCallback(async (pageToken?: string): Promise<{files: DriveFile[], nextPageToken?: string}> => {
    if (!isSignedIn) return { files: [] };
    try {
      const path = `/drive/v3/files?q=mimeType contains 'image/' and trashed = false&fields=nextPageToken, files(id, name, thumbnailLink, mimeType)&pageSize=40${pageToken ? `&pageToken=${pageToken}` : ''}`;
      const response = await driveApiFetch(path);
      return {
        files: response.files || [],
        nextPageToken: response.nextPageToken
      };
    } catch (e) {
      handleApiError(e, 'fetch_images');
      return { files: [] };
    }
  }, [isSignedIn, handleApiError, driveApiFetch]);

  const signOut = useCallback(() => {
    if (accessTokenRef.current && window.google?.accounts?.oauth2) {
      window.google.accounts.oauth2.revoke(accessTokenRef.current, () => clearAuthState());
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
