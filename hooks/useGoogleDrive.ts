import { useState, useEffect, useCallback, useRef } from 'react';
import { GOOGLE_CLIENT_ID, GOOGLE_DRIVE_SCOPES, COLLECTION_FILENAME } from '../googleConfig';
import { CD, WantlistItem } from '../types';

export type SyncStatus = 'idle' | 'loading' | 'saving' | 'synced' | 'error' | 'disabled' | 'authenticating';

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
  const lastSyncHashRef = useRef<string | null>(null);
  const scriptsInitiatedRef = useRef(false);
  
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
    setIsSignedIn(false);
    fileIdRef.current = null;
    lastSyncHashRef.current = null;
    setSyncStatus('idle');
  }, []);

  const handleApiError = useCallback((e: any, context: string) => {
    const errorDetails = e?.result?.error || e?.error;
    const errorCode = errorDetails?.code;
    const errorMessage = errorDetails?.message || '';
    const errorReason = errorDetails?.errors?.[0]?.reason || '';
    
    console.error(`Google Drive API Error (${context}):`, e);

    if (errorReason === 'accessNotConfigured' || errorMessage.includes('not enabled')) {
        setError("Drive API is not enabled. In Google Console, go to 'Enabled APIs & Services', search for 'Google Drive API' and click Enable.");
        setSyncStatus('error');
        return;
    }

    if (errorCode === 403) {
      setError("Access Denied (403). Check that you have: 1. Enabled 'Google Drive API'. 2. Added your email as a 'Test User'. 3. Configured the correct 'Authorized JavaScript Origins'.");
      setSyncStatus('error');
    } else if (errorCode === 401) {
      clearAuthState();
      setError("Unauthorized (401). Please check your Client ID and try signing in again.");
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
        setError("Failed to initialize Google API client.");
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
                } else if (tokenResponse.error) {
                    setError(`Sign-In Error: ${tokenResponse.error_description || tokenResponse.error}`);
                    setSyncStatus('error');
                }
            },
        });
        setGisLoaded(true);
    } catch (e) {
        console.error("GIS Init Error:", e);
        setError("Failed to initialize Google Sign-In components.");
    }
  }, []);

  useEffect(() => {
    if (gapiLoaded && gisLoaded) {
        setIsApiReady(true);
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
    
  }, [handleGapiLoad, handleGisLoad]);

  const signIn = useCallback(() => {
      if (!isApiReady || !GOOGLE_CLIENT_ID) {
          console.warn("Sign-in attempted before Google APIs were ready.");
          return;
      }
      setSyncStatus('authenticating');
      if (window.tokenClient) {
          window.tokenClient.requestAccessToken({ prompt: 'consent' });
      }
  }, [isApiReady]);

  const getOrCreateFileId = useCallback(async () => {
    if (fileIdRef.current) return fileIdRef.current;
    setError(null);
    try {
        const response = await window.gapi.client.drive.files.list({
            q: `name='${COLLECTION_FILENAME}' and trashed=false`,
            spaces: 'drive',
            fields: 'files(id, name)',
        });
        if (response.result.files.length > 0) {
            fileIdRef.current = response.result.files[0].id;
        } else {
            const createResponse = await window.gapi.client.drive.files.create({
                resource: {
                    name: COLLECTION_FILENAME,
                    mimeType: 'application/json',
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
    if (!isSignedIn || syncStatus === 'loading') return null;
    setSyncStatus('loading');
    setError(null);
    try {
        const id = await getOrCreateFileId();
        const response = await window.gapi.client.drive.files.get({ fileId: id, alt: 'media' });
        const content = response.body;
        
        if (content && content.length > 0) {
            lastSyncHashRef.current = JSON.stringify(JSON.parse(content));
            setSyncStatus('synced');
            const data = JSON.parse(content);
            if (Array.isArray(data)) {
                return { collection: data, wantlist: [], lastUpdated: new Date().toISOString() };
            }
            return data;
        }
        setSyncStatus('synced');
        return { collection: [], wantlist: [], lastUpdated: new Date().toISOString() };
    } catch (e: any) {
        handleApiError(e, 'load data');
        return null;
    }
  }, [isSignedIn, getOrCreateFileId, handleApiError, syncStatus]);

  const saveData = useCallback(async (data: UnifiedStorage) => {
    if (!isSignedIn || syncStatus === 'saving') return;
    
    const currentHash = JSON.stringify(data);
    if (currentHash === lastSyncHashRef.current) {
        setSyncStatus('synced');
        return;
    }

    setSyncStatus('saving');
    setError(null);
    try {
        const id = await getOrCreateFileId();
        await window.gapi.client.request({
            path: `/upload/drive/v3/files/${id}`,
            method: 'PATCH',
            params: { uploadType: 'media' },
            body: currentHash,
        });
        lastSyncHashRef.current = currentHash;
        setSyncStatus('synced');
    } catch (e: any) {
        handleApiError(e, 'save data');
    }
  }, [isSignedIn, getOrCreateFileId, handleApiError, syncStatus]);

  const signOut = useCallback(() => {
    const token = window.gapi?.client?.getToken();
    if (token !== null && window.google?.accounts?.oauth2) {
      window.google.accounts.oauth2.revoke(token.access_token, () => clearAuthState());
    } else {
      clearAuthState();
    }
  }, [clearAuthState]);

  return { isApiReady, isSignedIn, signIn, signOut, loadData, saveData, syncStatus, error };
};