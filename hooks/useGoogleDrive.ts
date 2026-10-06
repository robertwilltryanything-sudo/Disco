import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { GOOGLE_CLIENT_ID, GOOGLE_DRIVE_SCOPES, COLLECTION_FILENAME, PLEX_DATA_FILENAME } from '../googleConfig';
import { CD, WantlistItem, DriveRevision, SyncStatus } from '../types';

export interface PlexDiagnosticResult {
  success: boolean;
  fileFound: boolean;
  fileId?: string;
  fileName?: string;
  summary?: {
    schemaVersion?: number | string;
    plexServer?: string;
    libraryName?: string;
    albumCount?: number;
    modifiedTime?: string;
  };
  error?: {
    message: string;
    status?: number;
    code?: string | number;
    details?: any;
  } | null;
}

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

export interface UserProfile {
  email: string | null;
  name: string | null;
  picture: string | null;
}

export const SIGNED_IN_KEY = 'disco_drive_signed_in';
export const ACCESS_TOKEN_KEY = 'disco_drive_access_token';
export const EXPIRES_AT_KEY = 'disco_drive_expires_at';
export const USER_EMAIL_KEY = 'disco_drive_user_email';
export const USER_NAME_KEY = 'disco_drive_user_name';
export const USER_PICTURE_KEY = 'disco_drive_user_picture';
export const LAST_SYNC_TIME_KEY = 'disco_last_sync_time';
const AUTH_TIMEOUT_MS = 30000; 
const DISCO_AUTH_EVENT = 'disco_drive_auth_change';

declare global {
  interface Window {
    google: any;
    tokenClient: any;
  }
}

export interface DriveMetadata {
  id: string;
  modifiedTime: string;
  version?: string;
}

/**
 * Returns the currently cached access token if it exists and has not yet expired.
 * Includes a 30-second buffer before true expiry to avoid mid-flight 401s.
 */
export const getValidStoredToken = (): string | null => {
  try {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    const expiresAtStr = localStorage.getItem(EXPIRES_AT_KEY);
    if (!token || !expiresAtStr) return null;
    const expiresAt = Number(expiresAtStr);
    if (expiresAt > Date.now() + 30000) {
      return token;
    }
  } catch (e) {
    console.warn("Failed reading cached Google Drive access token:", e);
  }
  return null;
};

export const getStoredUserProfile = (): UserProfile => {
  return {
    email: localStorage.getItem(USER_EMAIL_KEY) || null,
    name: localStorage.getItem(USER_NAME_KEY) || null,
    picture: localStorage.getItem(USER_PICTURE_KEY) || null,
  };
};

