import { useState, useCallback } from 'react';
import { CD, CollectionData } from '../types';

export type SyncStatus = 'idle' | 'loading' | 'saving' | 'synced' | 'error' | 'disabled';

const BUCKET_URL = process.env.VITE_SIMPLE_SYNC_URL;

export const useSimpleSync = () => {
    const [syncStatus, setSyncStatus] = useState<SyncStatus>(BUCKET_URL ? 'idle' : 'disabled');
    const [error, setError] = useState<string | null>(BUCKET_URL ? null : 'Simple Sync is not configured. The administrator needs to provide a VITE_SIMPLE_SYNC_URL.');

    const loadCollection = useCallback(async (): Promise<CollectionData | null> => {
        if (!BUCKET_URL) {
            setSyncStatus('disabled');
            return null;
        }

        setSyncStatus('loading');
        setError(null);

        try {
            const url = `${BUCKET_URL}?t=${new Date().getTime()}`;
            
            const response = await fetch(url, {
                cache: 'no-store',
                mode: 'cors',
                headers: {
                    'Cache-Control': 'no-cache, no-store, must-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0',
                },
            });
            
            if (response.ok) {
                const text = await response.text();
                if (!text) {
                    setSyncStatus('synced');
                    return { collection: [], lastUpdated: null };
                }

                const data = JSON.parse(text);
                
                // Handle new format { "collection": [...], "lastUpdated": "..." }
                if (data && typeof data === 'object' && Array.isArray(data.collection)) {
                    setSyncStatus('synced');
                    return data as CollectionData;
                }
                
                // Handle old format [...] for backward compatibility
                if (Array.isArray(data)) {
                    console.log("Loaded collection in legacy format. It will be updated on the next save.");
                    setSyncStatus('synced');
                    // Provide a null timestamp to indicate it's a legacy format
                    return { collection: data as CD[], lastUpdated: null };
                }

                console.warn("Simple Sync data is in an unexpected format.", data);
                setSyncStatus('synced');
                return { collection: [], lastUpdated: null };

            }
            if (response.status === 404) {
                console.warn('404 Not Found for Simple Sync URL. A new backup will be created on the first save.');
                setSyncStatus('synced');
                return { collection: [], lastUpdated: null };
            }
            throw new Error(`Failed to load collection: ${response.statusText}`);
        } catch (e) {
            console.error('Simple Sync load error:', e);
            setError('Could not load your collection from the cloud. Please check your connection and that the Simple Sync URL is correct.');
            setSyncStatus('error');
            return null;
        }
    }, []);
    
    const saveCollection = useCallback(async (data: CollectionData) => {
        if (!BUCKET_URL) {
            setSyncStatus('disabled');
            return;
        }

        setSyncStatus('saving');
        setError(null);

        try {
            const response = await fetch(BUCKET_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
                mode: 'cors',
            });

            if (!response.ok) {
                throw new Error(`Failed to save collection: ${response.statusText} (${response.status})`);
            }

            setSyncStatus('synced');
        } catch (e) {
            console.error('Simple Sync save error:', e);
            setError('Could not save your collection to the cloud. Please check your connection.');
            setSyncStatus('error');
        }
    }, []);

    return { syncStatus, error, loadCollection, saveCollection, setSyncStatus };
};