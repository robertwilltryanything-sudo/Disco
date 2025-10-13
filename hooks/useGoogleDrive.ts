
import { useState, useEffect, useCallback, useRef } from 'react';
import { GOOGLE_CLIENT_ID, GOOGLE_DRIVE_SCOPES, COLLECTION_FILENAME } from '../googleConfig';
import { CD } from '../types';

export type SyncStatus = 'idle' | 'loading' | 'saving' | 'synced' | 'error' | 'disabled';

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
  const [gapiLoaded, setGapiLoaded] = useState(false);
  const [gisLoaded, setGisLoaded] = useState(false);
  const [isApiReady, setIsApiReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const fileIdRef = useRef<string | null>(null);
  const initialSignInAttempted = useRef(false);
  const scriptsInitiatedRef = useRef(false);
  
  // New effect to handle the unconfigured state
  useEffect(() => {
    // If the Client ID is missing, the sync feature is disabled.
    if (!GOOGLE_CLIENT_ID) {
      setSyncStatus('disabled');
      setError('Google Sync is not configured. The administrator needs to provide a VITE_GOOGLE_CLIENT_ID.');
      // Set API as "ready" so the UI doesn't hang in an initializing state.
      setIsApiReady(true);
    }
  }, []);

  const clearAuthState = useCallback(() => {
    window.gapi?.client?.setToken(null);
    setIsSignedIn(false);
    fileIdRef.current = null;
    setSyncStatus('idle');
    // Allow the auto-sign-in attempt to happen again after being signed out.
    initialSignInAttempted.current = false; 
  }, []);

  const handleApiError = useCallback((e: any, context: string) => {
    const errorDetails = e?.result?.error;
    const errorCode = errorDetails?.code;
    const errorReason = errorDetails?.errors?.[0]?.reason;
    
    console.error(`Error ${context}:`, e);

    // This is a specific, highly informative error from Google.
    // It means the user has authenticated, but the API itself isn't turned on in their Cloud project.
    if (errorReason === 'accessNotConfigured') {
        setError("Sync failed: The Google Drive API is not enabled for your project. Please visit the Google Cloud Console to enable it.");
        setSyncStatus('error');
        // We don't sign the user out, allowing them to try again after enabling the API.
        return;
    }

    // Handle generic authentication errors (e.g., revoked token) by signing the user out.
    if (errorCode === 401 || errorCode === 403) {
      clearAuthState();
      setError("Sync failed due to an authentication issue. Please sign in again.");
    } else {
      setError(`Could not ${context}. ${errorDetails?.message || 'Please try again later.'}`);
    }
    setSyncStatus('error');
  }, [clearAuthState]);

  const handleGapiLoad = useCallback(async () => {
    window.gapi.load('client', async () => {
        // The API key is not required for OAuth2-based Drive API calls.
        // The discovery document alone is sufficient for gapi to initialize the client.
        // Authorization is handled by the token from Google Identity Services.
        await window.gapi.client.init({
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
        });
        setGapiLoaded(true);
    });
  }, []);

  const handleGisLoad = useCallback(() => {
    // Do not initialize if the client ID is missing.
    if (!GOOGLE_CLIENT_ID) {
      console.warn("Google Client ID is not configured. Google Drive Sync will be disabled.");
      // Still set GIS as "loaded" so the API ready state can be triggered, but sync will remain off.
      setGisLoaded(true);
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
    setGisLoaded(true);
  }, []);

  // Effect to ensure both GAPI and GIS are fully loaded before marking the API as ready.
  // This prevents race conditions.
  useEffect(() => {
    if (gapiLoaded && gisLoaded) {
      setIsApiReady(true);
    }
  }, [gapiLoaded, gisLoaded]);

  // Effect to load the Google API scripts.
  useEffect(() => {
    // This effect should only run once. The ref guard prevents it from re-running
    // in React's Strict Mode, which would otherwise cause issues.
    if (scriptsInitiatedRef.current) {
      return;
    }
    
    if (GOOGLE_CLIENT_ID) {
      scriptsInitiatedRef.current = true;

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
    }
    // No cleanup function is returned. Removing these scripts from the DOM during
    // development re-mounts in Strict Mode is what causes the loading to fail.
    // They are intended to be loaded once for the lifetime of the page.
  }, [handleGapiLoad, handleGisLoad]);


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

  useEffect(() => {
    // Automatically trigger sign-in once when the API is ready and the user isn't signed in.
    // Added GOOGLE_CLIENT_ID check to prevent auto-sign-in when not configured.
    if (isApiReady && !isSignedIn && !initialSignInAttempted.current && GOOGLE_CLIENT_ID) {
      initialSignInAttempted.current = true;
      signIn();
    }
  }, [isApiReady, isSignedIn, signIn]);
  
  const getOrCreateFileId = useCallback(async () => {
    if (fileIdRef.current) return fileIdRef.current;

    setError(null);
    let fileId: string | null = null;
    try {
        // Search for the file in the appDataFolder instead of the main Drive space.
        // This is a private folder only your app can access, ensuring data isolation
        // and reliable sync across devices.
        const response = await window.gapi.client.drive.files.list({
            q: `name='${COLLECTION_FILENAME}' and mimeType='application/json' and trashed=false`,
            spaces: 'appDataFolder',
            fields: 'files(id, name)',
        });

        if (response.result.files.length > 0) {
            fileId = response.result.files[0].id;
        } else {
            // If the file doesn't exist, create it in the appDataFolder.
            const createResponse = await window.gapi.client.drive.files.create({
                resource: {
                    name: COLLECTION_FILENAME,
                    mimeType: 'application/json',
                    parents: ['appDataFolder'], // Specify the appDataFolder as the parent
                },
                fields: 'id',
            });
            fileId = createResponse.result.id;
        }
        
        fileIdRef.current = fileId;
        return fileId;
    } catch (e: any) {
        handleApiError(e, 'access Google Drive file');
        throw e;
    }
  }, [handleApiError]);
  
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
        handleApiError(e, 'load data from Drive');
        return null;
    }
  }, [isSignedIn, getOrCreateFileId, handleApiError]);

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
        handleApiError(e, 'save data to Drive');
    }
  }, [isSignedIn, getOrCreateFileId, handleApiError]);

  const signOut = useCallback(() => {
    const token = window.gapi.client.getToken();
    if (token !== null && window.google?.accounts?.oauth2) {
      window.google.accounts.oauth2.revoke(token.access_token, () => {
        clearAuthState();
      });
    } else {
      clearAuthState();
    }
  }, [clearAuthState]);

  return { isApiReady, isSignedIn, signIn, signOut, loadCollection, saveCollection, syncStatus, error };
};
