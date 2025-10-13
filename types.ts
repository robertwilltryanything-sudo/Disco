export interface CD {
  id: string;
  artist: string;
  title: string;
  genre?: string;
  year?: number;
  coverArtUrl?: string;
  notes?: string;
  version?: string;
  recordLabel?: string;
  tags?: string[];
}

export interface CollectionData {
  collection: CD[];
  lastUpdated: string | null;
}

export type SortKey = 'artist' | 'title' | 'year' | 'genre' | 'recordLabel';
export type SortOrder = 'asc' | 'desc';