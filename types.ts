export interface AlbumItem {
  id: string;
  artist: string;
  title: string;
  genre?: string[];
  year?: number;
  cover_art_url?: string;
  allmusic_url?: string;
  wikipedia_url?: string;
  review?: string;
  notes?: string;
  version?: string;
  record_label?: string;
  country?: string;
  producer?: string;
  tags?: string[];
  sort_name?: string;
  condition?: string;
  attributes?: string[];
  user_id?: string;
  created_at?: string;
  format?: 'cd' | 'vinyl';
}

export interface CD extends AlbumItem {}

export interface WantlistItem extends AlbumItem {}

export interface DriveRevision {
  id: string;
  modifiedTime: string;
}

export type SortKey = 'artist' | 'title' | 'year' | 'genre' | 'record_label' | 'created_at';
export type SortOrder = 'asc' | 'desc';

export type SyncStatus = 'idle' | 'loading' | 'saving' | 'synced' | 'error' | 'disabled' | 'authenticating';

export type SyncProvider = 'google_drive' | 'none';

export type CollectionMode = 'cd' | 'vinyl';
