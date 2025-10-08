
import { useState, useEffect, useCallback, useRef } from 'react';
import { GOOGLE_CLIENT_ID, GOOGLE_DRIVE_SCOPES, COLLECTION_FILENAME } from '../googleConfig';
import { CD } from '../types';

export type SyncStatus = 'idle' | 'loading' | 'saving' | 'synced' | 'error';

// Declare gapi and google on window for TypeScript
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

  const fileIdRef = useRef<string | null>(null);
  // Use refs to safely track the initialization state of the two independent Google scripts.
  const gapiInited = useRef(false);
  const gisInited = useRef(false);

  // This function is called after each library attempts to initialize.
  // It sets the API to "ready" only when both libraries have successfully loaded.
  const checkApiReady = useCallback(() => {
    if (gapiInited.current && gisInited.current) {
        setIsApiReady(true);
    }
  }, []);

  const handleGapiLoad = useCallback(() => {
    window.gapi.load('client', async () => {
        try {
            await window.gapi.client.init({
                discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
            });
            gapiInited.current = true;
            checkApiReady();
        } catch (e) {
            console.error("GAPI client init error:", e);
            setError("Failed to initialize Google API client.");
            setSyncStatus('error');
        }
    });
  }, [checkApiReady]);

  const handleGisLoad = useCallback(() => {
    if (!GOOGLE_CLIENT_ID) {
      console.warn("Google Client ID is not configured. Google Drive Sync will be disabled.");
      gisInited.current = true; // Mark as "inited" so the app doesn't hang if gapi loads.
      checkApiReady();
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
                    setError(null); // Clear previous errors on successful sign-in.
                } else if (tokenResponse.error) {
                    setError(`Google Sign-In Error: ${tokenResponse.error}`);
                    console.error('Google Sign-In Error:', tokenResponse);
                }
            },
        });
        gisInited.current = true;
        checkApiReady();
    } catch (e) {
        console.error("GIS token client init error:", e);
        setError("Failed to initialize Google Sign-In.");
        setSyncStatus('error');
    }
  }, [checkApiReady]);

  useEffect(() => {
      // Attach script load handlers to the window object
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

      return () => {
          document.body.removeChild(gapiScript);
          document.body.removeChild(gisScript);
          delete (window as any).onGapiLoad;
          delete (window as any).onGisLoad;
      };
  }, [handleGapiLoad, handleGisLoad]);
  
  const getOrCreateFileId = useCallback(async () => {
    if (fileIdRef.current) return fileIdRef.current;

    setError(null);
    let fileId: string | null = null;
    try {
        const response = await window.gapi.client.drive.files.list({
            q: `name='${COLLECTION_FILENAME}' and mimeType='application/json' and trashed=false`,
            spaces: 'drive',
            fields: 'files(id, name)',
        });

        if (response.result.files.length > 0) {
            fileId = response.result.files[0].id;
        } else {
            const createResponse = await window.gapi.client.drive.files.create({
                resource: {
                    name: COLLECTION_FILENAME,
                    mimeType: 'application/json',
                },
                fields: 'id',
            });
            fileId = createResponse.result.id;
        }
        
        fileIdRef.current = fileId;
        return fileId;
    } catch (e: any) {
        console.error("Error finding or creating Drive file:", e);
        setError(`Could not access Google Drive file. ${e?.result?.error?.message || ''}`);
        setSyncStatus('error');
        throw e;
    }
  }, []);
  
  const loadCollection = useCallback(async (): Promise<CD[] | null> => {
    if (!isSignedIn) return null;
    setSyncStatus('loading');
    setError(null);
    try {
        const id = await getOrCreateFileId();
        if (!id) throw new Error("Could not get file ID.");
        
        const response = await window.gapi.client.drive.files.get({
            fileId: id,
            alt: 'media',
        });
        
        const content = response.body;
        if (content && content.length > 0) {
            setSyncStatus('synced');
            return JSON.parse(content);
        }
        // File is new or empty
        setSyncStatus('synced');
        return [];
    } catch (e: any) {
        console.error("Error loading collection from Drive:", e);
        setError(`Failed to load data from Drive. ${e?.result?.error?.message || ''}`);
        setSyncStatus('error');
        return null;
    }
  }, [isSignedIn, getOrCreateFileId]);

  const saveCollection = useCallback(async (cds: CD[]) => {
    if (!isSignedIn) return;
    setSyncStatus('saving');
    setError(null);
    try {
        const id = await getOrCreateFileId();
        if (!id) throw new Error("Could not get file ID.");

        await window.gapi.client.request({
            path: `/upload/drive/v3/files/${id}`,
            method: 'PATCH',
            params: { uploadType: 'media' },
            body: JSON.stringify(cds, null, 2),
        });
        
        setTimeout(() => setSyncStatus('synced'), 500); // Add a small delay to show 'saving' status
    } catch (e: any) {
        console.error("Error saving collection to Drive:", e);
        setError(`Failed to save data to Drive. ${e?.result?.error?.message || ''}`);
        setSyncStatus('error');
    }
  }, [isSignedIn, getOrCreateFileId]);

  const signIn = useCallback(() => {
      if (!isApiReady) {
          setError("Google API is not ready yet. Please try again in a moment.");
          return;
      }
      if (!GOOGLE_CLIENT_ID) {
          setError("Google Sync is not configured. The administrator needs to provide a Google Client ID.");
          return;
      }
      if (window.tokenClient) {
          // This will trigger the Google sign-in flow and request an access token.
          window.tokenClient.requestAccessToken({ prompt: '' });
      } else {
          setError("Google Sign-In client is not available. Please refresh the page.");
      }
  }, [isApiReady]);

  const signOut = useCallback(() => {
    const token = window.gapi.client.getToken();
    if (token !== null) {
      window.google.accounts.oauth2.revoke(token.access_token, () => {
        window.gapi.client.setToken(null);
        setIsSignedIn(false);
        fileIdRef.current = null;
        setSyncStatus('idle');
      });
    }
  }, []);
  
  useEffect(() => {
    if (isApiReady && !isSignedIn) {
      signIn();
    }
  }, [isApiReady, isSignedIn, signIn]);

  return { isApiReady, isSignedIn, signOut, loadCollection, saveCollection, syncStatus, error };
};
