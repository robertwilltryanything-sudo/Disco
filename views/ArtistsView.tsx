import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CD, CollectionMode } from '../types';
import { ArrowLeftIcon } from '../components/icons/ArrowLeftIcon';

interface ArtistsViewProps {
  cds: CD[];
  collectionMode: CollectionMode;
}

const ArtistsView: React.FC<ArtistsViewProps> = ({ cds, collectionMode }) => {
  const artists = useMemo(() => {
    const artistMap = new Map<string, string>();
    cds.forEach(cd => {
      if (cd && typeof cd.artist === 'string' && cd.artist && !artistMap.has(cd.artist)) {
        artistMap.set(cd.artist, cd.sort_name || cd.artist);
      }
    });
    
    return Array.from(artistMap.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(entry => entry[0]);
  }, [cds]);

  const albumType = collectionMode === 'vinyl' ? 'Vinyl' : 'CD';

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-zinc-800">All Artists ({artists.length})</h1>
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-zinc-600 font-medium"
        >
          <ArrowLeftIcon className="h-5 w-5" />
          Back to Collection
        </Link>
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