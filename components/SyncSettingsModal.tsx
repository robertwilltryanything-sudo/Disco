import React from 'react';
import { SyncProvider } from '../types';
import { XIcon } from './icons/XIcon';
import { CheckIcon } from './icons/CheckIcon';

interface SyncSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentProvider: SyncProvider;
    onProviderChange: (provider: SyncProvider) => void;
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
        {isSelected && <div className="mt-4">{children}</div>}
    </div>
);


const SyncSettingsModal: React.FC<SyncSettingsModalProps> = ({
    isOpen,
    onClose,
    currentProvider,
    onProviderChange,
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
                     <ProviderOption
                        title="Supabase Real-time Sync"
                        description="Sync your collection across devices in real-time with a secure user account."
                        isSelected={currentProvider === 'supabase'}
                        onSelect={() => onProviderChange('supabase')}
                    >
                        {!isSupabaseConfigured ? (
                             <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                                This option is not configured by the site administrator. Please set the <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> environment variables.
                            </div>
                        ) : (
                            <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800 flex items-center gap-3">
                                <CheckIcon className="w-5 h-5 text-green-600 flex-shrink-0" />
                                <span>Supabase is configured. Your data will sync in real-time when you are signed in.</span>
                            </div>
                        )}
                    </ProviderOption>
                    
                     <ProviderOption
                        title="No Sync (Local Only)"
                        description="Your collection will only be saved on this device in this browser. Use manual import/export for backups."
                        isSelected={currentProvider === 'none'}
                        onSelect={() => onProviderChange('none')}
                    >
                        <p className="text-sm text-center text-zinc-500 p-2">Sync is disabled.</p>
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