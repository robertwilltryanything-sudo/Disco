import React from 'react';
import { SyncProvider, SyncMode } from '../types';
import { XIcon } from './icons/XIcon';
import { CheckIcon } from './icons/CheckIcon';

interface SyncSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentProvider: SyncProvider;
    onProviderChange: (provider: SyncProvider) => void;
    syncMode: SyncMode;
    onSyncModeChange: (mode: SyncMode) => void;
}

const ProviderOption: React.FC<{
    title: string;
    description: string;
    isSelected: boolean;
    onSelect: () => void;
    children: React.ReactNode;
}> = ({ title, description, isSelected, onSelect, children }) => (
    <div 
        className={`p-4 border rounded-lg cursor-pointer transition-all duration-200 ${
            isSelected 
                ? 'border-zinc-800 bg-zinc-50 ring-2 ring-zinc-800' 
                : 'border-zinc-300 bg-white hover:border-zinc-500'
        }`}
        onClick={onSelect}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect()}
        role="radio"
        aria-checked={isSelected}
        tabIndex={0}
    >
        <div className="flex justify-between items-start">
            <div>
                <h3 className="font-bold text-zinc-900">{title}</h3>
                <p className="text-sm text-zinc-600 mt-1">{description}</p>
            </div>
            {isSelected && <CheckIcon className="w-6 h-6 text-zinc-800 flex-shrink-0 ml-4" />}
        </div>
        {children}
    </div>
);


const SyncSettingsModal: React.FC<SyncSettingsModalProps> = ({
    isOpen,
    onClose,
    currentProvider,
    onProviderChange,
    syncMode,
    onSyncModeChange,
}) => {
    if (!isOpen) {
        return null;
    }

    const isSupabaseConfigured = !!process.env.VITE_SUPABASE_URL && !!process.env.VITE_SUPABASE_ANON_KEY;

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-60 flex items-start md:items-center justify-center z-50 p-4 overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sync-dialog-title"
        >
            <div className="bg-white rounded-lg border border-zinc-200 w-full max-w-lg relative">
                <div className="p-6 border-b border-zinc-200">
                    <h2 id="sync-dialog-title" className="text-xl font-bold text-zinc-900">Sync & Backup Settings</h2>
                    <p className="text-sm text-zinc-600 mt-1">Choose how you'd like to back up your collection.</p>
                </div>
                
                <div className="p-6 space-y-4">
                    {isSupabaseConfigured && (
                        <ProviderOption
                            title="Supabase Real-time Sync"
                            description="Sync your collection across devices in real-time with a secure user account."
                            isSelected={currentProvider === 'supabase'}
                            onSelect={() => onProviderChange('supabase')}
                        >
                        {currentProvider === 'supabase' && (
                            <div className="mt-4 pt-4 border-t border-zinc-200 space-y-3">
                                <h4 className="text-sm font-bold text-zinc-800">Sync Mode</h4>
                                <div 
                                    onClick={() => onSyncModeChange('realtime')}
                                    className={`p-3 border rounded-lg cursor-pointer flex items-center gap-3 ${syncMode === 'realtime' ? 'border-zinc-500 bg-zinc-100' : 'border-zinc-300'}`}
                                    role="radio"
                                    aria-checked={syncMode === 'realtime'}
                                    tabIndex={0}
                                >
                                    <div className={`w-4 h-4 rounded-full border-2 ${syncMode === 'realtime' ? 'bg-zinc-800 border-zinc-800' : 'border-zinc-400'}`} />
                                    <div>
                                        <p className="font-medium text-zinc-800">Real-time</p>
                                        <p className="text-xs text-zinc-600">Changes sync automatically and instantly.</p>
                                    </div>
                                </div>
                                    <div 
                                    onClick={() => onSyncModeChange('manual')}
                                    className={`p-3 border rounded-lg cursor-pointer flex items-center gap-3 ${syncMode === 'manual' ? 'border-zinc-500 bg-zinc-100' : 'border-zinc-300'}`}
                                    role="radio"
                                    aria-checked={syncMode === 'manual'}
                                    tabIndex={0}
                                >
                                    <div className={`w-4 h-4 rounded-full border-2 ${syncMode === 'manual' ? 'bg-zinc-800 border-zinc-800' : 'border-zinc-400'}`} />
                                        <div>
                                        <p className="font-medium text-zinc-800">On Demand</p>
                                        <p className="text-xs text-zinc-600">Click the sync button to get new updates.</p>
                                    </div>
                                </div>
                            </div>
                        )}
                        </ProviderOption>
                    )}
                    
                     <ProviderOption
                        title="No Sync (Local Only)"
                        description="Your collection will only be saved on this device in this browser. Use manual import/export for backups."
                        isSelected={currentProvider === 'none'}
                        onSelect={() => onProviderChange('none')}
                    >
                         {currentProvider === 'none' && (
                           <p className="text-sm text-center text-zinc-500 p-2 mt-2">Sync is disabled.</p>
                         )}
                    </ProviderOption>
                </div>
                
                <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex justify-end">
                    <button
                        onClick={onClose}
                        className="bg-zinc-900 text-white font-bold py-2 px-4 rounded-lg hover:bg-black"
                    >
                        Done
                    </button>
                </div>

                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 p-2 rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-500"
                    aria-label="Close settings"
                >
                    <XIcon className="w-6 h-6" />
                </button>
            </div>
        </div>
    );
};

export default SyncSettingsModal;