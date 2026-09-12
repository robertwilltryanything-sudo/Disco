import React from 'react';
import { CheckIcon } from './icons/CheckIcon';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { GoogleDriveIcon } from './icons/GoogleDriveIcon';
import { XIcon } from './icons/XIcon';

interface AutoSyncBannerProps {
  notification: {
    type: 'syncing' | 'synced' | 'downloaded' | 'error';
    message: string;
    details?: string;
  } | null;
  onDismiss: () => void;
}

export const AutoSyncBanner: React.FC<AutoSyncBannerProps> = ({ notification, onDismiss }) => {
  if (!notification) return null;

  const isSyncing = notification.type === 'syncing';
  const isError = notification.type === 'error';
  const isDownloaded = notification.type === 'downloaded';

  let bgClasses = 'bg-zinc-900 text-white border-zinc-700';
  let icon = <CheckIcon className="w-4 h-4 text-emerald-400 shrink-0" />;

  if (isSyncing) {
    bgClasses = 'bg-zinc-900 text-white border-zinc-700';
    icon = <SpinnerIcon className="w-4 h-4 text-blue-400 animate-spin shrink-0" />;
  } else if (isError) {
    bgClasses = 'bg-red-900/90 text-white border-red-700';
    icon = <XIcon className="w-4 h-4 text-red-300 shrink-0" />;
  } else if (isDownloaded) {
    bgClasses = 'bg-zinc-900 text-white border-blue-500/50';
    icon = <GoogleDriveIcon className="w-4 h-4 text-emerald-400 shrink-0" />;
  }

  return (
    <div 
      className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 pointer-events-auto"
      role="status"
      aria-live="polite"
    >
      <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-full shadow-2xl border backdrop-blur-md text-xs font-medium ${bgClasses}`}>
        {icon}
        <span className="truncate max-w-[260px] sm:max-w-xs">{notification.message}</span>
        {notification.details && (
          <span className="text-[10px] text-zinc-400 border-l border-zinc-700 pl-2">
            {notification.details}
          </span>
        )}
        <button 
          onClick={onDismiss}
          className="ml-1 p-0.5 rounded-full text-zinc-400 hover:text-white transition-colors"
          title="Dismiss"
        >
          <XIcon className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
