// FIX: Import Dispatch and SetStateAction to use for typing state setters without the 'React' namespace.
import { useState, useEffect, useRef, Dispatch, SetStateAction } from 'react';
import { createClient, SupabaseClient, Session, User, RealtimeChannel } from '@supabase/supabase-js';
import { CD } from '../types';

export type SyncStatus = 'idle' | 'loading' | 'saving' | 'synced' | 'error' | 'disabled' | 'authenticating';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

let supabase: SupabaseClient | null = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// FIX: Use the imported Dispatch and SetStateAction types.
export const useSupabaseSync = (setCollection: Dispatch<SetStateAction<CD[]>>) => {
    const [syncStatus, setSyncStatus] = useState<SyncStatus>(supabase ? 'idle' : 'disabled');
    const [error, setError] = useState<string | null>(supabase ? null : 'Supabase is not configured. The administrator needs to provide VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const channelRef = useRef<RealtimeChannel | null>(null);

    useEffect(() => {
        if (!supabase) return;

        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setSyncStatus(session ? 'idle' : 'disabled');
            if (!session) {
                setError("You are not signed in to Supabase.");
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            setSyncStatus(session ? 'idle' : 'disabled');
            if (!session) {
                setError("You are not signed in to Supabase.");
            } else {
                setError(null);
            }
        });

        return () => subscription.unsubscribe();
    }, []);
    
    useEffect(() => {
        if (session && supabase) {
            setSyncStatus('loading');
            supabase.from('cds').select('*').order('created_at', { ascending: false })
                .then(({ data, error }) => {
                    if (error) {
                        setError(error.message);
                        setSyncStatus('error');
                    } else {
                        setCollection(data || []);
                        setSyncStatus('synced');
                    }
                });

            const channel = supabase.channel('cds-changes')
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cds' }, (payload) => {
                    setCollection(prev => [payload.new as CD, ...prev.filter(cd => cd.id !== payload.new.id)]);
                })
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'cds' }, (payload) => {
                    setCollection(prev => prev.map(cd => cd.id === payload.new.id ? payload.new as CD : cd));
                })
                .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'cds' }, (payload) => {
                    setCollection(prev => prev.filter(cd => cd.id !== payload.old.id));
                })
                .subscribe();

            channelRef.current = channel;
        } else {
            setCollection([]);
        }

        return () => {
            if (channelRef.current) {
                supabase?.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [session, setCollection]);


    const signIn = async (email: string): Promise<boolean> => {
        if (!supabase) return false;
        setError(null);
        setSyncStatus('authenticating');
        const { error } = await supabase.auth.signInWithOtp({ email });
        if (error) {
            setError(error.message);
            setSyncStatus('error');
            return false;
        } else {
            setSyncStatus('idle'); // Waiting for user to click link
            return true;
        }
    };
    
    const signOut = async () => {
        if (!supabase) return;
        await supabase.auth.signOut();
    };

    const addCD = async (cdData: Omit<CD, 'id'>) => {
        if (!supabase || !user) return null;
        setSyncStatus('saving');
        const { data, error } = await supabase.from('cds').insert({ ...cdData, user_id: user.id }).select();
        if (error) {
            setError(error.message);
            setSyncStatus('error');
            return null;
        }
        setSyncStatus('synced');
        return data?.[0] as CD ?? null;
    };

    const updateCD = async (cd: CD) => {
        if (!supabase) return;
        setSyncStatus('saving');
        const { error } = await supabase.from('cds').update(cd).eq('id', cd.id);
        if (error) {
            setError(error.message);
            setSyncStatus('error');
        } else {
            setSyncStatus('synced');
        }
    };

    const deleteCD = async (id: string) => {
        if (!supabase) return;
        setSyncStatus('saving');
        const { error } = await supabase.from('cds').delete().eq('id', id);
        if (error) {
            setError(error.message);
            setSyncStatus('error');
        } else {
            setSyncStatus('synced');
        }
    };

    return {
        isConfigured: !!supabase,
        syncStatus,
        error,
        session,
        user,
        signIn,
        signOut,
        addCD,
        updateCD,
        deleteCD,
        setSyncStatus,
    };
};