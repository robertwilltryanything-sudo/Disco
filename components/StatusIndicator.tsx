import React from 'react';
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
  saving: { icon: SpinnerIcon, color: 'text-blue-500', tooltip: 'Saving...', driveTooltip: 'Uploading to Drive...' },
  synced: { icon: CheckIcon, color: 'text-green-500', tooltip: 'Synced.', driveTooltip: 'Cloud backup is up to date.' },
  error: { icon: XCircleIcon, color: 'text-red-500', tooltip: 'Error.', driveTooltip: 'Drive Sync Error.' },
  disabled: { icon: XCircleIcon, color: 'text-zinc-400', tooltip: 'Not configured.', driveTooltip: 'Not configured.' },
  authenticating: { icon: SpinnerIcon, color: 'text-blue-500', tooltip: 'Authenticating...', driveTooltip: 'Signing in to Google...' },
};

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status, error, syncProvider, syncMode, onManualSync }) => {
  const isGoogleDrive = syncProvider === 'google_drive';
  
  const currentStatusInfo = statusMap[status];
  
  // Use a stable checkmark for synced state. Only show SyncIcon for errors or as a fallback.
  // We avoid using SyncIcon for 'synced' to prevent flickering.
  const Icon = status === 'synced' ? CheckIcon : 
               (status === 'loading' || status === 'saving' || status === 'authenticating') ? SpinnerIcon :
               (status === 'error' && isGoogleDrive) ? SyncIcon : 
               currentStatusInfo.icon;

  const color = currentStatusInfo.color;

  let finalTooltip = isGoogleDrive ? currentStatusInfo.driveTooltip : currentStatusInfo.tooltip;
  
  if ((status === 'error' || status === 'disabled') && error) {
    finalTooltip = error;
  }

  // Visual indicator for manual vs realtime if synced
  const modeLabel = syncMode === 'manual' ? ' (Manual)' : '';
  if (status === 'synced') finalTooltip += modeLabel;

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
        <Icon className={`h-5 w-5 ${color} ${status === 'loading' || status === 'saving' ? 'animate-spin' : ''}`} />
      </button>
      {status === 'synced' && (
        <span className="hidden lg:inline text-[10px] font-bold text-green-600 ml-1 uppercase tracking-tighter">Synced</span>
      )}
    </div>
  );
};

export default StatusIndicator;