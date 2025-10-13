import { useState, useCallback } from 'react';
import { CD } from '../types';

export type SyncStatus = 'idle' | 'loading' | 'saving' | 'synced' | 'error' | 'disabled';

const BUCKET_URL = process.env.VITE_SIMPLE_SYNC_URL;

export const useSimpleSync = () => {
    const [syncStatus, setSyncStatus] = useState<SyncStatus>(BUCKET_URL ? 'idle' : 'disabled');
    const [error, setError] = useState<string | null>(BUCKET_URL ? null : 'Simple Sync is not configured. The administrator needs to provide a VITE_SIMPLE_SYNC_URL.');

    const getUrl = (id: string) => `${BUCKET_URL}/${id}`;

    const loadCollection = useCallback(async (id: string): Promise<CD[] | null> => {
        if (!BUCKET_URL) {
            setSyncStatus('disabled');
            return null;
        }

        setSyncStatus('loading');
        setError(null);

        try {
            const response = await fetch(getUrl(id));
            if (response.ok) {
                const data = await response.json();
                setSyncStatus('synced');
                return data as CD[];
            }
            if (response.status === 404) {
                // This is not an error, it just means no backup exists yet for this ID.
                console.log('No backup found for this Sync ID. A new one will be created on the first save.');
                setSyncStatus('synced');
                return [];
            }
            // Handle other HTTP errors
            throw new Error(`Failed to load collection: ${response.statusText}`);
        } catch (e) {
            console.error('Simple Sync load error:', e);
            setError('Could not load your collection from the cloud. Please check your connection and Sync Key.');
            setSyncStatus('error');
            return null;
        }
    }, []);
    
    const saveCollection = useCallback(async (id: string, cds: CD[]) => {
        if (!BUCKET_URL) {
            setSyncStatus('disabled');
            return;
        }

        setSyncStatus('saving');
        setError(null);

        try {
            // FIX: Use 'PUT' to create or update the resource at the specific URL.
            // 'POST' is incorrect for this type of key-value store operation.
            const response = await fetch(getUrl(id), {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(cds),
            });

            if (!response.ok) {
                throw new Error(`Failed to save collection: ${response.statusText}`);
            }

            // Add a small delay so the user can see the 'saving' status
            setTimeout(() => setSyncStatus('synced'), 500);

        } catch (e) {
            console.error('Simple Sync save error:', e);
            setError('Could not save your collection to the cloud. Please check your connection.');
            setSyncStatus('error');
        }
    }, []);

    return { syncStatus, error, loadCollection, saveCollection };
};
