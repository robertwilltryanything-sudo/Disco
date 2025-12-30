import React, { useState } from 'react';
import { SyncProvider, SyncMode } from '../types';
import { XIcon } from './icons/XIcon';
import { CheckIcon } from './icons/CheckIcon';
import { GlobeIcon } from './icons/GlobeIcon';
import { QuestionMarkCircleIcon } from './icons/QuestionMarkCircleIcon';

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
    isDisabled?: boolean;
    onSelect: () => void;
    children?: React.ReactNode;
}> = ({ title, description, isSelected, isDisabled, onSelect, children }) => (
    <div 
        className={`p-4 border rounded-lg transition-all ${
            isDisabled 
                ? 'opacity-60 grayscale cursor-not-allowed border-zinc-200 bg-zinc-50'
                : isSelected 
                    ? 'border-zinc-800 bg-zinc-50 ring-2 ring-zinc-800 cursor-pointer' 
                    : 'border-zinc-300 bg-white hover:border-zinc-400 cursor-pointer'
        }`}
        onClick={isDisabled ? undefined : onSelect}
        onKeyDown={(e) => !isDisabled && (e.key === 'Enter' || e.key === ' ') && onSelect()}
        role="radio"
        aria-checked={isSelected}
        aria-disabled={isDisabled}
        tabIndex={isDisabled ? -1 : 0}
    >
        <div className="flex justify-between items-start">
            <div className="flex-grow pr-4">
                <h3 className="font-bold text-zinc-900">{title}</h3>
                <p className="text-sm text-zinc-600 mt-1">{description}</p>
            </div>
            {isSelected && !isDisabled && <CheckIcon className="w-6 h-6 text-zinc-800 flex-shrink-0" />}
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
    const [showDriveHelp, setShowDriveHelp] = useState(false);

    if (!isOpen) {
        return null;
    }

    const isSupabaseConfigured = !!process.env.VITE_SUPABASE_URL && !!process.env.VITE_SUPABASE_ANON_KEY;
    const isGoogleConfigured = !!process.env.VITE_GOOGLE_CLIENT_ID;

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-60 flex items-start md:items-center justify-center z-50 p-4 overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sync-dialog-title"
        >
            <div className="bg-white rounded-lg border border-zinc-200 w-full max-w-lg relative shadow-2xl my-8">
                <div className="p-6 border-b border-zinc-200">
                    <h2 id="sync-dialog-title" className="text-xl font-bold text-zinc-900">Sync & Backup Settings</h2>
                    <p className="text-sm text-zinc-600 mt-1">Choose how you'd like to protect your data.</p>
                </div>
                
                <div className="p-6 space-y-4">
                    {/* Supabase Option */}
                    <ProviderOption
                        title="Supabase Real-time Sync"
                        description={isSupabaseConfigured ? "Sync across devices in real-time with a secure account." : "Setup required: VITE_SUPABASE_URL and KEY must be provided by the admin."}
                        isSelected={currentProvider === 'supabase'}
                        isDisabled={!isSupabaseConfigured}
                        onSelect={() => onProviderChange('supabase')}
                    >
                        {currentProvider === 'supabase' && isSupabaseConfigured && (
                            <div className="mt-4 pt-4 border-t border-zinc-200 space-y-3">
                                <h4 className="text-sm font-bold text-zinc-800 uppercase tracking-wider">Sync Mode</h4>
                                <div className="grid grid-cols-2 gap-2">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onSyncModeChange('realtime'); }}
                                        className={`p-3 border rounded-lg text-left transition-colors ${syncMode === 'realtime' ? 'border-zinc-800 bg-zinc-100' : 'border-zinc-300 bg-white hover:border-zinc-400'}`}
                                    >
                                        <p className="font-bold text-sm">Real-time</p>
                                        <p className="text-[10px] text-zinc-500">Instant updates</p>
                                    </button>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onSyncModeChange('manual'); }}
                                        className={`p-3 border rounded-lg text-left transition-colors ${syncMode === 'manual' ? 'border-zinc-800 bg-zinc-100' : 'border-zinc-300 bg-white hover:border-zinc-400'}`}
                                    >
                                        <p className="font-bold text-sm">Manual</p>
                                        <p className="text-[10px] text-zinc-500">Sync on click</p>
                                    </button>
                                </div>
                            </div>
                        )}
                    </ProviderOption>

                    {/* Google Drive Option */}
                    <ProviderOption
                        title="Google Drive Sync"
                        description={isGoogleConfigured ? "Save your collection to a private file in your own Google Drive." : "Configuration required in Google Cloud Console."}
                        isSelected={currentProvider === 'google_drive'}
                        isDisabled={!isGoogleConfigured}
                        onSelect={() => onProviderChange('google_drive')}
                    />

                    {/* Setup Guidance for Google Drive */}
                    {!isGoogleConfigured && (
                        <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-lg">
                            <div className="flex items-start gap-3">
                                <GlobeIcon className="w-5 h-5 text-zinc-400 mt-0.5" />
                                <div className="flex-1">
                                    <h4 className="text-sm font-bold text-zinc-800">Setup Google Sync</h4>
                                    <p className="text-xs text-zinc-600 mt-1 leading-relaxed">
                                        Go to the <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-zinc-900 underline font-medium">Google Cloud Console</a>, 
                                        create an <strong>OAuth client ID</strong>, and add it as <code>VITE_GOOGLE_CLIENT_ID</code>.
                                    </p>
                                    
                                    <button 
                                        onClick={() => setShowDriveHelp(!showDriveHelp)}
                                        className="mt-2 text-[10px] font-bold text-blue-600 flex items-center gap-1 hover:underline"
                                    >
                                        <QuestionMarkCircleIcon className="w-3 h-3" />
                                        {showDriveHelp ? 'Hide Setup Tips' : 'Stuck? See Step-by-Step'}
                                    </button>

                                    {showDriveHelp && (
                                        <div className="mt-3 p-3 bg-white border border-zinc-200 rounded text-[11px] text-zinc-700 space-y-3 leading-tight shadow-inner">
                                            <p><span className="font-bold">1. Select Project:</span> Ensure your project name is in the top-left dropdown.</p>
                                            <p><span className="font-bold">2. Consent Screen:</span> Go to "APIs & Services" > "OAuth consent screen". Click <span className="italic">Edit App</span> or scroll down.</p>
                                            <p><span className="font-bold">3. Test Users:</span> Scroll to the <span className="font-bold text-zinc-900">Test users</span> section (usually at the bottom) and click <span className="font-bold text-blue-600">+ ADD USERS</span>. Enter your email address.</p>
                                            <p><span className="font-bold">4. Credentials:</span> In the sidebar, click <span className="font-bold">Credentials</span> > <span className="font-bold">+ Create</span> > <span className="italic">OAuth client ID</span> > <span className="italic">Web Application</span>.</p>
                                            <p className="text-orange-600 text-[10px] mt-2 italic font-medium">Tip: If you are in a wizard, "Test Users" is Step 3 of the 4-step process.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* Local Only Option */}
                    <ProviderOption
                        title="No Sync (Local Only)"
                        description="Data is stored only in this browser. Use manual export for backups."
                        isSelected={currentProvider === 'none'}
                        onSelect={() => onProviderChange('none')}
                    />
                </div>
                
                <div className="p-4 bg-zinc-50 border-t border-zinc-200 flex justify-end">
                    <button 
                        onClick={onClose} 
                        className="bg-zinc-900 text-white font-bold py-2 px-8 rounded-lg hover:bg-black transition-colors"
                    >
                        Done
                    </button>
                </div>

                <button 
                    onClick={onClose} 
                    className="absolute top-4 right-4 p-2 rounded-full text-zinc-400 hover:text-zinc-600 transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-500" 
                    aria-label="Close settings"
                >
                    <XIcon className="w-6 h-6" />
                </button>
            </div>
        </div>
    );
};

export default SyncSettingsModal;