
import React from 'react';
import { CloudIcon } from './icons/CloudIcon';
import { ComputerDesktopIcon } from './icons/ComputerDesktopIcon';

interface SyncConflictModalProps {
  isOpen: boolean;
  onResolve: (strategy: 'cloud' | 'local') => void;
  lastCloudTime: string | null;
}

const SyncConflictModal: React.FC<SyncConflictModalProps> = ({ isOpen, onResolve, lastCloudTime }) => {
  if (!isOpen) return null;

  const formattedCloudTime = lastCloudTime ? new Date(lastCloudTime).toLocaleString() : 'Recently';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-xl border border-zinc-200 shadow-2xl max-w-xl w-full p-8">
        <div className="flex items-center gap-3 text-red-600 mb-4">
          <CloudIcon className="w-8 h-8" />
          <h2 className="text-2xl font-bold">Sync Conflict Detected</h2>
        </div>
        
        <p className="text-zinc-600 mb-6">
          A newer version of your collection was found on Google Drive (last updated {formattedCloudTime}).
          Someone else or another device has saved changes. How would you like to proceed?
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => onResolve('cloud')}
            className="flex flex-col items-center gap-3 p-6 border-2 border-zinc-100 rounded-xl hover:border-zinc-900 transition-all text-center"
          >
            <CloudIcon className="w-10 h-10 text-blue-600" />
            <div>
              <span className="block font-bold text-zinc-900">Use Cloud Version</span>
              <span className="text-xs text-zinc-500">Pulls latest updates to this device</span>
            </div>
          </button>

          <button
            onClick={() => onResolve('local')}
            className="flex flex-col items-center gap-3 p-6 border-2 border-zinc-100 rounded-xl hover:border-zinc-900 transition-all text-center"
          >
            <ComputerDesktopIcon className="w-10 h-10 text-zinc-700" />
            <div>
              <span className="block font-bold text-zinc-900">Keep Local Version</span>
              <span className="text-xs text-zinc-500">Overwrites the cloud with current data</span>
            </div>
          </button>
        </div>

        <p className="mt-6 text-[10px] text-zinc-400 text-center uppercase tracking-widest">
          Version control allows you to restore any version later if you make a mistake.
        </p>
      </div>
    </div>
  );
};

export default SyncConflictModal;
