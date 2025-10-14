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

const statusMap: { [key in SyncStatus]: { icon: React.FC<any>; color: string; realtimeTooltip: string; manualTooltip: string } } = {
  idle: { icon: UploadIcon, color: 'text-zinc-500', realtimeTooltip: 'Signed out from sync provider.', manualTooltip: 'Signed out. Sign in to sync.' },
  loading: { icon: SpinnerIcon, color: 'text-blue-500', realtimeTooltip: 'Loading collection from the cloud...', manualTooltip: 'Syncing collection from the cloud...' },
  saving: { icon: SpinnerIcon, color: 'text-blue-500', realtimeTooltip: 'Saving changes to the cloud...', manualTooltip: 'Saving changes to the cloud...' },
  synced: { icon: CheckIcon, color: 'text-green-500', realtimeTooltip: 'Your collection is up to date.', manualTooltip: 'Collection is up to date. Click to sync again.' },
  error: { icon: XCircleIcon, color: 'text-red-500', realtimeTooltip: 'An error occurred during sync.', manualTooltip: 'An error occurred. Click to try again.' },
  disabled: { icon: XCircleIcon, color: 'text-zinc-400', realtimeTooltip: 'Sync is disabled because it has not been configured.', manualTooltip: 'Sync is disabled because it has not been configured.' },
  authenticating: { icon: SpinnerIcon, color: 'text-blue-500', realtimeTooltip: 'Authenticating...', manualTooltip: 'Authenticating...' },
};

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status, error, syncProvider, syncMode, onManualSync }) => {
  const isManualMode = syncProvider === 'supabase' && syncMode === 'manual';
  
  const currentStatusInfo = statusMap[status];
  const Icon = (isManualMode && (status === 'synced' || status === 'idle' || status === 'error')) ? SyncIcon : currentStatusInfo.icon;
  const color = currentStatusInfo.color;

  let finalTooltip: string;
  if (isManualMode) {
    finalTooltip = currentStatusInfo.manualTooltip;
  } else {
    finalTooltip = currentStatusInfo.realtimeTooltip;
  }
  
  if ((status === 'error' || status === 'disabled') && error) {
    finalTooltip = error;
  }

  const isClickable = isManualMode && status !== 'loading' && status !== 'saving' && status !== 'authenticating';

  return (
    <div className="relative group flex items-center">
      <button
        onClick={isClickable ? onManualSync : undefined}
        disabled={!isClickable}
        className={`p-1 rounded-full focus:outline-none focus:ring-2 focus:ring-zinc-800 ${isClickable ? 'cursor-pointer hover:bg-zinc-100' : 'cursor-default'}`}
        aria-label={finalTooltip}
      >
        <Icon className={`h-6 w-6 ${color}`} />
      </button>
      <div className="absolute bottom-full right-1/2 translate-x-1/2 mb-2 w-max max-w-xs bg-zinc-800 text-white text-sm rounded-md py-1 px-2 opacity-0 group-hover:opacity-100 pointer-events-none z-20">
        {finalTooltip}
      </div>
    </div>
  );
};

export default StatusIndicator;