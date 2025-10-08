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

  const handleGapiLoad = useCallback(async () => {
    window.gapi.load('client', async () => {
        // The API key is not required for OAuth2-based Drive API calls.
        // The discovery document alone is sufficient for gapi to initialize the client.
        // Authorization is handled by the token from Google Identity Services.
        await window.gapi.client.init({
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
        });
        
        if (window.google?.accounts?.oauth2) {
             // Both scripts are loaded, API is ready
             setIsApiReady(true);
        }
    });
  }, []);

  const handleGisLoad = useCallback(() => {
    // Do not initialize if the client ID is missing.
    if (!GOOGLE_CLIENT_ID) {
      console.warn("Google Client ID is not configured. Google Drive Sync will be disabled.");
      // Still set API as "ready" so the app doesn't hang, but sync functionality will be off.
      if (window.gapi?.client) {
          setIsApiReady(true);
      }
      return;
    }
      
    window.tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GOOGLE_DRIVE_SCOPES,
        callback: async (tokenResponse: any) => {
            if (tokenResponse && tokenResponse.access_token) {
                // The gapi client needs to be explicitly given the access token.
                window.gapi.client.setToken(tokenResponse);
                setIsSignedIn(true);
            } else if (tokenResponse.error) {
                setError(`Google Sign-In Error: ${tokenResponse.error}`);
                console.error('Google Sign-In Error:', tokenResponse);
            }
        },
    });

    if (window.gapi?.client) {
        // Both scripts are loaded, API is ready
        setIsApiReady(true);
    }
  }, []);

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
          // This will trigger the Google sign-in flow.
          // It will use an existing session if available, or prompt the user to sign in
          // and grant permissions if necessary. This is more reliable than forcing consent.
          window.tokenClient.requestAccessToken();
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

  return { isApiReady, isSignedIn, signIn, signOut, loadCollection, saveCollection, syncStatus, error };
};