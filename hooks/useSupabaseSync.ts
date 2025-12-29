import { useState, useEffect, useRef, Dispatch, SetStateAction, useCallback } from 'react';
import { createClient, SupabaseClient, Session, User, RealtimeChannel } from '@supabase/supabase-js';
import { CD, SyncStatus, SyncMode, WantlistItem, SyncProvider } from '../types';
import { areStringsSimilar } from '../utils';

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

const normalizeIncomingData = <T extends CD | WantlistItem>(item: any): T => {
    if (!item) return item;
    const normalized = { ...item };
    if (item.coverArtUrl && !item.cover_art_url) normalized.cover_art_url = item.coverArtUrl;
    if (item.recordLabel && !item.record_label) normalized.record_label = item.recordLabel;
    delete normalized.coverArtUrl;
    delete normalized.recordLabel;
    return normalized as T;
};

const cleanPayload = (data: any) => {
    const validKeys = [
        'artist', 'title', 'genre', 'year', 'cover_art_url', 
        'notes', 'version', 'record_label', 'tags', 'format'
    ];
    
    const source = { ...data };
    if (source.recordLabel && !source.record_label) source.record_label = source.recordLabel;
    if (source.coverArtUrl && !source.cover_art_url) source.cover_art_url = source.coverArtUrl;

    if (source.id) {
        validKeys.push('id');
    }

    const cleaned: any = {};
    validKeys.forEach(key => {
        if (source[key] !== undefined) {
            cleaned[key] = source[key];
        }
    });
    
    return cleaned;
};

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
            return allItems.map(normalizeIncomingData);
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
                        const newCd = normalizeIncomingData<CD>(payload.new);
                        if (payload.eventType === 'INSERT') {
                            setCollection(prev => {
                                // Double Entry Prevention: 
                                // Check if we already have an item with this ID OR a matching Artist/Title 
                                // that was added optimistically (no userId or matching temporary ID).
                                const exists = prev.some(cd => 
                                    cd.id === newCd.id || 
                                    (areStringsSimilar(cd.artist, newCd.artist) && areStringsSimilar(cd.title, newCd.title))
                                );
                                if (exists) {
                                    // Replace the optimistic one with the official one from the DB
                                    return prev.map(cd => 
                                        (cd.id === newCd.id || (areStringsSimilar(cd.artist, newCd.artist) && areStringsSimilar(cd.title, newCd.title))) 
                                        ? newCd : cd
                                    );
                                }
                                return [newCd, ...prev];
                            });
                        } else if (payload.eventType === 'UPDATE') {
                            setCollection(prev => prev.map(cd => cd.id === newCd.id ? newCd : cd));
                        } else if (payload.eventType === 'DELETE') {
                            setCollection(prev => prev.filter(cd => cd.id !== payload.old.id));
                        }
                    })
                    .subscribe();
                collectionChannelRef.current = collectionChannel;
                
                const wantlistChannel = supabase.channel('wantlist-changes')
                    .on('postgres_changes', { event: '*', schema: 'public', table: 'wantlist' }, (payload) => {
                         const newItem = normalizeIncomingData<WantlistItem>(payload.new);
                         if (payload.eventType === 'INSERT') {
                            setWantlist(prev => {
                                const exists = prev.some(i => 
                                    i.id === newItem.id || 
                                    (areStringsSimilar(i.artist, newItem.artist) && areStringsSimilar(i.title, newItem.title))
                                );
                                if (exists) {
                                    return prev.map(i => 
                                        (i.id === newItem.id || (areStringsSimilar(i.artist, newItem.artist) && areStringsSimilar(i.title, newItem.title)))
                                        ? newItem : i
                                    );
                                }
                                return [newItem, ...prev];
                            });
                        } else if (payload.eventType === 'UPDATE') {
                            setWantlist(prev => prev.map(item => item.id === newItem.id ? newItem : item));
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

    const addCD = async (cdData: Omit<CD, 'id'> & { id?: string }) => {
        if (!supabase || !user) throw new Error("Authentication required.");
        setSyncStatus('saving');
        setError(null);
        const payload = { ...cleanPayload(cdData), user_id: user.id };
        const { data, error: dbError } = await supabase.from('collection').insert(payload).select();
        if (dbError) {
            setError(dbError.message);
            setSyncStatus('error');
            throw new Error(dbError.message);
        }
        const newCd = normalizeIncomingData<CD>(data?.[0]) ?? null;
        if (newCd) setSyncStatus('synced');
        return newCd;
    };

    const updateCD = async (cd: CD) => {
        if (!supabase || !user) throw new Error("Database connection required.");
        setSyncStatus('saving');
        setError(null);
        const payload = cleanPayload(cd);
        const { data, error: dbError } = await supabase.from('collection').update(payload).eq('id', cd.id).select();
        if (dbError) {
            setError(dbError.message);
            setSyncStatus('error');
            throw new Error(dbError.message);
        }
        const updatedCd = normalizeIncomingData<CD>(data?.[0]) ?? null;
        if (updatedCd) setSyncStatus('synced');
        return !!updatedCd;
    };

    const deleteCD = async (id: string) => {
        if (!supabase) throw new Error("Database connection required.");
        setSyncStatus('saving');
        setError(null);
        const { error: dbError } = await supabase.from('collection').delete().eq('id', id);
        if (dbError) {
            setError(dbError.message);
            setSyncStatus('error');
            throw dbError;
        }
        setSyncStatus('synced');
        return true;
    };
    
    const addWantlistItem = async (itemData: Omit<WantlistItem, 'id'> & { id?: string }) => {
        if (!supabase || !user) throw new Error("Authentication required.");
        setSyncStatus('saving');
        setError(null);
        const payload = { ...cleanPayload(itemData), user_id: user.id };
        const { data, error: dbError } = await supabase.from('wantlist').insert(payload).select();
        if (dbError) {
            setError(dbError.message);
            setSyncStatus('error');
            throw new Error(dbError.message);
        }
        const newItem = normalizeIncomingData<WantlistItem>(data?.[0]) ?? null;
        if (newItem) setSyncStatus('synced');
        return newItem;
    };

    const updateWantlistItem = async (item: WantlistItem) => {
        if (!supabase || !user) throw new Error("Database connection required.");
        setSyncStatus('saving');
        setError(null);
        const payload = cleanPayload(item);
        const { data, error: dbError } = await supabase.from('wantlist').update(payload).eq('id', item.id).select();
        if (dbError) {
            setError(dbError.message);
            setSyncStatus('error');
            throw new Error(dbError.message);
        }
        const updatedItem = normalizeIncomingData<WantlistItem>(data?.[0]) ?? null;
        if (updatedItem) setSyncStatus('synced');
        return !!updatedItem;
    };

    const deleteWantlistItem = async (id: string) => {
        if (!supabase) throw new Error("Database connection required.");
        setSyncStatus('saving');
        setError(null);
        const { error: dbError } = await supabase.from('wantlist').delete().eq('id', id);
        if (dbError) {
            setError(dbError.message);
            setSyncStatus('error');
            throw dbError;
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