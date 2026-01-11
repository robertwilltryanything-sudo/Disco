
import React, { useState, useEffect } from 'react';
import { SyncStatus, SyncProvider, SyncMode } from '../types';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { UploadIcon } from './icons/UploadIcon';
import { CheckIcon } from './icons/CheckIcon';
import { XCircleIcon } from './icons/XCircleIcon';
import { SyncIcon } from './icons/SyncIcon';

interface StatusIndicatorProps {
  status: SyncStatus;
  error: string | null;
  syncProvider: SyncProvider;
  syncMode?: SyncMode;
  onManualSync: () => void;
}

const statusMap: { [key in SyncStatus]: { icon: React.FC<any>; color: string; tooltip: string; driveTooltip: string } } = {
  idle: { icon: UploadIcon, color: 'text-zinc-500', tooltip: 'Sync idle.', driveTooltip: 'Signed out.' },
  loading: { icon: SpinnerIcon, color: 'text-blue-500', tooltip: 'Loading...', driveTooltip: 'Downloading from Drive...' },
  saving: { icon: SpinnerIcon, color: 'text-blue-500', tooltip: 'Saving...', driveTooltip: 'Syncing changes to Drive...' },
  synced: { icon: CheckIcon, color: 'text-green-500', tooltip: 'Synced.', driveTooltip: 'Cloud backup is up to date.' },
  error: { icon: XCircleIcon, color: 'text-red-500', tooltip: 'Error.', driveTooltip: 'Drive Sync Error.' },
  disabled: { icon: XCircleIcon, color: 'text-zinc-400', tooltip: 'Not configured.', driveTooltip: 'Not configured.' },
  authenticating: { icon: SpinnerIcon, color: 'text-blue-500', tooltip: 'Authenticating...', driveTooltip: 'Signing in to Google...' },
};

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status, error, syncProvider, syncMode, onManualSync }) => {
  const isGoogleDrive = syncProvider === 'google_drive';
  const isRealtime = syncMode === 'realtime';
  
  // Local state to prevent "saving" flicker on every minor change
  const [displayStatus, setDisplayStatus] = useState<SyncStatus>(status);

  useEffect(() => {
    // If it's a real-time save and we were already synced, don't show the spinner unless it takes > 800ms
    if (status === 'saving' && displayStatus === 'synced' && isRealtime) {
      const timer = setTimeout(() => setDisplayStatus('saving'), 800);
      return () => clearTimeout(timer);
    }
    
    // Otherwise update immediately
    setDisplayStatus(status);
  }, [status, displayStatus, isRealtime]);

  const currentStatusInfo = statusMap[displayStatus];
  
  const Icon = displayStatus === 'synced' ? CheckIcon : 
               (displayStatus === 'loading' || displayStatus === 'saving' || displayStatus === 'authenticating') ? SpinnerIcon :
               (displayStatus === 'error' && isGoogleDrive) ? SyncIcon : 
               currentStatusInfo.icon;

  const color = currentStatusInfo.color;

  let finalTooltip = isGoogleDrive ? currentStatusInfo.driveTooltip : currentStatusInfo.tooltip;
  
  if ((status === 'error' || status === 'disabled') && error) {
    finalTooltip = error;
  }

  const isClickable = isGoogleDrive && status !== 'loading' && status !== 'saving' && status !== 'authenticating';

  return (
    <div className="relative group flex items-center">
      <button
        onClick={isClickable ? onManualSync : undefined}
        disabled={!isClickable}
        className={`p-1 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-zinc-800 ${isClickable ? 'hover:bg-zinc-100 cursor-pointer' : 'cursor-default'}`}
        aria-label={finalTooltip}
        title={finalTooltip}
      >
        <Icon className={`h-5 w-5 ${color} ${displayStatus === 'loading' || displayStatus === 'saving' ? 'animate-spin' : ''}`} />
      </button>
      {displayStatus === 'synced' && (
        <span className="hidden lg:inline text-[10px] font-bold text-green-600 ml-1 uppercase tracking-tighter">Synced</span>
      )}
    </div>
  );
};

export default StatusIndicator;
