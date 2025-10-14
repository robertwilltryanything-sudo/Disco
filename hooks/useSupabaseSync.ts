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

        const handleAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                setSession(session);
                setUser(session.user);
            } else {
                setSyncStatus('authenticating');
                const { data, error } = await supabase.auth.signInAnonymously();
                if (error) {
                    setError(`Supabase anonymous sign-in failed: ${error.message}`);
                    setSyncStatus('error');
                } else if (data.session) {
                    setSession(data.session);
                    setUser(data.session.user);
                }
            }
        };

        handleAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session) {
                 setSession(session);
                 setUser(session.user);
                 setError(null);
            } else {
                // If session is lost, try to sign in again.
                setSession(null);
                setUser(null);
                handleAuth();
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
        } else if (!session && supabase) {
            // User is signed out or anonymous session is being created, clear collection
             setCollection([]);
        }

        return () => {
            if (channelRef.current) {
                supabase?.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [session, setCollection]);

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
        addCD,
        updateCD,
        deleteCD,
        setSyncStatus,
    };
};