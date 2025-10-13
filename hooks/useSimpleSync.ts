
import { useState, useCallback } from 'react';
import { CD } from '../types';

export type SyncStatus = 'idle' | 'loading' | 'saving' | 'synced' | 'error' | 'disabled';

const BUCKET_URL = process.env.VITE_SIMPLE_SYNC_URL;

export const useSimpleSync = () => {
    const [syncStatus, setSyncStatus] = useState<SyncStatus>(BUCKET_URL ? 'idle' : 'disabled');
    const [error, setError] = useState<string | null>(BUCKET_URL ? null : 'Simple Sync is not configured. The administrator needs to provide a VITE_SIMPLE_SYNC_URL.');

    const loadCollection = useCallback(async (): Promise<CD[] | null> => {
        if (!BUCKET_URL) {
            setSyncStatus('disabled');
            return null;
        }

        setSyncStatus('loading');
        setError(null);

        try {
            const response = await fetch(BUCKET_URL);
            
            if (response.ok) {
                const text = await response.text();
                // Handle empty bucket
                if (!text) {
                    setSyncStatus('synced');
                    return [];
                }

                const data = JSON.parse(text);
                
                // Handle new format { "collection": [...] }
                if (data && data.collection && Array.isArray(data.collection)) {
                    setSyncStatus('synced');
                    return data.collection as CD[];
                }
                
                // Handle old format [...] for backward compatibility
                if (Array.isArray(data)) {
                    setSyncStatus('synced');
                    return data as CD[];
                }

                // If format is unexpected, treat as empty
                console.warn("Simple Sync data is in an unexpected format.", data);
                setSyncStatus('synced');
                return [];

            }
            if (response.status === 404) {
                // This can happen if the URL is wrong. Treat it as a new/empty collection but log a warning.
                console.warn('404 Not Found for Simple Sync URL. A new backup will be created on the first save.');
                setSyncStatus('synced');
                return [];
            }
            // Handle other HTTP errors
            throw new Error(`Failed to load collection: ${response.statusText}`);
        } catch (e) {
            console.error('Simple Sync load error:', e);
            setError('Could not load your collection from the cloud. Please check your connection and that the Simple Sync URL is correct.');
            setSyncStatus('error');
            return null;
        }
    }, []);
    
    const saveCollection = useCallback(async (cds: CD[]) => {
        if (!BUCKET_URL) {
            setSyncStatus('disabled');
            return;
        }

        setSyncStatus('saving');
        setError(null);

        try {
            const payload = { collection: cds };

            const response = await fetch(BUCKET_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
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

    return { syncStatus, error, loadCollection, saveCollection };
};
