

import React from 'react';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { SyncStatus } from '../hooks/useGoogleDrive';

interface GoogleDriveSyncProps {
  isApiReady: boolean;
  isSignedIn: boolean;
  signIn: () => void;
  signOut: () => void;
  status: SyncStatus;
  error: string | null;
}

const GoogleDriveSync: React.FC<GoogleDriveSyncProps> = ({ isApiReady, isSignedIn, signIn, signOut, status, error }) => {
  // New state to handle when sync is not configured.
  if (status === 'disabled') {
    return (
        <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-zinc-600 text-center max-w-xs">
                Google Drive sync is not configured.
            </p>
            {error && (
                <p className="text-yellow-700 bg-yellow-50 p-3 rounded-md text-xs max-w-xs text-center mt-1 border border-yellow-200">
                    {error}
                </p>
            )}
        </div>
    );
  }

  if (!isApiReady) {
    return (
        <div className="flex flex-col items-center gap-2 p-2">
            <SpinnerIcon className="h-6 w-6 text-zinc-400" />
            <span className="text-sm text-zinc-500">Initializing Sync...</span>
        </div>
    );
  }
  
  return (
    <div className="flex flex-col items-center gap-3">
        {isSignedIn ? (
            <>
                <p className="text-sm text-zinc-600 text-center max-w-xs">
                    Sync is active. Your collection is backed up to Google Drive.
                </p>
                <button
                    onClick={signOut}
                    className="w-full bg-white text-zinc-700 font-medium py-2 px-4 rounded-md border border-zinc-300 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-800 text-sm"
                >
                    Sign Out
                </button>
            </>
        ) : (
            <>
                <p className="text-sm text-zinc-600 text-center max-w-xs">
                    Sign in to back up your collection to Google Drive.
                </p>
                 <button
                    onClick={signIn}
                    className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                    Sign In to Google Drive
                </button>
                {status === 'error' && error && (
                  <p className="text-red-600 text-sm max-w-xs text-center mt-2">{error}</p>
                )}
                 {status !== 'error' && !error && (
                    <div className="flex items-center gap-2 p-2">
                        <SpinnerIcon className="h-4 w-4 text-zinc-400" />
                        <span className="text-xs text-zinc-500 text-center">Waiting for sign in...</span>
                    </div>
                 )}
            </>
        )}
    </div>
  );
};

export default GoogleDriveSync;