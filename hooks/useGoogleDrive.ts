import { useState, useEffect, useCallback, useRef } from 'react';
import { GOOGLE_CLIENT_ID, GOOGLE_DRIVE_SCOPES, COLLECTION_FILENAME } from '../googleConfig';
import { CD, WantlistItem } from '../types';

export type SyncStatus = 'idle' | 'loading' | 'saving' | 'synced' | 'error' | 'disabled';

export interface UnifiedStorage {
    collection: CD[];
    wantlist: WantlistItem[];
    lastUpdated: string;
}

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

  const fileIdRef = useRef<string | null>(null);
  const initialSignInAttempted = useRef(false);
  const scriptsInitiatedRef = useRef(false);
  
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      setSyncStatus('disabled');
      setError('Google Sync is not configured. Add VITE_GOOGLE_CLIENT_ID to your environment.');
      setIsApiReady(true);
    }
  }, []);

  const clearAuthState = useCallback(() => {
    window.gapi?.client?.setToken(null);
    setIsSignedIn(false);
    fileIdRef.current = null;
    setSyncStatus('idle');
    initialSignInAttempted.current = false; 
  }, []);

  const handleApiError = useCallback((e: any, context: string) => {
    const errorDetails = e?.result?.error;
    const errorCode = errorDetails?.code;
    const errorReason = errorDetails?.errors?.[0]?.reason;
    
    if (errorReason === 'accessNotConfigured') {
        setError("Drive API is not enabled in your Google Cloud Project.");
        setSyncStatus('error');
        return;
    }

    if (errorCode === 401 || errorCode === 403) {
      clearAuthState();
      setError("Authentication issue. Please sign in again.");
    } else {
      setError(`Could not ${context}. ${errorDetails?.message || 'Try again later.'}`);
    }
    setSyncStatus('error');
  }, [clearAuthState]);

  const handleGapiLoad = useCallback(async () => {
    window.gapi.load('client', async () => {
        await window.gapi.client.init({
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
        });
        setGapiLoaded(true);
    });
  }, []);

  const handleGisLoad = useCallback(() => {
    if (!GOOGLE_CLIENT_ID) {
      setGisLoaded(true);
      return;
    }
      
    window.tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GOOGLE_DRIVE_SCOPES,
        callback: async (tokenResponse: any) => {
            if (tokenResponse && tokenResponse.access_token) {
                window.gapi.client.setToken(tokenResponse);
                setIsSignedIn(true);
            } else if (tokenResponse.error) {
                setError(`Sign-In Error: ${tokenResponse.error}`);
            }
        },
    });
    setGisLoaded(true);
  }, []);

  useEffect(() => {
    if (gapiLoaded && gisLoaded) setIsApiReady(true);
  }, [gapiLoaded, gisLoaded]);

  useEffect(() => {
    if (scriptsInitiatedRef.current) return;
    if (GOOGLE_CLIENT_ID) {
      scriptsInitiatedRef.current = true;
      (window as any).onGapiLoad = handleGapiLoad;
      (window as any).onGisLoad = handleGisLoad;
      const gapiScript = document.createElement('script');
      gapiScript.src = 'https://apis.google.com/js/api.js?onload=onGapiLoad';
      gapiScript.async = true;
      gapiScript.defer = true;
      document.body.appendChild(gapiScript);
      const gisScript = document.createElement('script');
      gisScript.src = 'https://accounts.google.com/gsi/client?onload=onGisLoad';
      gisScript.async = true;
      gisScript.defer = true;
      document.body.appendChild(gisScript);
    }
  }, [handleGapiLoad, handleGisLoad]);

  const signIn = useCallback(() => {
      if (!isApiReady || !GOOGLE_CLIENT_ID) return;
      if (window.tokenClient) window.tokenClient.requestAccessToken();
  }, [isApiReady]);

  useEffect(() => {
    if (isApiReady && !isSignedIn && !initialSignInAttempted.current && GOOGLE_CLIENT_ID) {
      initialSignInAttempted.current = true;
      signIn();
    }
  }, [isApiReady, isSignedIn, signIn]);
  
  const getOrCreateFileId = useCallback(async () => {
    if (fileIdRef.current) return fileIdRef.current;
    setError(null);
    try {
        const response = await window.gapi.client.drive.files.list({
            q: `name='${COLLECTION_FILENAME}' and trashed=false`,
            spaces: 'appDataFolder',
            fields: 'files(id, name)',
        });
        if (response.result.files.length > 0) {
            fileIdRef.current = response.result.files[0].id;
        } else {
            const createResponse = await window.gapi.client.drive.files.create({
                resource: {
                    name: COLLECTION_FILENAME,
                    mimeType: 'application/json',
                    parents: ['appDataFolder'],
                },
                fields: 'id',
            });
            fileIdRef.current = createResponse.result.id;
        }
        return fileIdRef.current;
    } catch (e: any) {
        handleApiError(e, 'access Drive file');
        throw e;
    }
  }, [handleApiError]);
  
  const loadData = useCallback(async (): Promise<UnifiedStorage | null> => {
    if (!isSignedIn) return null;
    setSyncStatus('loading');
    setError(null);
    try {
        const id = await getOrCreateFileId();
        const response = await window.gapi.client.drive.files.get({ fileId: id, alt: 'media' });
        const content = response.body;
        setSyncStatus('synced');
        if (content && content.length > 0) {
            const data = JSON.parse(content);
            // Migration: handle if the file only contains an array (legacy format)
            if (Array.isArray(data)) {
                return { collection: data, wantlist: [], lastUpdated: new Date().toISOString() };
            }
            return data;
        }
        return { collection: [], wantlist: [], lastUpdated: new Date().toISOString() };
    } catch (e: any) {
        handleApiError(e, 'load data');
        return null;
    }
  }, [isSignedIn, getOrCreateFileId, handleApiError]);

  const saveData = useCallback(async (data: UnifiedStorage) => {
    if (!isSignedIn) return;
    setSyncStatus('saving');
    setError(null);
    try {
        const id = await getOrCreateFileId();
        await window.gapi.client.request({
            path: `/upload/drive/v3/files/${id}`,
            method: 'PATCH',
            params: { uploadType: 'media' },
            body: JSON.stringify(data, null, 2),
        });
        setSyncStatus('synced');
    } catch (e: any) {
        handleApiError(e, 'save data');
    }
  }, [isSignedIn, getOrCreateFileId, handleApiError]);

  const signOut = useCallback(() => {
    const token = window.gapi.client.getToken();
    if (token !== null && window.google?.accounts?.oauth2) {
      window.google.accounts.oauth2.revoke(token.access_token, () => clearAuthState());
    } else {
      clearAuthState();
    }
  }, [clearAuthState]);

  return { isApiReady, isSignedIn, signIn, signOut, loadData, saveData, syncStatus, error };
};