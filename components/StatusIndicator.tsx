
// Add missing React import
import React from 'react';
import { SyncStatus, SyncProvider, SyncMode } from '../types';
import { SpinnerIcon } from './icons/SpinnerIcon';
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

const statusMap: { [key in SyncStatus]: { color: string; tooltip: string; driveTooltip: string } } = {
  idle: { color: 'text-zinc-400', tooltip: 'Sync idle.', driveTooltip: 'Signed out.' },
  loading: { color: 'text-blue-500', tooltip: 'Downloading...', driveTooltip: 'Downloading latest from Drive...' },
  saving: { color: 'text-blue-500', tooltip: 'Uploading...', driveTooltip: 'Syncing changes to Drive...' },
  synced: { color: 'text-green-500', tooltip: 'Synced.', driveTooltip: 'Cloud backup is up to date. Click to force refresh.' },
  error: { color: 'text-red-500', tooltip: 'Error.', driveTooltip: 'Drive Sync Error. Click to try again.' },
  disabled: { color: 'text-zinc-300', tooltip: 'Not configured.', driveTooltip: 'Not configured.' },
  authenticating: { color: 'text-blue-500', tooltip: 'Authenticating...', driveTooltip: 'Signing in to Google...' },
};

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status, error, syncProvider, onManualSync }) => {
  const isGoogleDrive = syncProvider === 'google_drive';
  const currentStatusInfo = statusMap[status] || statusMap.idle;
  
  const isBusy = status === 'loading' || status === 'saving' || status === 'authenticating';
  const isError = status === 'error';
  const isSynced = status === 'synced';

  // Use a stable icon approach to prevent flickering during rapid state changes
  const Icon = isError ? XCircleIcon : isSynced ? CheckIcon : isBusy ? SpinnerIcon : SyncIcon;
  const color = currentStatusInfo.color;

  let finalTooltip = isGoogleDrive ? currentStatusInfo.driveTooltip : currentStatusInfo.tooltip;
  if ((status === 'error' || status === 'disabled') && error) {
    finalTooltip = error;
  }

  const isClickable = isGoogleDrive && !isBusy;

  return (
    <div className="relative group flex items-center">
      <button
        onClick={isClickable ? onManualSync : undefined}
        disabled={!isClickable}
        className={`p-1 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-zinc-800 ${isClickable ? 'hover:bg-zinc-100 cursor-pointer' : 'cursor-default'}`}
        aria-label={finalTooltip}
        title={finalTooltip}
      >
        <Icon className={`h-5 w-5 ${color} ${isBusy ? 'animate-spin' : ''} transition-transform duration-500`} />
      </button>
      {status === 'synced' && (
        <span className="hidden lg:inline text-[10px] font-bold text-green-600 ml-1 uppercase tracking-tighter animate-pulse">Synced</span>
      )}
    </div>
  );
};

export default StatusIndicator;