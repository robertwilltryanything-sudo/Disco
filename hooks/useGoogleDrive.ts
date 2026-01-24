
import { useState, useEffect, useCallback, useRef } from 'react';
import { GOOGLE_CLIENT_ID, GOOGLE_DRIVE_SCOPES, COLLECTION_FILENAME } from '../googleConfig';
import { CD, WantlistItem, DriveRevision, SyncStatus } from '../types';

export interface UnifiedStorage {
    collection: CD[];
    wantlist: WantlistItem[];
    lastUpdated: string;
}

const SIGNED_IN_KEY = 'disco_drive_signed_in';

declare global {
  interface Window {
    gapi: any;
    google: any;
    tokenClient: any;
  }
}

export const useGoogleDrive = () => {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [gapiLoaded, setGapiLoaded] = useState(false);
  const [gisLoaded, setGisLoaded] = useState(false);
  const [isApiReady, setIsApiReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  const fileIdRef = useRef<string | null>(null);
  const lastSyncHashRef = useRef<string | null>(null);
  const scriptsInitiatedRef = useRef(false);
  const refreshTimerRef = useRef<number | null>(null);
  
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      setSyncStatus('disabled');
      setError('Google Sync is not configured. Add VITE_GOOGLE_CLIENT_ID to your environment.');
      setIsApiReady(false);
    }
  }, []);

  const clearAuthState = useCallback(() => {
    if (window.gapi?.client) {
      window.gapi.client.setToken(null);
    }
    if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
    }
    localStorage.removeItem(SIGNED_IN_KEY);
    setIsSignedIn(false);
    fileIdRef.current = null;
    lastSyncHashRef.current = null;
    setSyncStatus('idle');
    setLastSyncTime(null);
  }, []);

  const handleApiError = useCallback((e: any, context: string) => {
    const errorDetails = e?.result?.error || e?.error;
    const errorCode = errorDetails?.code;
    const errorMessage = errorDetails?.message || '';
    
    console.error(`Google Drive API Error (${context}):`, e);

    if (errorCode === 401) {
      clearAuthState();
      setError("Unauthorized. Please sign in again.");
      setSyncStatus('error');
    } else {
      setError(`Could not ${context}. ${errorMessage || 'Try again later.'}`);
      setSyncStatus('error');
    }
  }, [clearAuthState]);

  const initializeGapiClient = useCallback(async () => {
    try {
        await window.gapi.client.init({
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
        });
        setGapiLoaded(true);
    } catch (e) {
        console.error("GAPI Init Error:", e);
    }
  }, []);

  const handleGapiLoad = useCallback(() => {
    window.gapi.load('client', initializeGapiClient);
  }, [initializeGapiClient]);

  const handleGisLoad = useCallback(() => {
    if (!GOOGLE_CLIENT_ID) {
      setGisLoaded(true);
      return;
    }
    try {
        window.tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: GOOGLE_DRIVE_SCOPES,
            callback: async (tokenResponse: any) => {
                if (tokenResponse && tokenResponse.access_token) {
                    window.gapi.client.setToken(tokenResponse);
                    setIsSignedIn(true);
                    setSyncStatus('idle');
                    setError(null);
                    localStorage.setItem(SIGNED_IN_KEY, 'true');

                    if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
                    const expiresIn = (tokenResponse.expires_in || 3600) * 1000;
                    const refreshDelay = Math.max(expiresIn - 300000, 60000); 
                    refreshTimerRef.current = window.setTimeout(() => {
                        window.tokenClient.requestAccessToken({ prompt: '' });
                    }, refreshDelay);
                }
            },
        });
        setGisLoaded(true);
    } catch (e) {
        console.error("GIS Init Error:", e);
    }
  }, []);

  useEffect(() => {
    if (gapiLoaded && gisLoaded) {
        setIsApiReady(true);
        if (localStorage.getItem(SIGNED_IN_KEY) === 'true') {
            window.tokenClient.requestAccessToken({ prompt: '' });
        }
    }
  }, [gapiLoaded, gisLoaded]);

  useEffect(() => {
    if (scriptsInitiatedRef.current || !GOOGLE_CLIENT_ID) return;
    scriptsInitiatedRef.current = true;
    const gapiScript = document.createElement('script');
    gapiScript.src = 'https://apis.google.com/js/api.js';
    gapiScript.async = true;
    gapiScript.defer = true;
    gapiScript.onload = handleGapiLoad;
    document.body.appendChild(gapiScript);

    const gisScript = document.createElement('script');
    gisScript.src = 'https://accounts.google.com/gsi/client';
    gisScript.async = true;
    gisScript.defer = true;
    gisScript.onload = handleGisLoad;
    document.body.appendChild(gisScript);
    return () => { if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current); };
  }, [handleGapiLoad, handleGisLoad]);

  const signIn = useCallback(() => {
      if (!isApiReady || !GOOGLE_CLIENT_ID) return;
      setSyncStatus('authenticating');
      window.tokenClient.requestAccessToken({ prompt: 'select_account' });
  }, [isApiReady]);

  const getOrCreateFileId = useCallback(async () => {
    if (fileIdRef.current) return fileIdRef.current;
    try {
        const response = await window.gapi.client.drive.files.list({
            q: `name='${COLLECTION_FILENAME}' and trashed=false`,
            spaces: 'drive',
            fields: 'files(id, name, modifiedTime)',
        });
        if (response.result.files.length > 0) {
            fileIdRef.current = response.result.files[0].id;
            setLastSyncTime(response.result.files[0].modifiedTime);
        } else {
            const createResponse = await window.gapi.client.drive.files.create({
                resource: { name: COLLECTION_FILENAME, mimeType: 'application/json' },
                fields: 'id, modifiedTime',
            });
            fileIdRef.current = createResponse.result.id;
            setLastSyncTime(createResponse.result.modifiedTime);
        }
        return fileIdRef.current;
    } catch (e: any) {
        handleApiError(e, 'access Drive file');
        throw e;
    }
  }, [handleApiError]);

  const checkRemoteUpdate = useCallback(async (): Promise<boolean> => {
    if (!isSignedIn) return false;
    try {
        const id = await getOrCreateFileId();
        const metadata = await window.gapi.client.drive.files.get({ fileId: id, fields: 'modifiedTime' });
        const remoteTime = new Date(metadata.result.modifiedTime).getTime();
        const localTime = lastSyncTime ? new Date(lastSyncTime).getTime() : 0;
        return remoteTime > localTime + 1000; // 1s buffer
    } catch (e) {
        return false;
    }
  }, [isSignedIn, getOrCreateFileId, lastSyncTime]);

  const loadData = useCallback(async (): Promise<UnifiedStorage | null> => {
    if (!isSignedIn || syncStatus === 'loading') return null;
    setSyncStatus('loading');
    try {
        const id = await getOrCreateFileId();
        const response = await window.gapi.client.drive.files.get({ fileId: id, alt: 'media' });
        const metadata = await window.gapi.client.drive.files.get({ fileId: id, fields: 'modifiedTime' });
        setLastSyncTime(metadata.result.modifiedTime);
        const data = JSON.parse(response.body);
        lastSyncHashRef.current = JSON.stringify({ collection: data.collection, wantlist: data.wantlist });
        setSyncStatus('synced');
        return Array.isArray(data) ? { collection: data, wantlist: [], lastUpdated: metadata.result.modifiedTime } : data;
    } catch (e: any) {
        handleApiError(e, 'load data');
        return null;
    }
  }, [isSignedIn, getOrCreateFileId, handleApiError, syncStatus]);

  const saveData = useCallback(async (data: UnifiedStorage, force: boolean = false) => {
    if (!isSignedIn || syncStatus === 'saving' || syncStatus === 'conflict') return;
    
    const currentHash = JSON.stringify({ collection: data.collection, wantlist: data.wantlist });
    if (!force && currentHash === lastSyncHashRef.current) {
        setSyncStatus('synced');
        return;
    }

    setSyncStatus('saving');
    try {
        const id = await getOrCreateFileId();
        
        // Conflict Check
        if (!force) {
            const metadataBefore = await window.gapi.client.drive.files.get({ fileId: id, fields: 'modifiedTime' });
            const remoteTime = new Date(metadataBefore.result.modifiedTime).getTime();
            const localTime = lastSyncTime ? new Date(lastSyncTime).getTime() : 0;
            if (remoteTime > localTime + 2000) {
                setSyncStatus('conflict');
                return;
            }
        }

        await window.gapi.client.request({
            path: `/upload/drive/v3/files/${id}`,
            method: 'PATCH',
            params: { uploadType: 'media' },
            body: JSON.stringify(data),
        });
        
        const metadataAfter = await window.gapi.client.drive.files.get({ fileId: id, fields: 'modifiedTime' });
        setLastSyncTime(metadataAfter.result.modifiedTime);
        lastSyncHashRef.current = currentHash;
        setSyncStatus('synced');
    } catch (e: any) {
        handleApiError(e, 'save data');
    }
  }, [isSignedIn, getOrCreateFileId, handleApiError, syncStatus, lastSyncTime]);

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
        const response = await window.gapi.client.drive.revisions.get({ fileId: id, revisionId: revisionId, alt: 'media' });
        const data = JSON.parse(response.body);
        setSyncStatus('synced');
        return Array.isArray(data) ? { collection: data, wantlist: [], lastUpdated: new Date().toISOString() } : data;
    } catch (e) {
        handleApiError(e, 'load revision');
        return null;
    }
  }, [isSignedIn, getOrCreateFileId, handleApiError]);

  const signOut = useCallback(() => {
    const token = window.gapi?.client?.getToken();
    if (token !== null && window.google?.accounts?.oauth2) {
      window.google.accounts.oauth2.revoke(token.access_token, () => clearAuthState());
    } else {
      clearAuthState();
    }
  }, [clearAuthState]);

  return { 
    isApiReady, isSignedIn, signIn, signOut, loadData, saveData, checkRemoteUpdate,
    getRevisions, loadRevision, syncStatus, error, lastSyncTime
  };
};
