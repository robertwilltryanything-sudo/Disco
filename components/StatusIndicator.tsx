import React, { useMemo } from 'react';
import { SyncStatus, SyncProvider } from '../types';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { CheckIcon } from './icons/CheckIcon';
import { XCircleIcon } from './icons/XCircleIcon';
import { SyncIcon } from './icons/SyncIcon';

interface StatusIndicatorProps {
  status: SyncStatus;
  error: string | null;
  syncProvider: SyncProvider;
  onManualSync: () => void;
  lastSyncTime?: string | null;
}

const statusMap: { [key in SyncStatus]: { color: string; tooltip: string; driveTooltip: string; label?: string } } = {
  idle: { color: 'text-zinc-400', tooltip: 'Sync ready.', driveTooltip: 'Cloud connection ready.' },
  loading: { color: 'text-blue-500', tooltip: 'Downloading...', driveTooltip: 'Pulling from cloud...', label: 'Loading' },
  saving: { color: 'text-blue-500', tooltip: 'Uploading...', driveTooltip: 'Pushing to cloud...', label: 'Saving' },
  synced: { color: 'text-green-500', tooltip: 'Cloud updated.', driveTooltip: 'Cloud updated.', label: 'Active' },
  error: { color: 'text-red-500', tooltip: 'Error.', driveTooltip: 'Sync Error.', label: 'Error' },
  disabled: { color: 'text-zinc-300', tooltip: 'Not configured.', driveTooltip: 'Not configured.' },
  authenticating: { color: 'text-blue-500', tooltip: 'Authenticating...', driveTooltip: 'Signing in...', label: 'Connecting' },
};

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status, error, syncProvider, lastSyncTime }) => {
  const isGoogleDrive = syncProvider === 'google_drive';
  const currentStatusInfo = statusMap[status] || statusMap.idle;
  
  const isBusy = status === 'loading' || status === 'saving' || status === 'authenticating';
  const isError = status === 'error';
  const isSynced = status === 'synced';

  const Icon = useMemo(() => {
    if (isError) return XCircleIcon;
    if (isSynced) return CheckIcon;
    if (isBusy) return SpinnerIcon;
    return SyncIcon;
  }, [isError, isSynced, isBusy]);

  const color = currentStatusInfo.color;

  const timeLabel = useMemo(() => {
    if (!lastSyncTime) return '';
    const date = new Date(lastSyncTime);
    const diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return 'now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [lastSyncTime, status]);

  let finalTooltip = isGoogleDrive ? currentStatusInfo.driveTooltip : currentStatusInfo.tooltip;
  if (isSynced && lastSyncTime) {
      finalTooltip = `Last cloud action: ${new Date(lastSyncTime).toLocaleString()}`;
  }
  if (error) {
    finalTooltip = error;
  }

  return (
    <div className="relative flex items-center h-8 bg-zinc-50 px-2 rounded-full border border-zinc-100" title={finalTooltip}>
      <div className={`p-1 rounded-full ${isBusy ? 'animate-spin' : ''}`}>
        <Icon className={`h-4 w-4 md:h-5 md:w-5 ${color} transition-all duration-500`} />
      </div>
      
      <div className="flex flex-col items-start ml-1 leading-none mr-1">
          <span className={`hidden md:inline text-[9px] font-black uppercase tracking-tighter transition-all duration-300 ${color}`}>
            {currentStatusInfo.label || 'Drive'}
          </span>
          {isSynced && lastSyncTime && (
              <span className="hidden md:inline text-[8px] text-zinc-400 font-bold uppercase">
                  {timeLabel}
              </span>
          )}
      </div>
    </div>
  );
};

export default React.memo(StatusIndicator);