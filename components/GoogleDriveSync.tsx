
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
      <div className="p-1 max-w-sm">
        <h3 className="font-bold text-zinc-800 text-center">Sync Not Configured</h3>
        <p className="mt-2 text-sm text-zinc-600 text-center">
          To enable Google Drive backup, the environment variable for the Client ID must be set in your hosting provider's project settings.
        </p>
        <div className="mt-4 text-sm bg-zinc-100 border border-zinc-200 rounded-md p-3 space-y-2">
          <div>
            <span className="font-semibold text-zinc-700">Variable Name:</span>
            <code className="ml-2 bg-zinc-200 text-zinc-800 text-xs font-mono py-0.5 px-1.5 rounded">
              VITE_GOOGLE_CLIENT_ID
            </code>
          </div>
          <div>
            <span className="font-semibold text-zinc-700">Value:</span>
            <p className="text-zinc-600 text-xs mt-1">
              Your Google OAuth Client ID.
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs text-zinc-500 text-center">
          After adding the variable, you will need to redeploy your application.
        </p>
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
                {error ? (
                    <p className="text-red-600 text-sm max-w-xs text-center">{error}</p>
                ) : (
                    <p className="text-sm text-zinc-600 text-center max-w-xs">
                        Connect to Google Drive to back up your collection automatically.
                    </p>
                )}
                <button
                    onClick={signIn}
                    className="w-full bg-white text-zinc-700 font-medium py-2 px-4 rounded-md border border-zinc-300 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-800 text-sm"
                >
                    {error ? 'Try Again' : 'Connect to Google'}
                </button>
            </>
        )}
    </div>
  );
};

export default GoogleDriveSync;