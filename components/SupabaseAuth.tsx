import React, { useState } from 'react';
import { User } from '@supabase/supabase-js';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { SettingsIcon } from './icons/SettingsIcon';

interface SupabaseAuthProps {
    user: User | null;
    signIn: (email: string) => Promise<boolean>;
    syncStatus: string;
    error: string | null;
    onOpenSyncSettings: () => void;
}

const SupabaseAuth: React.FC<SupabaseAuthProps> = ({ user, signIn, syncStatus, error, onOpenSyncSettings }) => {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');

    const handleSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage('');
        const success = await signIn(email);
        if (success) {
            setMessage('Check your email for the magic link!');
            setEmail('');
        }
    };

    if (user) {
        return null;
    }

    return (
        <div className="p-6 bg-white rounded-lg border border-zinc-200 max-w-md mx-auto my-8 text-center">
            <h2 className="text-xl font-bold text-zinc-800">Sign In for Cross-Device Sync</h2>
            <p className="text-zinc-600 mt-2">
                To sync your collection across multiple devices using Supabase, you need a single account. Sign in with your email to get started.
            </p>
            <form onSubmit={handleSignIn} className="mt-4 flex flex-col sm:flex-row gap-2">
                <input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="flex-grow w-full bg-white border border-zinc-300 rounded-lg py-2 px-3 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-800"
                    aria-label="Email for sign-in"
                />
                <button
                    type="submit"
                    disabled={syncStatus === 'authenticating'}
                    className="bg-zinc-900 text-white font-bold py-2 px-4 rounded-lg hover:bg-black disabled:opacity-50 flex items-center justify-center"
                >
                    {syncStatus === 'authenticating' ? <SpinnerIcon className="w-5 h-5" /> : 'Send Link'}
                </button>
            </form>
            {message && <p className="mt-4 text-sm text-green-600">{message}</p>}
            {error && error !== "You are not signed in to Supabase." && <p className="mt-4 text-sm text-red-600">{error}</p>}
        
            <div className="mt-6 pt-6 border-t border-zinc-200">
                <p className="text-sm text-zinc-600">
                    Alternatively, for automatic syncing without an account, you can use a different provider.
                </p>
                <button
                    onClick={onOpenSyncSettings}
                    className="mt-3 w-full flex items-center justify-center gap-2 bg-white text-zinc-700 font-medium py-2 px-4 rounded-lg border border-zinc-300 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-800"
                >
                    <SettingsIcon className="w-5 h-5" />
                    Change Sync Settings
                </button>
            </div>
        </div>
    );
};

export default SupabaseAuth;