export const useGoogleDrive = (onSignInSuccess?: () => void) => {
  // Synchronously initialize isSignedIn if a valid token or persistent signed-in flag exists in localStorage
  const initialValidToken = getValidStoredToken();
  const [isSignedIn, setIsSignedIn] = useState<boolean>(() => {
    return !!initialValidToken || localStorage.getItem(SIGNED_IN_KEY) === 'true';
  });
  const [needsTokenRefresh, setNeedsTokenRefresh] = useState<boolean>(() => {
    return !initialValidToken && localStorage.getItem(SIGNED_IN_KEY) === 'true';
  });
  const [userProfile, setUserProfile] = useState<UserProfile>(getStoredUserProfile);
  const [isApiReady, setIsApiReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => localStorage.getItem(LAST_SYNC_TIME_KEY));

  const accessTokenRef = useRef<string | null>(initialValidToken);
  const fileIdRef = useRef<string | null>(null);
  const authTimeoutRef = useRef<number | null>(null);
  const refreshTimerRef = useRef<number | null>(null);
  const syncStatusRef = useRef<SyncStatus>('idle');
  const initStartedRef = useRef(false);
  const isSilentRefreshRef = useRef(false);
  const signInSuccessCbRef = useRef(onSignInSuccess);
  signInSuccessCbRef.current = onSignInSuccess;
  
  const updateSyncStatus = useCallback((newStatus: SyncStatus) => {
    syncStatusRef.current = newStatus;
    setSyncStatus(newStatus);
  }, []);

  const clearAuthState = useCallback(() => {
    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    accessTokenRef.current = null;
    localStorage.removeItem(SIGNED_IN_KEY);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(EXPIRES_AT_KEY);
    localStorage.removeItem(USER_EMAIL_KEY);
    localStorage.removeItem(USER_NAME_KEY);
    localStorage.removeItem(USER_PICTURE_KEY);
    localStorage.removeItem(LAST_SYNC_TIME_KEY);
    setIsSignedIn(false);
    setNeedsTokenRefresh(false);
    setUserProfile({ email: null, name: null, picture: null });
    fileIdRef.current = null;
    updateSyncStatus('idle');
    setLastSyncTime(null);

    // Notify other hook instances and tabs
    window.dispatchEvent(new CustomEvent(DISCO_AUTH_EVENT, {
      detail: { token: null, isSignedIn: false }
    }));
  }, [updateSyncStatus]);

  const handleApiError = useCallback((e: any, context: string) => {
    console.error(`Google Drive API Error (${context}):`, e);
    
    const message = e?.message || (typeof e === 'string' ? e : "Sync operation failed.");
    const status = e?.status;

    if (status === 401 || status === 403 || message.includes('invalid_grant')) {
      // Invalidate current cached token, but preserve userEmail & SIGNED_IN_KEY so user stays logged in
      accessTokenRef.current = null;
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(EXPIRES_AT_KEY);
      setNeedsTokenRefresh(true);
      setError("Google Drive session needs to be refreshed. Please click 'Resume Session' to continue.");
      updateSyncStatus('idle');
    } else {
      setError(`Sync error: ${message}`);
      updateSyncStatus('error');
    }
  }, [updateSyncStatus]);

  // Synchronize state across multiple instances of useGoogleDrive or browser tabs
  useEffect(() => {
    const handleAuthChange = (e: any) => {
      const detail = e.detail;
      if (detail) {
        accessTokenRef.current = detail.token;
        setIsSignedIn(detail.isSignedIn);
        if (detail.isSignedIn) {
          setUserProfile(getStoredUserProfile());
        }
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === ACCESS_TOKEN_KEY || e.key === SIGNED_IN_KEY) {
        const valid = getValidStoredToken();
        accessTokenRef.current = valid;
        setIsSignedIn(!!valid);
        setUserProfile(getStoredUserProfile());
      }
    };

    window.addEventListener(DISCO_AUTH_EVENT, handleAuthChange);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener(DISCO_AUTH_EVENT, handleAuthChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const driveApiFetch = useCallback(async (path: string, options: RequestInit = {}) => {
    // If accessTokenRef is empty, check localStorage
    if (!accessTokenRef.current) {
      accessTokenRef.current = getValidStoredToken();
    }
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

  // Fetch and store Google user profile (email, name, picture) to display and use as login hint
  const fetchAndStoreUserProfile = useCallback(async (token: string) => {
    try {
      const response = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.user) {
          const profile: UserProfile = {
            email: data.user.emailAddress || null,
            name: data.user.displayName || null,
            picture: data.user.photoLink || null
          };
          if (profile.email) localStorage.setItem(USER_EMAIL_KEY, profile.email);
          if (profile.name) localStorage.setItem(USER_NAME_KEY, profile.name);
          if (profile.picture) localStorage.setItem(USER_PICTURE_KEY, profile.picture);
          setUserProfile(profile);
        }
      }
    } catch (e) {
      console.debug("Could not fetch user profile details:", e);
    }
  }, []);

  // Silently request a renewed token in the background using GIS
  const triggerSilentRefresh = useCallback(() => {
    if (!window.tokenClient) return;
    const userEmail = localStorage.getItem(USER_EMAIL_KEY) || undefined;
    isSilentRefreshRef.current = true;
    try {
      window.tokenClient.requestAccessToken({
        prompt: '',
        hint: userEmail
      });
    } catch (err) {
      console.warn("Silent token refresh initiation error:", err);
      isSilentRefreshRef.current = false;
    }
  }, []);

  // Schedule a proactive silent refresh 5 minutes before the token expires
  const scheduleBackgroundRefresh = useCallback((expiresInSec: number) => {
    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    // Refresh 5 minutes (300 seconds) before expiry; minimum 15 seconds
    const delayMs = Math.max((expiresInSec - 300) * 1000, 15000);
    refreshTimerRef.current = window.setTimeout(() => {
      triggerSilentRefresh();
    }, delayMs);
  }, [triggerSilentRefresh]);

  const initializeSync = useCallback(async (retryCount = 0) => {
    if (!GOOGLE_CLIENT_ID || (initStartedRef.current && retryCount === 0)) return;
    initStartedRef.current = true;
    
    try {
      setError(null);
      
      // Load Google Identity Services (GIS) script
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
          
          const isSilent = isSilentRefreshRef.current;
          isSilentRefreshRef.current = false;

          if (tokenResponse && tokenResponse.access_token) {
            const token = tokenResponse.access_token;
            accessTokenRef.current = token;
            
            // Google access tokens are valid for expiresInSec (typically 3600 seconds)
            const expiresInSec = Number(tokenResponse.expires_in) || 3600;
            const expiresAt = Date.now() + expiresInSec * 1000;

            localStorage.setItem(ACCESS_TOKEN_KEY, token);
            localStorage.setItem(EXPIRES_AT_KEY, expiresAt.toString());
            localStorage.setItem(SIGNED_IN_KEY, 'true');

            setIsSignedIn(true);
            setNeedsTokenRefresh(false);
            updateSyncStatus('idle');
            setError(null);

            // Fetch profile and schedule seamless renewal
            fetchAndStoreUserProfile(token);
            scheduleBackgroundRefresh(expiresInSec);

            // Notify other hook instances & tabs
            window.dispatchEvent(new CustomEvent(DISCO_AUTH_EVENT, {
              detail: { token, isSignedIn: true }
            }));

            if (signInSuccessCbRef.current && !isSilent) {
              signInSuccessCbRef.current();
            }
          } else if (tokenResponse && tokenResponse.error) {
            if (tokenResponse.error === 'popup_closed_by_user') {
              setError("Sign-in cancelled. Please try again.");
              updateSyncStatus('idle');
            } else if (isSilent) {
              // Silent background refresh encountered a prompt/cookie requirement.
              // We preserve account details (email & preferences) so user stays logged in without interruption.
              console.log("Background token refresh required interaction. Preserving account state.");
              if (!getValidStoredToken()) {
                setNeedsTokenRefresh(true);
              }
            } else {
              handleApiError(tokenResponse, 'auth_callback');
            }
          }
        },
      });

      setIsApiReady(true);

      // Check current auth status:
      const cachedToken = getValidStoredToken();
      if (cachedToken) {
        // We already have a valid token! Compute remaining time and schedule proactive renewal.
        const expiresAtStr = localStorage.getItem(EXPIRES_AT_KEY);
        if (expiresAtStr) {
          const remainingSec = Math.floor((Number(expiresAtStr) - Date.now()) / 1000);
          if (remainingSec > 300) {
            scheduleBackgroundRefresh(remainingSec);
          } else {
            // Less than 5 minutes remaining, renew now in background
            triggerSilentRefresh();
          }
        }
      } else if (localStorage.getItem(SIGNED_IN_KEY) === 'true') {
        // Token is missing or expired, but user previously logged in. Attempt silent renewal.
        const savedEmail = localStorage.getItem(USER_EMAIL_KEY) || undefined;
        isSilentRefreshRef.current = true;
        window.tokenClient.requestAccessToken({ prompt: '', hint: savedEmail });
      }
    } catch (e: any) {
      console.error(`Sync Initialization Failed:`, e);
      initStartedRef.current = false;
      setError("Google services failed to load. Please check your connection.");
      updateSyncStatus('error');
    }
  }, [updateSyncStatus, handleApiError, fetchAndStoreUserProfile, scheduleBackgroundRefresh, triggerSilentRefresh]);

  useEffect(() => {
    initializeSync();
    return () => { 
      if (authTimeoutRef.current) window.clearTimeout(authTimeoutRef.current); 
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
    };
  }, [initializeSync]);

  const signIn = useCallback(async () => {
    updateSyncStatus('authenticating');
    setError(null);

    if (!window.tokenClient) {
      initStartedRef.current = false;
      await initializeSync();
    }

    if (!window.tokenClient) {
      setError("Google Auth failed to initialize. Please check your connection.");
      updateSyncStatus('idle');
      return;
    }

    if (authTimeoutRef.current) window.clearTimeout(authTimeoutRef.current);
    authTimeoutRef.current = window.setTimeout(() => {
      if (syncStatusRef.current === 'authenticating') {
        updateSyncStatus('idle');
        setError("Sign-in timed out. Please check for blocked popups.");
      }
    }, AUTH_TIMEOUT_MS);

    // Provide hint if previously known so Google defaults to the user's selected account
    const savedEmail = localStorage.getItem(USER_EMAIL_KEY);
    const options: any = { prompt: 'select_account' };
    if (savedEmail) {
      options.hint = savedEmail;
    }

    window.tokenClient.requestAccessToken(options);
  }, [updateSyncStatus, initializeSync]);

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

  // Fast metadata check without loading entire file payload
  const getRemoteMetadata = useCallback(async (): Promise<DriveMetadata | null> => {
    if (!isSignedIn) return null;
    try {
      const id = await getOrCreateFileId();
      const metadata = await driveApiFetch(`/drive/v3/files/${id}?fields=id,modifiedTime,version`);
      return {
        id: metadata.id,
        modifiedTime: metadata.modifiedTime,
        version: metadata.version
      };
    } catch (e: any) {
      console.warn("Could not fetch remote metadata:", e);
      return null;
    }
  }, [isSignedIn, getOrCreateFileId, driveApiFetch]);

  const loadData = useCallback(async (): Promise<UnifiedStorage | null> => {
    if (!isSignedIn) return null;
    updateSyncStatus('loading');
    try {
      const id = await getOrCreateFileId();
      
      const activeToken = accessTokenRef.current || getValidStoredToken();
      if (!activeToken) throw new Error("Not authenticated");

      const contentResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, {
        headers: { 'Authorization': `Bearer ${activeToken}` }
      });
      
      if (!contentResponse.ok) throw new Error("Failed to load file content");
      
      const data = await contentResponse.json();
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
      const activeToken = accessTokenRef.current || getValidStoredToken();
      if (!activeToken) throw new Error("Not authenticated");
      
      const uploadResponse = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`, {
        method: 'PATCH',
        headers: { 
          'Authorization': `Bearer ${activeToken}`,
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
      const activeToken = accessTokenRef.current || getValidStoredToken();
      if (!activeToken) throw new Error("Not authenticated");
      
      const contentResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${id}/revisions/${revisionId}?alt=media`, {
        headers: { 'Authorization': `Bearer ${activeToken}` }
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
    const currentToken = accessTokenRef.current || localStorage.getItem(ACCESS_TOKEN_KEY);
    if (currentToken && window.google?.accounts?.oauth2) {
      try {
        window.google.accounts.oauth2.revoke(currentToken, () => clearAuthState());
      } catch (e) {
        clearAuthState();
      }
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

  /**
   * Temporary read-only diagnostic for Plex integration.
   * Searches for 'disco_plex_data.json' in Google Drive without creating or modifying any files.
   * Downloads and parses content as JSON, returning a concise summary without exposing the full album array.
   */
  const checkPlexDataDiagnostic = useCallback(async (): Promise<PlexDiagnosticResult> => {
    const activeToken = accessTokenRef.current || getValidStoredToken();
    if (!activeToken) {
      return {
        success: false,
        fileFound: false,
        error: {
          message: "Not authenticated with Google Drive. Please sign in first.",
          status: 401
        }
      };
    }

    try {
      // Strictly read-only file query (never creates or writes)
      const query = encodeURIComponent(`name = '${PLEX_DATA_FILENAME}' and trashed = false`);
      const listUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&spaces=drive&fields=files(id,name,mimeType,size,modifiedTime)`;
      
      const listResponse = await fetch(listUrl, {
        headers: { 'Authorization': `Bearer ${activeToken}` }
      });

      if (!listResponse.ok) {
        const errorData = await listResponse.json().catch(() => ({}));
        return {
          success: false,
          fileFound: false,
          error: {
            message: errorData.error?.message || listResponse.statusText,
            status: listResponse.status,
            code: errorData.error?.code,
            details: errorData.error
          }
        };
      }

      const listData = await listResponse.json();
      const files = listData.files || [];

      if (files.length === 0) {
        return {
          success: false,
          fileFound: false,
          error: {
            message: `File '${PLEX_DATA_FILENAME}' was not found in Google Drive.`,
            status: 404
          }
        };
      }

      const targetFile = files[0];
      const fileId = targetFile.id;

      // Download file content (read-only)
      const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
      const downloadResponse = await fetch(downloadUrl, {
        headers: { 'Authorization': `Bearer ${activeToken}` }
      });

      if (!downloadResponse.ok) {
        const errorData = await downloadResponse.json().catch(() => ({}));
        return {
          success: false,
          fileFound: true,
          fileId,
          fileName: targetFile.name,
          error: {
            message: errorData.error?.message || downloadResponse.statusText,
            status: downloadResponse.status,
            code: errorData.error?.code,
            details: errorData.error
          }
        };
      }

      const text = await downloadResponse.text();
      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch (parseErr: any) {
        return {
          success: false,
          fileFound: true,
          fileId,
          fileName: targetFile.name,
          error: {
            message: `Failed to parse file contents as JSON: ${parseErr.message}`,
            details: parseErr
          }
        };
      }

      // Extract lightweight diagnostic summary without returning the full payload
      const albumList = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.albums)
        ? parsed.albums
        : Array.isArray(parsed?.items)
        ? parsed.items
        : Array.isArray(parsed?.collection)
        ? parsed.collection
        : [];

      const summary = {
        schemaVersion: parsed?.schemaVersion ?? parsed?.schema_version ?? parsed?.version,
        plexServer: parsed?.plexServer ?? parsed?.server ?? parsed?.serverName,
        libraryName: parsed?.libraryName ?? parsed?.library ?? parsed?.section,
        albumCount: albumList.length,
        modifiedTime: targetFile.modifiedTime || parsed?.lastUpdated || parsed?.updatedAt || parsed?.exportedAt
      };

      return {
        success: true,
        fileFound: true,
        fileId,
        fileName: targetFile.name,
        summary,
        error: null
      };
    } catch (err: any) {
      return {
        success: false,
        fileFound: false,
        error: {
          message: err?.message || String(err),
          status: err?.status,
          details: err
        }
      };
    }
  }, []);

  // Attach to window for direct browser DevTools diagnostic execution
  useEffect(() => {
    (window as any).__discoCheckPlexDiagnostic = checkPlexDataDiagnostic;
    return () => {
      delete (window as any).__discoCheckPlexDiagnostic;
    };
  }, [checkPlexDataDiagnostic]);

  return useMemo(() => ({ 
    isApiReady, isSignedIn, needsTokenRefresh, userProfile, signIn, signOut, loadData, saveData,
    getRevisions, loadRevision, syncStatus, error, lastSyncTime, resetSyncStatus, fetchDriveImages,
    getRemoteMetadata, checkPlexDataDiagnostic
  }), [isApiReady, isSignedIn, needsTokenRefresh, userProfile, signIn, signOut, loadData, saveData, getRevisions, loadRevision, syncStatus, error, lastSyncTime, resetSyncStatus, fetchDriveImages, getRemoteMetadata, checkPlexDataDiagnostic]);
};
