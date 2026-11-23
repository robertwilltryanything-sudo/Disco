import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CD, CollectionMode } from '../types';
import { AlbumIcon } from './icons/AlbumIcon';
import { MusicianIcon } from './icons/MusicianIcon';
import { ClockIcon } from './icons/ClockIcon';
import { StarIcon } from './icons/StarIcon';

interface QuickStatsProps {
  cds: CD[];
  className?: string;
  collectionMode: CollectionMode;
}

const StatItem: React.FC<{ label: string; value: string | number; icon: React.ReactNode; }> = ({ label, value, icon }) => (
    <div className="flex justify-between items-center py-3">
        <div className="flex items-center gap-3">
            {icon}
            <span className="text-sm font-medium text-zinc-600">{label}</span>
        </div>
        <span className="font-medium text-zinc-900 truncate" title={String(value)}>{value}</span>
    </div>
);

const QuickStats: React.FC<QuickStatsProps> = ({ cds, className = '', collectionMode }) => {
  const { totalCDs, uniqueArtists, latestCD, mostProlificArtist } = useMemo(() => {
    if (!cds || cds.length === 0) {
      return { totalCDs: 0, uniqueArtists: 0, latestCD: null, mostProlificArtist: null };
    }

    let latest: CD | null = null;
    let latestTime = -Infinity;
    const artistCounts: Record<string, number> = {};

    for (const cd of cds) {
      if (!cd) continue;
      const t = cd.created_at ? Date.parse(cd.created_at) : 0;
      const validTime = Number.isFinite(t) ? t : 0;
      if (!latest || validTime > latestTime) {
        latest = cd;
        latestTime = validTime;
      }
      if (cd.artist) {
        artistCounts[cd.artist] = (artistCounts[cd.artist] || 0) + 1;
      }
    }

    const artistEntries = Object.entries(artistCounts);
    const uniqueArtistCount = artistEntries.length;

    let prolificArtist: { name: string; count: number } | null = null;
    for (const [name, count] of artistEntries) {
      if (!prolificArtist || count > prolificArtist.count) {
        prolificArtist = { name, count };
      }
    }

    return {
      totalCDs: cds.length,
      uniqueArtists: uniqueArtistCount,
      latestCD: latest,
      mostProlificArtist: prolificArtist,
    };
  }, [cds]);

  const albumType = collectionMode === 'vinyl' ? 'Vinyl' : 'CDs';

  return (
    <div className={`bg-white rounded-lg border border-zinc-200 p-6 h-full flex flex-col ${className}`}>
        <h3 className="text-lg font-bold text-zinc-800">Collection Snapshot</h3>
        <div className="divide-y divide-zinc-200 flex-grow">
            <StatItem label={`Total ${albumType}`} value={totalCDs} icon={<AlbumIcon className="w-5 h-5 text-zinc-500" />} />
            <StatItem label="Unique Artists" value={uniqueArtists} icon={<MusicianIcon className="w-5 h-5 text-zinc-500" />} />
            {latestCD && (
                <div className="flex justify-between items-center py-3">
                    <div className="flex items-center gap-3">
                        <ClockIcon className="w-5 h-5 text-zinc-500" />
                        <span className="text-sm font-medium text-zinc-600">Latest Addition</span>
                    </div>
                    <Link
                        to={`/cd/${latestCD.id}`}
                        className="font-medium text-zinc-900 text-right text-sm truncate"
                        title={`${latestCD.title} by ${latestCD.artist}`}
                    >
                        {latestCD.title}
                    </Link>
                </div>
            )}
            {mostProlificArtist && (
                <div className="flex justify-between items-center py-3">
                    <div className="flex items-center gap-3">
                        <StarIcon className="w-5 h-5 text-zinc-500" />
                        <span className="text-sm font-medium text-zinc-600">Top Artist</span>
                    </div>
                    <Link
                        to={`/?q=${encodeURIComponent(mostProlificArtist.name)}`}
                        className="font-medium text-zinc-900 text-right text-sm truncate"
                        title={`${mostProlificArtist.name} (${mostProlificArtist.count} albums)`}
                    >
                        {mostProlificArtist.name}
                    </Link>
                </div>
            )}
        </div>
        <Link 
            to="/stats"
            className="mt-4 block w-full text-center bg-zinc-100 text-zinc-800 font-bold py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-800"
        >
            View Full Stats
        </Link>
    </div>
  );
};

export default React.memo(QuickStats);