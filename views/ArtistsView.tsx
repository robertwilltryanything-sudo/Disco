import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CD } from '../types';
import { ArrowLeftIcon } from '../components/icons/ArrowLeftIcon';
import { capitalizeWords } from '../utils';

interface ArtistsViewProps {
  cds: CD[];
}

const ArtistsView: React.FC<ArtistsViewProps> = ({ cds }) => {
  const artists = useMemo(() => {
    // Filter for CDs that have a valid, non-empty artist string to prevent errors.
    // FIX: Explicitly type the Set to ensure TypeScript infers a Set of strings,
    // which allows for correct type inference during the sort operation.
    const artistSet = new Set<string>(
        cds.filter(cd => cd && typeof cd.artist === 'string' && cd.artist)
           .map(cd => cd.artist)
    );
    // Now that we're guaranteed to have strings, we can sort safely.
    return [...artistSet].sort((a, b) => a.localeCompare(b));
  }, [cds]);

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-zinc-800">All Artists ({artists.length})</h1>
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-zinc-600 hover:text-zinc-900 font-medium"
        >
          <ArrowLeftIcon className="h-5 w-5" />
          Back to Collection
        </Link>
      </div>

      {artists.length === 0 ? (
        <div className="text-center py-10 px-4 bg-zinc-50 rounded-lg border border-dashed border-zinc-300">
            <p className="text-zinc-600">No artists found in your collection.</p>
            <p className="text-sm text-zinc-500 mt-1">Add a new CD to get started!</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-zinc-200 p-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-6 gap-y-4">
            {artists.map(artist => (
                <Link
                key={artist}
                to={`/artist/${encodeURIComponent(artist)}`}
                className="block text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100 p-2 rounded-lg truncate"
                title={artist}
                >
                {capitalizeWords(artist)}
                </Link>
            ))}
            </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(ArtistsView);