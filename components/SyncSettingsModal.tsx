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
}) => {
    const [showDriveHelp, setShowDriveHelp] = useState(false);

    if (!isOpen) {
        return null;
    }

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
                                            <p><span className="font-bold text-red-600">0. Enable API:</span> In the sidebar, go to "APIs & Services" &gt; "Library". Search for <span className="font-bold">Google Drive API</span> and click <span className="font-bold">Enable</span>.</p>
                                            <p><span className="font-bold">1. Origins (IMPORTANT):</span> In your OAuth Client settings, add <span className="italic font-medium">{window.location.origin}</span> to the <span className="font-bold">Authorized JavaScript origins</span> list.</p>
                                            <p><span className="font-bold">2. Test Users:</span> In "OAuth consent screen", scroll to <span className="font-bold">Test users</span> and add your email. Your app must be in "Testing" mode or "Published".</p>
                                            <p><span className="font-bold">3. Credentials:</span> In the sidebar, click <span className="font-bold">Credentials</span> &gt; <span className="font-bold">+ Create</span> &gt; <span className="italic">OAuth client ID</span> &gt; <span className="italic">Web Application</span>.</p>
                                            <p className="text-orange-600 text-[10px] mt-2 italic font-medium">Tip: If you get a 401 error, it's almost always a missing "Origin" (Step 1) or wrong Client ID.</p>
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