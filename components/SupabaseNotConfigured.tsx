import React from 'react';
import { SettingsIcon } from './icons/SettingsIcon';
import { XCircleIcon } from './icons/XCircleIcon';

interface SupabaseNotConfiguredProps {
    onOpenSyncSettings: () => void;
}

const SupabaseNotConfigured: React.FC<SupabaseNotConfiguredProps> = ({ onOpenSyncSettings }) => {
    return (
        <div className="p-6 bg-white rounded-lg border border-zinc-200 max-w-lg mx-auto my-8">
            <div className="flex items-center gap-3">
                <XCircleIcon className="w-8 h-8 text-red-500 flex-shrink-0" />
                <h2 className="text-xl font-bold text-zinc-800">Supabase Sync Not Configured</h2>
            </div>
            <p className="text-zinc-600 mt-3">
                This feature is currently unavailable. The site administrator needs to provide the necessary Supabase credentials to enable real-time cloud synchronization.
            </p>
            <p className="text-zinc-600 mt-2">
                You can switch to another sync provider or continue using the app in local-only mode.
            </p>
            <div className="mt-6">
                <button
                    onClick={onOpenSyncSettings}
                    className="w-full flex items-center justify-center gap-2 bg-zinc-900 text-white font-bold py-2 px-4 rounded-lg hover:bg-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900"
                >
                    <SettingsIcon className="w-5 h-5" />
                    Change Sync Settings
                </button>
            </div>
        </div>
    );
};

export default SupabaseNotConfigured;
