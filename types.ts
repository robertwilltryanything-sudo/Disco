
export interface CD {
  id: string;
  artist: string;
  title: string;
  genre?: string;
  year?: number;
  cover_art_url?: string;
  notes?: string;
  version?: string;
  record_label?: string;
  tags?: string[];
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
  notes?: string;
  version?: string;
  record_label?: string;
  tags?: string[];
  user_id?: string;
  created_at?: string;
  format?: 'cd' | 'vinyl';
}

export interface CollectionData {
  collection: CD[];
  lastUpdated: string | null;
}

export type SortKey = 'artist' | 'title' | 'year' | 'genre' | 'record_label' | 'created_at';
export type SortOrder = 'asc' | 'desc';

export type SyncStatus = 'idle' | 'loading' | 'saving' | 'synced' | 'error' | 'disabled' | 'authenticating';

// Added 'supabase' to SyncProvider to allow comparison in useSupabaseSync hook
export type SyncProvider = 'google_drive' | 'supabase' | 'none';

export type SyncMode = 'realtime' | 'manual';

export type CollectionMode = 'cd' | 'vinyl';

export interface DiscographyAlbum {
  title: string;
  year: number;
}