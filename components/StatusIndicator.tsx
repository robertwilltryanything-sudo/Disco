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
  syncMode: SyncMode;
  onManualSync: () => void;
}

const statusMap: { [key in SyncStatus]: { icon: React.FC<any>; color: string; realtimeTooltip: string; manualTooltip: string; driveTooltip: string } } = {
  idle: { icon: UploadIcon, color: 'text-zinc-500', realtimeTooltip: 'Signed out.', manualTooltip: 'Signed out.', driveTooltip: 'Signed out.' },
  loading: { icon: SpinnerIcon, color: 'text-blue-500', realtimeTooltip: 'Loading...', manualTooltip: 'Syncing...', driveTooltip: 'Downloading from Drive...' },
  saving: { icon: SpinnerIcon, color: 'text-blue-500', realtimeTooltip: 'Saving...', manualTooltip: 'Saving...', driveTooltip: 'Uploading to Drive...' },
  synced: { icon: CheckIcon, color: 'text-green-500', realtimeTooltip: 'Up to date.', manualTooltip: 'Synced.', driveTooltip: 'Drive is up to date.' },
  error: { icon: XCircleIcon, color: 'text-red-500', realtimeTooltip: 'Sync Error.', manualTooltip: 'Sync Error.', driveTooltip: 'Drive Sync Error.' },
  disabled: { icon: XCircleIcon, color: 'text-zinc-400', realtimeTooltip: 'Not configured.', manualTooltip: 'Not configured.', driveTooltip: 'Not configured.' },
  authenticating: { icon: SpinnerIcon, color: 'text-blue-500', realtimeTooltip: 'Authenticating...', manualTooltip: 'Authenticating...', driveTooltip: 'Signing in to Google...' },
};

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status, error, syncProvider, syncMode, onManualSync }) => {
  const isManualMode = syncProvider === 'supabase' && syncMode === 'manual';
  const isGoogleDrive = syncProvider === 'google_drive';
  
  const currentStatusInfo = statusMap[status];
  const Icon = (isManualMode && (status === 'synced' || status === 'idle' || status === 'error')) ? SyncIcon : currentStatusInfo.icon;
  const color = currentStatusInfo.color;

  let finalTooltip: string;
  if (isGoogleDrive) {
    finalTooltip = currentStatusInfo.driveTooltip;
  } else if (isManualMode) {
    finalTooltip = currentStatusInfo.manualTooltip;
  } else {
    finalTooltip = currentStatusInfo.realtimeTooltip;
  }
  
  if ((status === 'error' || status === 'disabled') && error) {
    finalTooltip = error;
  }

  const isClickable = (isManualMode || isGoogleDrive) && status !== 'loading' && status !== 'saving' && status !== 'authenticating';

  return (
    <div className="relative group flex items-center">
      <button
        onClick={isClickable ? onManualSync : undefined}
        disabled={!isClickable}
        className={`p-1 rounded-full focus:outline-none focus:ring-2 focus:ring-zinc-800 ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
        aria-label={finalTooltip}
        title={finalTooltip}
      >
        <Icon className={`h-6 w-6 ${color}`} />
      </button>
    </div>
  );
};

export default StatusIndicator;