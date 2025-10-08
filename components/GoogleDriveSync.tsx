
import React from 'react';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { SyncStatus } from '../hooks/useGoogleDrive';

interface GoogleDriveSyncProps {
  isApiReady: boolean;
  isSignedIn: boolean;
  signOut: () => void;
  status: SyncStatus;
  error: string | null;
}

const GoogleDriveSync: React.FC<GoogleDriveSyncProps> = ({ isApiReady, isSignedIn, signOut, status, error }) => {
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
                <div className="flex flex-col items-center gap-2 p-2">
                    <SpinnerIcon className="h-6 w-6 text-zinc-400" />
                    <span className="text-sm text-zinc-500 text-center">Connecting to Google Drive...</span>
                </div>
                {status === 'error' && error && (
                  <p className="text-red-600 text-sm max-w-xs text-center">{error}</p>
                )}
            </>
        )}
    </div>
  );
};

export default GoogleDriveSync;