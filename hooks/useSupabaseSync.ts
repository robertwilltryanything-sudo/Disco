import { useState, useEffect, useRef, Dispatch, SetStateAction, useCallback } from 'react';
import { createClient, SupabaseClient, Session, User, RealtimeChannel } from '@supabase/supabase-js';
import { CD, SyncStatus, SyncMode, WantlistItem, SyncProvider } from '../types';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

let supabase: SupabaseClient | null = null;
if (SUPABASE_URL && SUPABASE_URL !== 'undefined' && SUPABASE_ANON_KEY && SUPABASE_ANON_KEY !== 'undefined') {
    try {
        supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (error) {
        console.error("Failed to initialize Supabase client:", error);
        supabase = null;
    }
}

export const useSupabaseSync = (setCollection: Dispatch<SetStateAction<CD[]>>, setWantlist: Dispatch<SetStateAction<WantlistItem[]>>, syncMode: SyncMode, syncProvider: SyncProvider) => {
    const [syncStatus, setSyncStatus] = useState<SyncStatus>(supabase ? 'idle' : 'disabled');
    const [error, setError] = useState<string | null>(supabase ? null : 'Supabase is not configured correctly.');
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const collectionChannelRef = useRef<RealtimeChannel | null>(null);
    const wantlistChannelRef = useRef<RealtimeChannel | null>(null);
    
    const loadDataFromSupabase = useCallback(async () => {
        if (!supabase) return;
        setSyncStatus('loading');
        setError(null);
        
        const fetchAllRows = async (tableName: string) => {
            let allItems: any[] = [];
            let from = 0;
            const pageSize = 1000;
            let hasMore = true;

            while (hasMore) {
                const { data, error, count } = await supabase!
                    .from(tableName)
                    .select('*', { count: 'exact' })
                    .range(from, from + pageSize - 1)
                    .order('created_at', { ascending: false });

                if (error) throw error;
                
                if (data) {
                    allItems = [...allItems, ...data];
                    if (allItems.length >= (count || 0) || data.length < pageSize) {
                        hasMore = false;
                    } else {
                        from += pageSize;
                    }
                } else {
                    hasMore = false;
                }
            }
            return allItems;
        };

        try {
            const [collectionData, wantlistData] = await Promise.all([
                fetchAllRows('collection'),
                fetchAllRows('wantlist')
            ]);
            
            setCollection(collectionData);
            setWantlist(wantlistData);
            setSyncStatus('synced');
        } catch (err: any) {
            console.error("Supabase load error:", err);
            setError(`Load Error: ${err.message || 'Check database connection'}`);
            setSyncStatus('error');
        }
    }, [setCollection, setWantlist]);

    useEffect(() => {
        if (!supabase || syncProvider !== 'supabase') return;

        const getSession = async () => {
            const { data: { session } } = await supabase!.auth.getSession();
            setSession(session);
            setUser(session?.user ?? null);
        };
        
        getSession();

        const { data: { subscription } } = supabase!.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            setError(null);
        });

        return () => subscription.unsubscribe();
    }, [syncProvider]);
    
    useEffect(() => {
        const cleanup = () => {
            if (collectionChannelRef.current) {
                supabase?.removeChannel(collectionChannelRef.current);
                collectionChannelRef.current = null;
            }
            if (wantlistChannelRef.current) {
                supabase?.removeChannel(wantlistChannelRef.current);
                wantlistChannelRef.current = null;
            }
        };
        
        if (syncProvider !== 'supabase') {
            cleanup();
            return;
        }

        if (session && supabase) {
            loadDataFromSupabase();
            
            if (syncMode === 'realtime') {
                const collectionChannel = supabase.channel('collection-changes')
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'collection' }, (payload) => {
                        if (payload.eventType === 'INSERT') {
                            setCollection(prev => [payload.new as CD, ...prev.filter(cd => cd.id !== payload.new.id)]);
                        } else if (payload.eventType === 'UPDATE') {
                            setCollection(prev => prev.map(cd => cd.id === payload.new.id ? payload.new as CD : cd));
                        } else if (payload.eventType === 'DELETE') {
                            setCollection(prev => prev.filter(cd => cd.id !== payload.old.id));
                        }
                    })
                    .subscribe();
                collectionChannelRef.current = collectionChannel;
                
                const wantlistChannel = supabase.channel('wantlist-changes')
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'wantlist' }, (payload) => {
                         if (payload.eventType === 'INSERT') {
                            setWantlist(prev => [payload.new as WantlistItem, ...prev.filter(item => item.id !== payload.new.id)]);
                        } else if (payload.eventType === 'UPDATE') {
                            setWantlist(prev => prev.map(item => item.id === payload.new.id ? payload.new as WantlistItem : item));
                        } else if (payload.eventType === 'DELETE') {
                            setWantlist(prev => prev.filter(item => item.id !== payload.old.id));
                        }
                    })
                    .subscribe();
                wantlistChannelRef.current = wantlistChannel;
            }
        }

        return cleanup;
    }, [session, setCollection, setWantlist, syncMode, loadDataFromSupabase, syncProvider]);
    
    const signIn = async (email: string): Promise<boolean> => {
        if (!supabase) return false;
        setSyncStatus('authenticating');
        setError(null);
        const { error } = await supabase.auth.signInWithOtp({ 
            email,
            options: { emailRedirectTo: window.location.origin }
        });
        if (error) {
            setError(`Authentication failed: ${error.message}`);
            setSyncStatus('error');
            return false;
        }
        setSyncStatus('idle');
        return true;
    };

    const signOut = async () => {
        if (!supabase) return;
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setSyncStatus('idle');
    };

    const addCD = async (cdData: Omit<CD, 'id'>) => {
        if (!supabase) { setError("Database client not ready."); return null; }
        if (!user) { setError("Authentication required."); return null; }
        
        setSyncStatus('saving');
        setError(null);
        const { data, error: dbError } = await supabase.from('collection').insert({ ...cdData, user_id: user.id }).select();
        
        if (dbError) {
            console.error("Supabase Add CD Error:", dbError);
            setError(dbError.message);
            setSyncStatus('error');
            return null;
        }
        
        const newCd = data?.[0] as CD ?? null;
        if (newCd) {
            setCollection(prev => [newCd, ...prev.filter(cd => cd.id !== newCd.id)]);
            setSyncStatus('synced');
        }
        return newCd;
    };

    const updateCD = async (cd: CD) => {
        if (!supabase || !user) return false;
        setSyncStatus('saving');
        setError(null);
        
        const { id, user_id, created_at, ...updatePayload } = cd;
        const { error: dbError } = await supabase.from('collection').update(updatePayload).eq('id', id);
        
        if (dbError) {
            console.error("Supabase Update Error:", dbError);
            setError(dbError.message);
            setSyncStatus('error');
            return false;
        }
        setSyncStatus('synced');
        return true;
    };

    const deleteCD = async (id: string) => {
        if (!supabase) return false;
        setSyncStatus('saving');
        setError(null);
        const { error: dbError } = await supabase.from('collection').delete().eq('id', id);
        if (dbError) {
            setError(dbError.message);
            setSyncStatus('error');
            return false;
        }
        setSyncStatus('synced');
        return true;
    };
    
    const addWantlistItem = async (itemData: Omit<WantlistItem, 'id' | 'created_at'>) => {
        if (!supabase || !user) return null;
        setSyncStatus('saving');
        setError(null);
        const { data, error: dbError } = await supabase.from('wantlist').insert({ ...itemData, user_id: user.id }).select();
        if (dbError) {
            setError(dbError.message);
            setSyncStatus('error');
            return null;
        }
        const newItem = data?.[0] as WantlistItem ?? null;
        if (newItem) setSyncStatus('synced');
        return newItem;
    };

    const updateWantlistItem = async (item: WantlistItem) => {
        if (!supabase || !user) return false;
        setSyncStatus('saving');
        setError(null);
        const { id, user_id, created_at, ...updatePayload } = item;
        const { error: dbError } = await supabase.from('wantlist').update(updatePayload).eq('id', id);
        if (dbError) {
            setError(dbError.message);
            setSyncStatus('error');
            return false;
        }
        setSyncStatus('synced');
        return true;
    };

    const deleteWantlistItem = async (id: string) => {
        if (!supabase) return false;
        setSyncStatus('saving');
        setError(null);
        const { error: dbError } = await supabase.from('wantlist').delete().eq('id', id);
        if (dbError) {
            setError(dbError.message);
            setSyncStatus('error');
            return false;
        }
        setSyncStatus('synced');
        return true;
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
        addWantlistItem,
        updateWantlistItem,
        deleteWantlistItem,
        manualSync: () => session && loadDataFromSupabase(),
        setSyncStatus,
    };
};