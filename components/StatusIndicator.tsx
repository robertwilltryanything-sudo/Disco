import React, { useMemo } from 'react';
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

const statusMap: { [key in SyncStatus]: { color: string; tooltip: string; driveTooltip: string; label?: string } } = {
  idle: { color: 'text-zinc-400', tooltip: 'Sync idle.', driveTooltip: 'Signed out.' },
  loading: { color: 'text-blue-500', tooltip: 'Downloading...', driveTooltip: 'Syncing from Cloud...', label: 'Updating' },
  saving: { color: 'text-blue-500', tooltip: 'Uploading...', driveTooltip: 'Syncing to Cloud...', label: 'Saving' },
  synced: { color: 'text-green-500', tooltip: 'Synced.', driveTooltip: 'Cloud backup up to date.', label: 'Synced' },
  error: { color: 'text-red-500', tooltip: 'Error.', driveTooltip: 'Drive Sync Error. Click to try again.', label: 'Error' },
  disabled: { color: 'text-zinc-300', tooltip: 'Not configured.', driveTooltip: 'Not configured.' },
  authenticating: { color: 'text-blue-500', tooltip: 'Authenticating...', driveTooltip: 'Signing in to Google...', label: 'Connecting' },
};

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status, error, syncProvider, onManualSync }) => {
  const isGoogleDrive = syncProvider === 'google_drive';
  const currentStatusInfo = statusMap[status] || statusMap.idle;
  
  const isBusy = status === 'loading' || status === 'saving' || status === 'authenticating';
  const isError = status === 'error';
  const isSynced = status === 'synced';

  // Memoize icon selection to prevent flickering during rapid state transitions
  const Icon = useMemo(() => {
    if (isError) return XCircleIcon;
    if (isSynced) return CheckIcon;
    if (isBusy) return SpinnerIcon;
    return SyncIcon;
  }, [isError, isSynced, isBusy]);

  const color = currentStatusInfo.color;

  let finalTooltip = isGoogleDrive ? currentStatusInfo.driveTooltip : currentStatusInfo.tooltip;
  if ((status === 'error' || status === 'disabled') && error) {
    finalTooltip = error;
  }

  const isClickable = isGoogleDrive && !isBusy;

  return (
    <div className="relative group flex items-center h-8 bg-zinc-50 px-2 rounded-full border border-zinc-100">
      <button
        type="button"
        onClick={isClickable ? onManualSync : undefined}
        disabled={!isClickable}
        className={`p-1 rounded-full transition-all duration-300 focus:outline-none ${isClickable ? 'hover:bg-zinc-200 cursor-pointer' : 'cursor-default'}`}
        aria-label={finalTooltip}
        title={finalTooltip}
      >
        <Icon className={`h-4 w-4 md:h-5 md:w-5 ${color} ${isBusy ? 'animate-spin' : ''} transition-all duration-500 ease-in-out`} />
      </button>
      
      {currentStatusInfo.label && (
        <span className={`hidden md:inline text-[10px] font-bold ml-1.5 uppercase tracking-tighter transition-all duration-300 ${color} ${isBusy ? 'animate-pulse' : ''}`}>
          {currentStatusInfo.label}
          {isBusy && '...'}
        </span>
      )}
    </div>
  );
};

export default React.memo(StatusIndicator);