import React from 'react';
import { CollectionData } from '../types';
import { CloudIcon } from './icons/CloudIcon';
import { ComputerDesktopIcon } from './icons/ComputerDesktopIcon';

interface SyncConflictModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResolve: (useCloudVersion: boolean) => void;
  conflictData: {
    local: CollectionData;
    cloud: CollectionData;
  };
}

const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
};

const VersionCard: React.FC<{
    title: string,
    timestamp: string | null,
    onSelect: () => void,
    children: React.ReactNode
}> = ({ title, timestamp, onSelect, children }) => (
    <div className="border border-zinc-200 rounded-lg p-4 flex-1">
        <div className="flex items-center gap-2 text-lg font-bold text-zinc-800">
            {children}
            <h3>{title}</h3>
        </div>
        <p className="text-sm text-zinc-600 mt-1">
            Last Updated: <span className="font-medium text-zinc-800">{formatDate(timestamp)}</span>
        </p>
        <button
            onClick={onSelect}
            className="mt-4 w-full bg-zinc-900 text-white font-bold py-2 px-4 rounded-lg hover:bg-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900"
        >
            Keep This Version
        </button>
    </div>
);


const SyncConflictModal: React.FC<SyncConflictModalProps> = ({ isOpen, onClose, onResolve, conflictData }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="conflict-dialog-title"
    >
      <div className="bg-white rounded-lg border border-zinc-200 p-6 m-4 max-w-2xl w-full">
        <h2 id="conflict-dialog-title" className="text-xl font-bold text-zinc-800">Sync Conflict Detected</h2>
        <p className="mt-2 text-zinc-600">
          The version of your collection in the cloud is newer than your local version. This can happen if you've made changes on another device.
        </p>
        <p className="mt-1 text-zinc-600">
          Please choose which version you want to keep.
        </p>

        <div className="mt-6 flex flex-col md:flex-row gap-4">
            <VersionCard 
                title="Cloud Version"
                timestamp={conflictData.cloud.lastUpdated}
                onSelect={() => onResolve(true)}
            >
                <CloudIcon className="w-6 h-6" />
            </VersionCard>

            <VersionCard 
                title="Local Version"
                timestamp={conflictData.local.lastUpdated}
                onSelect={() => onResolve(false)}
            >
                <ComputerDesktopIcon className="w-6 h-6" />
            </VersionCard>
        </div>

        <div className="mt-6 flex justify-center">
          <button
            onClick={onClose}
            className="py-2 px-4 rounded-lg bg-white text-zinc-700 font-medium border border-zinc-300 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-800"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default SyncConflictModal;