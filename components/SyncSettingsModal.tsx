import React, { useState, useEffect } from 'react';
import { SyncProvider, DriveRevision } from '../types';
import { XIcon } from './icons/XIcon';
import { CheckIcon } from './icons/CheckIcon';
import { GlobeIcon } from './icons/GlobeIcon';
import { QuestionMarkCircleIcon } from './icons/QuestionMarkCircleIcon';
import { ClockIcon } from './icons/ClockIcon';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { GoogleDriveIcon } from './icons/GoogleDriveIcon';

interface SyncSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentProvider: SyncProvider;
    onProviderChange: (provider: SyncProvider) => void;
    syncMode: string;
    onSyncModeChange: (mode: string) => void;
    isSignedIn: boolean;
    userEmail?: string | null;
    onSignIn: () => void;
    onSignOut?: () => void;
    getRevisions?: () => Promise<DriveRevision[]>;
    onRestoreRevision?: (revisionId: string) => Promise<boolean>;
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
    isSignedIn,
    userEmail,
    onSignIn,
    onSignOut,
    getRevisions,
    onRestoreRevision,
}) => {
    const [showDriveHelp, setShowDriveHelp] = useState(false);
    const [showTroubleshooting, setShowTroubleshooting] = useState(false);
    const [revisions, setRevisions] = useState<DriveRevision[]>([]);
    const [isLoadingRevisions, setIsLoadingRevisions] = useState(false);
    const [confirmingRevId, setConfirmingRevId] = useState<string | null>(null);
    const [isRestoringRevId, setIsRestoringRevId] = useState<string | null>(null);
    const [restoreError, setRestoreError] = useState<string | null>(null);

    const activeSignedIn = isSignedIn;
    const activeEmail = userEmail;

    useEffect(() => {
        if (!isOpen) {
            setConfirmingRevId(null);
            setRestoreError(null);
            return;
        }
        if (currentProvider === 'google_drive' && isSignedIn && getRevisions) {
            let isCancelled = false;
            setIsLoadingRevisions(true);
            getRevisions()
                .then(revs => {
                    if (isCancelled) return;
                    setRevisions(
                        [...revs]
                            .sort((a, b) => new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime())
                            .slice(0, 10)
                    );
                })
                .catch(() => {
                    if (!isCancelled) setRevisions([]);
                })
                .finally(() => {
                    if (!isCancelled) setIsLoadingRevisions(false);
                });
            return () => {
                isCancelled = true;
            };
        } else {
            setRevisions([]);
        }
    }, [isOpen, currentProvider, isSignedIn, getRevisions]);

    const handleRestore = async (revId: string) => {
        if (!onRestoreRevision || isRestoringRevId) return;
        setIsRestoringRevId(revId);
        setRestoreError(null);
        try {
            const restored = await onRestoreRevision(revId);
            if (restored) {
                setConfirmingRevId(null);
                onClose();
            } else {
                setRestoreError("Could not restore this backup revision. Please try again.");
            }
        } catch (err: any) {
            setRestoreError(err?.message || "Failed to restore this backup revision.");
        } finally {
            setIsRestoringRevId(null);
        }
    };

    if (!isOpen) return null;

    const isGoogleConfigured = !!process.env.VITE_GOOGLE_CLIENT_ID;

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-60 flex items-start justify-center z-50 p-4 overflow-y-auto"
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
                        description={isGoogleConfigured ? "Automatic cloud sync. Auto-downloads newer saves on startup and uploads every save." : "Configuration required in Google Cloud Console."}
                        isSelected={currentProvider === 'google_drive'}
                        isDisabled={!isGoogleConfigured}
                        onSelect={() => onProviderChange('google_drive')}
                    />

                    {currentProvider === 'google_drive' && activeSignedIn && (
                        <div className="mt-2 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 min-w-0">
                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 animate-pulse"></span>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-emerald-950 truncate">
                                            {activeEmail ? activeEmail : 'Google Account Connected'}
                                        </p>
                                        <p className="text-xs text-emerald-700">
                                            Session active • Auto-refreshes in background
                                        </p>
                                    </div>
                                </div>
                                {onSignOut && (
                                  <button
                                      onClick={onSignOut}
                                      className="text-xs text-emerald-800 hover:text-red-700 hover:underline font-medium ml-3 shrink-0"
                                  >
                                      Sign Out
                                  </button>
                                )}
                            </div>
                            <div className="mt-2 pt-2 border-t border-emerald-100 flex items-center justify-between text-[11px] text-emerald-800">
                                <span>Stay Logged In: Enabled</span>
                                <span className="bg-emerald-200/60 px-2 py-0.5 rounded text-[10px] font-semibold">Persists on reload</span>
                            </div>
                        </div>
                    )}

                    {currentProvider === 'google_drive' && !activeSignedIn && isGoogleConfigured && (
                        <div className="mt-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <p className="text-sm text-blue-800 mb-1 font-semibold">
                                {activeEmail ? `Session paused for ${activeEmail}` : 'You are not signed in to Google Drive.'}
                            </p>
                            <p className="text-xs text-blue-600 mb-3">
                                {activeEmail 
                                    ? 'Click below to resume your session with 1 click.' 
                                    : 'Sign in once to keep your collection synced across devices.'}
                            </p>
                            <button 
                                onClick={onSignIn}
                                className="w-full flex items-center justify-center gap-2 bg-zinc-900 text-white font-bold py-2.5 px-4 rounded-lg hover:bg-black transition-colors"
                            >
                                <GoogleDriveIcon className="w-5 h-5" />
                                <span>{activeEmail ? `Resume Session (${activeEmail})` : 'Sign in with Google'}</span>
                            </button>
                            
                            <button 
                                onClick={() => setShowTroubleshooting(!showTroubleshooting)}
                                className="mt-3 w-full text-xs text-blue-600 hover:underline text-center"
                            >
                                {showTroubleshooting ? 'Hide Troubleshooting' : 'Popup not appearing? Click here'}
                            </button>

                            {showTroubleshooting && (
                                <div className="mt-3 p-3 bg-white border border-blue-100 rounded text-xs text-zinc-600 space-y-2">
                                    <p className="font-bold text-zinc-800">1. Check Popup Blocker</p>
                                    <p>Ensure your browser isn't blocking popups for this site. Look for an icon in your address bar.</p>
                                    
                                    <p className="font-bold text-zinc-800">2. Authorized Origins</p>
                                    <p>You must add these URLs to your Google Cloud Console under "Authorized JavaScript origins":</p>
                                    <div className="bg-zinc-50 p-2 rounded font-mono break-all select-all border border-zinc-200">
                                        https://ais-dev-amszmm4xv6p2vamcbwkjfd-84416915459.europe-west2.run.app<br/>
                                        https://ais-pre-amszmm4xv6p2vamcbwkjfd-84416915459.europe-west2.run.app
                                    </div>
                                    <p className="text-[10px]">Note: These are your unique development and preview URLs.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {currentProvider === 'google_drive' && activeSignedIn && (
                        <div className="mt-4 p-4 bg-zinc-50 border border-zinc-200 rounded-lg">
                            <h4 className="text-sm font-bold text-zinc-800 flex items-center gap-2 mb-3">
                                <ClockIcon className="w-4 h-4" />
                                Version History (Cloud)
                            </h4>
                            
                            {restoreError && (
                                <p className="mb-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
                                    {restoreError}
                                </p>
                            )}

                            {isLoadingRevisions ? (
                                <div className="flex items-center gap-2 py-2 text-zinc-500 text-xs">
                                    <SpinnerIcon className="w-3 h-3 animate-spin" />
                                    <span>Fetching history...</span>
                                </div>
                            ) : revisions.length > 0 ? (
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {revisions.map((rev) => (
                                        <div key={rev.id} className="flex items-center justify-between gap-2 p-2 bg-white border border-zinc-200 rounded text-xs">
                                            <span className="text-zinc-600">
                                                {new Date(rev.modifiedTime).toLocaleString()}
                                            </span>
                                            {confirmingRevId === rev.id ? (
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <button
                                                        type="button"
                                                        disabled={isRestoringRevId === rev.id}
                                                        onClick={() => handleRestore(rev.id)}
                                                        className="text-red-600 font-bold hover:underline disabled:opacity-50"
                                                    >
                                                        {isRestoringRevId === rev.id ? 'Restoring...' : 'Confirm'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={isRestoringRevId === rev.id}
                                                        onClick={() => setConfirmingRevId(null)}
                                                        className="text-zinc-500 hover:text-zinc-800"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            ) : (
                                                <button 
                                                    type="button"
                                                    onClick={() => setConfirmingRevId(rev.id)}
                                                    className="text-blue-600 font-bold hover:underline shrink-0"
                                                >
                                                    Restore
                                                </button>
                                            )}
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