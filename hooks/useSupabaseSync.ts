import { useState, useEffect, useRef, Dispatch, SetStateAction, useCallback } from 'react';
import { createClient, SupabaseClient, Session, User, RealtimeChannel } from '@supabase/supabase-js';
import { CD, SyncStatus, SyncMode, WantlistItem, SyncProvider } from '../types';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

let supabase: SupabaseClient | null = null;
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
        supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (error) {
        console.error("Failed to initialize Supabase client, sync features will be disabled.", error);
        supabase = null;
    }
}

export const useSupabaseSync = (setCollection: Dispatch<SetStateAction<CD[]>>, setWantlist: Dispatch<SetStateAction<WantlistItem[]>>, syncMode: SyncMode, syncProvider: SyncProvider) => {
    const [syncStatus, setSyncStatus] = useState<SyncStatus>(supabase ? 'idle' : 'disabled');
    const [error, setError] = useState<string | null>(supabase ? null : 'Supabase is not configured. The administrator needs to provide VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const cdsChannelRef = useRef<RealtimeChannel | null>(null);
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
            const [cdsData, wantlistData] = await Promise.all([
                fetchAllRows('cds'),
                fetchAllRows('wantlist')
            ]);
            
            setCollection(cdsData);
            setWantlist(wantlistData);
            setSyncStatus('synced');
        } catch (err: any) {
            console.error("Supabase load error:", err);
            let errorMessage = `Failed to load collection: ${err.message}`;
            
            if (err.message?.toLowerCase().includes('does not exist') || err.message?.toLowerCase().includes('could not find the table')) {
                errorMessage = "Database tables are missing. Please see supabase_setup.md for instructions.";
            } else if (err.message?.toLowerCase().includes('could not find the column')) {
                errorMessage = "Database schema is out of date (missing 'format' column). Please run the fix scripts in supabase_setup.md.";
            }
            
            setError(errorMessage);
            setSyncStatus('error');
        }
    }, [setCollection, setWantlist]);

    useEffect(() => {
        if (!supabase || syncProvider !== 'supabase') return;

        const getSession = async () => {
            const { data: { session } } = await supabase!.auth.getSession();
            setSession(session);
            setUser(session?.user ?? null);
            if (!session) {
                setSyncStatus('idle');
            }
        };
        
        getSession();

        const { data: { subscription } } = supabase!.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
            setError(null);
            if (!session) {
                setSyncStatus('idle');
            }
        });

        return () => subscription.unsubscribe();
    }, [syncProvider]);
    
    useEffect(() => {
        const cleanup = () => {
            if (cdsChannelRef.current) {
                supabase?.removeChannel(cdsChannelRef.current);
                cdsChannelRef.current = null;
            }
            if (wantlistChannelRef.current) {
                supabase?.removeChannel(wantlistChannelRef.current);
                wantlistChannelRef.current = null;
            }
        };
        
        if (syncProvider !== 'supabase') {
            cleanup();
            setSession(null);
            setUser(null);
            setSyncStatus('idle');
            return;
        }

        if (session && supabase) {
            loadDataFromSupabase();
            
            if (syncMode === 'realtime') {
                const cdsChannel = supabase.channel('cds-changes')
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'cds' }, (payload) => {
                        if (payload.eventType === 'INSERT') {
                            setCollection(prev => [payload.new as CD, ...prev.filter(cd => cd.id !== payload.new.id)]);
                        } else if (payload.eventType === 'UPDATE') {
                            setCollection(prev => prev.map(cd => cd.id === payload.new.id ? payload.new as CD : cd));
                        } else if (payload.eventType === 'DELETE') {
                            setCollection(prev => prev.filter(cd => cd.id !== payload.old.id));
                        }
                    })
                    .subscribe();
                cdsChannelRef.current = cdsChannel;
                
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

        } else if (!session && supabase) {
             setCollection([]);
             setWantlist([]);
        }

        return cleanup;
    }, [session, setCollection, setWantlist, syncMode, loadDataFromSupabase, syncProvider]);
    
    const signIn = async (email: string): Promise<boolean> => {
        if (!supabase) return false;
        setSyncStatus('authenticating');
        setError(null);
        const { error } = await supabase.auth.signInWithOtp({ email });
        if (error) {
            setError(`Supabase sign-in failed: ${error.message}`);
            setSyncStatus('error');
            return false;
        }
        setSyncStatus('idle');
        return true;
    };

    const signOut = async () => {
        if (!supabase) return;
        const { error } = await supabase.auth.signOut();
        if (error) {
            setError(error.message);
            setSyncStatus('error');
        } else {
            setSession(null);
            setUser(null);
            setSyncStatus('idle');
        }
    };

    const addCD = async (cdData: Omit<CD, 'id'>) => {
        if (!supabase || !user) return null;
        setSyncStatus('saving');
        setError(null);
        const { data, error } = await supabase.from('cds').insert({ ...cdData, user_id: user.id }).select();
        
        if (error) {
            console.error("Add CD Supabase error:", error);
            setError(error.message);
            setSyncStatus('error');
            return null;
        }
        
        const newCd = data?.[0] as CD ?? null;
        if (newCd) {
            setCollection(prev => [newCd, ...prev.filter(cd => cd.id !== newCd.id)]);
        }
        
        setSyncStatus('synced');
        return newCd;
    };

    const updateCD = async (cd: CD) => {
        if (!supabase) return;
        setSyncStatus('saving');
        setError(null);
        const { error } = await supabase.from('cds').update(cd).eq('id', cd.id);
        if (error) {
            console.error("Update CD Supabase error:", error);
            setError(error.message);
            setSyncStatus('error');
        } else {
            setCollection(prev => prev.map(c => c.id === cd.id ? cd : c));
            setSyncStatus('synced');
        }
    };

    const deleteCD = async (id: string) => {
        if (!supabase) return;
        setSyncStatus('saving');
        setError(null);
        const { error } = await supabase.from('cds').delete().eq('id', id);
        if (error) {
            setError(error.message);
            setSyncStatus('error');
        } else {
            setCollection(prev => prev.filter(c => c.id !== id));
            setSyncStatus('synced');
        }
    };
    
    const addWantlistItem = async (itemData: Omit<WantlistItem, 'id' | 'created_at'>) => {
        if (!supabase || !user) return null;
        setSyncStatus('saving');
        setError(null);
        const { data, error } = await supabase.from('wantlist').insert({ ...itemData, user_id: user.id }).select();

        if (error) {
            console.error("Add Wantlist Supabase error:", error);
            setError(error.message);
            setSyncStatus('error');
            return null;
        }
        
        const newItem = data?.[0] as WantlistItem ?? null;
        if (newItem) {
            setWantlist(prev => [newItem, ...prev.filter(item => item.id !== newItem.id)]);
        }
        
        setSyncStatus('synced');
        return newItem;
    };

    const updateWantlistItem = async (item: WantlistItem) => {
        if (!supabase) return;
        setSyncStatus('saving');
        setError(null);
        const { error } = await supabase.from('wantlist').update(item).eq('id', item.id);
        if (error) {
            console.error("Update Wantlist Supabase error:", error);
            setError(error.message);
            setSyncStatus('error');
        } else {
            setWantlist(prev => prev.map(i => (i.id === item.id ? item : i)));
            setSyncStatus('synced');
        }
    };

    const deleteWantlistItem = async (id: string) => {
        if (!supabase) return;
        setSyncStatus('saving');
        setError(null);
        const { error } = await supabase.from('wantlist').delete().eq('id', id);

        if (error) {
            setError(error.message);
            setSyncStatus('error');
        } else {
            setWantlist(prev => prev.filter(item => item.id !== id));
            setSyncStatus('synced');
        }
    };

    const manualSync = useCallback(async () => {
        if (!supabase || !session) return;
        await loadDataFromSupabase();
    }, [session, loadDataFromSupabase]);

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
        manualSync,
        setSyncStatus,
    };
};