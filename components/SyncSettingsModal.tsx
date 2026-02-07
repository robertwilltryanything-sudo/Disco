import React, { useState, useEffect } from 'react';
import { SyncProvider, DriveRevision } from '../types';
import { XIcon } from './icons/XIcon';
import { CheckIcon } from './icons/CheckIcon';
import { GlobeIcon } from './icons/GlobeIcon';
import { QuestionMarkCircleIcon } from './icons/QuestionMarkCircleIcon';
import { ClockIcon } from './icons/ClockIcon';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { useGoogleDrive } from '../hooks/useGoogleDrive';

interface SyncSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentProvider: SyncProvider;
    onProviderChange: (provider: SyncProvider) => void;
    syncMode: string;
    onSyncModeChange: (mode: string) => void;
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
    const [revisions, setRevisions] = useState<DriveRevision[]>([]);
    const [isLoadingRevisions, setIsLoadingRevisions] = useState(false);
    const googleDrive = useGoogleDrive();

    useEffect(() => {
        if (isOpen && currentProvider === 'google_drive' && googleDrive.isSignedIn) {
            setIsLoadingRevisions(true);
            googleDrive.getRevisions().then(revs => {
                setRevisions(revs.sort((a, b) => new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime()).slice(0, 10));
                setIsLoadingRevisions(false);
            });
        }
    }, [isOpen, currentProvider, googleDrive.isSignedIn]);

    const handleRestore = async (revId: string) => {
        if (!window.confirm("Restore this version? Your current local changes will be replaced.")) return;
        const data = await googleDrive.loadRevision(revId);
        if (data) {
            window.location.reload(); 
        }
    };

    if (!isOpen) return null;

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
                    <p className="text-sm text-zinc-600 mt-1">Manage cloud synchronization for your collection.</p>
                </div>
                
                <div className="p-6 space-y-4">
                    <ProviderOption
                        title="Google Drive Sync"
                        description={isGoogleConfigured ? "Manual Load/Save to your private Drive storage." : "Configuration required in Google Cloud Console."}
                        isSelected={currentProvider === 'google_drive'}
                        isDisabled={!isGoogleConfigured}
                        onSelect={() => onProviderChange('google_drive')}
                    />

                    {currentProvider === 'google_drive' && googleDrive.isSignedIn && (
                        <div className="mt-4 p-4 bg-zinc-50 border border-zinc-200 rounded-lg">
                            <h4 className="text-sm font-bold text-zinc-800 flex items-center gap-2 mb-3">
                                <ClockIcon className="w-4 h-4" />
                                Version History (Cloud)
                            </h4>
                            
                            {isLoadingRevisions ? (
                                <div className="flex items-center gap-2 py-2 text-zinc-500 text-xs">
                                    <SpinnerIcon className="w-3 h-3 animate-spin" />
                                    <span>Fetching history...</span>
                                </div>
                            ) : revisions.length > 0 ? (
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {revisions.map((rev) => (
                                        <div key={rev.id} className="flex items-center justify-between p-2 bg-white border border-zinc-200 rounded text-xs">
                                            <span className="text-zinc-600">
                                                {new Date(rev.modifiedTime).toLocaleString()}
                                            </span>
                                            <button 
                                                onClick={() => handleRestore(rev.id)}
                                                className="text-blue-600 font-bold hover:underline"
                                            >
                                                Restore
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-zinc-500 italic">No cloud history found.</p>
                            )}
                        </div>
                    )}

                    {!isGoogleConfigured && (
                        <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-lg">
                            <div className="flex items-start gap-3">
                                <GlobeIcon className="w-5 h-5 text-zinc-400 mt-0.5" />
                                <div className="flex-1">
                                    <h4 className="text-sm font-bold text-zinc-800">Setup Google Sync</h4>
                                    <button 
                                        onClick={() => setShowDriveHelp(!showDriveHelp)}
                                        className="mt-2 text-[10px] font-bold text-blue-600 flex items-center gap-1 hover:underline"
                                    >
                                        <QuestionMarkCircleIcon className="w-3 h-3" />
                                        {showDriveHelp ? 'Hide Setup Tips' : 'Show Setup Tips'}
                                    </button>
                                    {showDriveHelp && (
                                        <div className="mt-3 p-3 bg-white border border-zinc-200 rounded text-[11px] text-zinc-700 space-y-3 leading-tight shadow-inner">
                                            <p><span className="font-bold">1. Origins:</span> Add <span className="italic font-medium">{window.location.origin}</span> to the <span className="font-bold">Authorized JavaScript origins</span> list in GCP.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                    
                    <ProviderOption
                        title="No Sync (Local Only)"
                        description="Data stays on this device only. Use manual export for backups."
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
