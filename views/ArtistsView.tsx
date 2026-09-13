import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CD, CollectionMode } from '../types';
import { ArrowLeftIcon } from '../components/icons/ArrowLeftIcon';
import { SparklesIcon } from '../components/icons/SparklesIcon';

interface ArtistsViewProps {
  cds: CD[];
  collectionMode: CollectionMode;
  onOpenArtistSorter?: () => void;
}

const ArtistsView: React.FC<ArtistsViewProps> = ({ cds, collectionMode, onOpenArtistSorter }) => {
  const artists = useMemo(() => {
    const artistMap = new Map<string, string>();
    cds.forEach(cd => {
      if (cd && typeof cd.artist === 'string' && cd.artist.trim()) {
        const existing = artistMap.get(cd.artist);
        if (!existing || (cd.sort_name && cd.sort_name.trim())) {
          artistMap.set(cd.artist, (cd.sort_name && cd.sort_name.trim()) || cd.artist.trim());
        }
      }
    });
    
    return Array.from(artistMap.entries())
      .sort((a, b) => {
        const keyA = a[1].replace(/^the\s+/i, '').toLowerCase();
        const keyB = b[1].replace(/^the\s+/i, '').toLowerCase();
        return keyA.localeCompare(keyB);
      })
      .map(entry => entry[0]);
  }, [cds]);

  const albumType = collectionMode === 'vinyl' ? 'Vinyl' : 'CD';

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-3 justify-between items-center">
        <h1 className="text-3xl font-bold text-zinc-800">All Artists ({artists.length})</h1>
        <div className="flex items-center gap-3">
          {onOpenArtistSorter && (
            <button
              type="button"
              onClick={onOpenArtistSorter}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 text-xs font-bold transition-all shadow-xs"
              title="Automatically sort all bands under band names and solo artists by surname"
            >
              <SparklesIcon className="w-3.5 h-3.5 text-amber-600" />
              <span>Fix Artist Sorting</span>
            </button>
          )}
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-zinc-600 font-medium"
          >
            <ArrowLeftIcon className="h-5 w-5" />
            Back to Collection
          </Link>
        </div>
      </div>

      {artists.length === 0 ? (
        <div className="text-center py-10 px-4 bg-zinc-50 rounded-lg border border-dashed border-zinc-300">
            <p className="text-zinc-600">No artists found in your collection.</p>
            <p className="text-sm text-zinc-500 mt-1">Add a new {albumType} to get started!</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-zinc-200 p-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-6 gap-y-4">
            {artists.map(artist => (
                <Link
                key={artist}
                to={`/?artist=${encodeURIComponent(artist)}&sort=year&order=asc`}
                className="block text-zinc-700 p-2 rounded-lg truncate"
                title={artist}
                >
                {artist}
                </Link>
            ))}
            </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(ArtistsView);