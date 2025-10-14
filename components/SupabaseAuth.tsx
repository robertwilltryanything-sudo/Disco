import React, { useState } from 'react';
import { User } from '@supabase/supabase-js';
import { SpinnerIcon } from './icons/SpinnerIcon';

interface SupabaseAuthProps {
    user: User | null;
    signIn: (email: string) => Promise<boolean>;
    syncStatus: string;
    error: string | null;
}

const SupabaseAuth: React.FC<SupabaseAuthProps> = ({ user, signIn, syncStatus, error }) => {
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
        // This component is mainly for the sign-in form. Sign-out is handled in the Header.
        // Returning null keeps the main view clean once authenticated.
        return null;
    }

    return (
        <div className="p-6 bg-white rounded-lg border border-zinc-200 max-w-md mx-auto my-8">
            <h2 className="text-xl font-bold text-zinc-800">Sign In with Supabase</h2>
            <p className="text-zinc-600 mt-2">
                Enter your email to sign in or create an account. We'll send you a magic link to get started.
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
        </div>
    );
};

export default SupabaseAuth;