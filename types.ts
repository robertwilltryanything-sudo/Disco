export interface CD {
  id: string;
  artist: string;
  title: string;
  genre?: string;
  year?: number;
  cover_art_url?: string;
  allmusic_url?: string;
  wikipedia_url?: string;
  review?: string;
  notes?: string;
  version?: string;
  record_label?: string;
  tags?: string[];
  condition?: string;
  attributes?: string[];
  user_id?: string;
  created_at?: string;
  format?: 'cd' | 'vinyl';
}

export interface WantlistItem {
  id: string;
  artist: string;
  title: string;
  genre?: string;
  year?: number;
  cover_art_url?: string;
  allmusic_url?: string;
  wikipedia_url?: string;
  review?: string;
  notes?: string;
  version?: string;
  record_label?: string;
  tags?: string[];
  condition?: string;
  attributes?: string[];
  user_id?: string;
  created_at?: string;
  format?: 'cd' | 'vinyl';
}

export interface CollectionData {
  collection: CD[];
  lastUpdated: string | null;
}

export interface DriveRevision {
  id: string;
  modifiedTime: string;
}

export type SortKey = 'artist' | 'title' | 'year' | 'genre' | 'record_label' | 'created_at';
export type SortOrder = 'asc' | 'desc';

export type SyncStatus = 'idle' | 'loading' | 'saving' | 'synced' | 'error' | 'disabled' | 'authenticating';

// Added 'supabase' to SyncProvider to fix type comparison errors in hooks/useSupabaseSync.ts
export type SyncProvider = 'google_drive' | 'supabase' | 'none';

export type SyncMode = 'realtime' | 'manual';

export type CollectionMode = 'cd' | 'vinyl';
