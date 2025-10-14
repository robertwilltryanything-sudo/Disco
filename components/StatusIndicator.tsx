import React from 'react';
import { SyncStatus } from '../types';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { UploadIcon } from './icons/UploadIcon';
import { CheckIcon } from './icons/CheckIcon';
import { XCircleIcon } from './icons/XCircleIcon';

interface StatusIndicatorProps {
  status: SyncStatus;
  error: string | null;
}

// FIX: Added the 'authenticating' state to cover all sync statuses and made the 'idle' tooltip more generic.
const statusMap: { [key in SyncStatus]: { icon: React.FC<any>; text: string; color: string; tooltip: string } } = {
  idle: { icon: UploadIcon, text: 'Idle', color: 'text-zinc-500', tooltip: 'Signed out from sync provider.' },
  loading: { icon: SpinnerIcon, text: 'Loading', color: 'text-blue-500', tooltip: 'Loading collection from the cloud...' },
  saving: { icon: SpinnerIcon, text: 'Saving', color: 'text-blue-500', tooltip: 'Saving changes to the cloud...' },
  synced: { icon: CheckIcon, text: 'Synced', color: 'text-green-500', tooltip: 'Your collection is synced with the cloud.' },
  error: { icon: XCircleIcon, text: 'Error', color: 'text-red-500', tooltip: 'An error occurred during sync.' },
  disabled: { icon: XCircleIcon, text: 'Disabled', color: 'text-zinc-400', tooltip: 'Sync is disabled because it has not been configured.' },
  authenticating: { icon: SpinnerIcon, text: 'Authenticating', color: 'text-blue-500', tooltip: 'Authenticating...' },
};

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status, error }) => {
  const { icon: Icon, color, tooltip } = statusMap[status];
  // Show the specific error message from the hook for 'error' and 'disabled' states.
  const finalTooltip = (status === 'error' || status === 'disabled') && error ? error : tooltip;
  
  return (
    <div className="relative group flex items-center">
      <Icon className={`h-6 w-6 ${color}`} />
      <div className="absolute bottom-full right-1/2 translate-x-1/2 mb-2 w-max max-w-xs bg-zinc-800 text-white text-sm rounded-md py-1 px-2 opacity-0 group-hover:opacity-100 pointer-events-none z-20">
        {finalTooltip}
      </div>
    </div>
  );
};

export default StatusIndicator;