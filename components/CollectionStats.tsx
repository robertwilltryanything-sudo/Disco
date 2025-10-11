import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CD } from '../types';
import { capitalizeWords } from '../utils';
import { QueueListIcon } from './icons/QueueListIcon';
import { UserGroupIcon } from './icons/UserGroupIcon';
import { ClockIcon } from './icons/ClockIcon';
import { StarIcon } from './icons/StarIcon';

interface QuickStatsProps {
  cds: CD[];
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

const QuickStats: React.FC<QuickStatsProps> = ({ cds }) => {
  const { totalCDs, uniqueArtists, latestCD, mostProlificArtist } = useMemo(() => {
    if (cds.length === 0) {
      return {
        totalCDs: 0,
        uniqueArtists: 0,
        latestCD: null,
        mostProlificArtist: null,
      };
    }

    const uniqueArtistsSet = new Set(cds.map(cd => cd.artist));
    const latestCD = cds[0]; // Most recently added CD is at the start of the array
    
    const artistCounts: { [artist: string]: number } = {};
    cds.forEach(cd => {
      artistCounts[cd.artist] = (artistCounts[cd.artist] || 0) + 1;
    });

    let prolificArtist: { artist: string; count: number } | null = null;
    if (Object.keys(artistCounts).length > 0) {
      const [artist, count] = Object.entries(artistCounts).reduce((a, b) => a[1] > b[1] ? a : b);
      if (count > 1) { // Only show if an artist has more than one album
        prolificArtist = { artist, count };
      }
    }

    return {
      totalCDs: cds.length,
      uniqueArtists: uniqueArtistsSet.size,
      latestCD,
      mostProlificArtist: prolificArtist,
    };
  }, [cds]);

  return (
    <div className="bg-white rounded-lg border border-zinc-200 p-4 h-full flex flex-col">
      <p className="text-sm font-bold uppercase tracking-wider text-zinc-500 mb-2">Collection Snapshot</p>
      <div className="divide-y divide-zinc-200">
        <StatItem label="Total CDs" value={totalCDs} icon={<QueueListIcon className="w-5 h-5 text-zinc-400" />} />
        <StatItem label="Unique Artists" value={uniqueArtists} icon={<UserGroupIcon className="w-5 h-5 text-zinc-400" />} />
        {latestCD && (
          <Link to={`/cd/${latestCD.id}`} className="block group hover:bg-zinc-50 -mx-4 px-4 rounded-lg transition-colors duration-150">
            <div className="flex justify-between items-center py-3 gap-4">
                <div className="flex items-center gap-3">
                    <ClockIcon className="w-5 h-5 text-zinc-400" />
                    <span className="text-sm font-medium text-zinc-600 flex-shrink-0">Latest Addition</span>
                </div>
              <span 
                className="font-medium text-zinc-900 truncate group-hover:underline text-right" 
                title={`${capitalizeWords(latestCD.artist)} - ${latestCD.title}`}>
                  {`${capitalizeWords(latestCD.artist)} - ${latestCD.title}`}
              </span>
            </div>
          </Link>
        )}
        {mostProlificArtist && (
            <Link to={`/`} state={{ filterByArtist: mostProlificArtist.artist }} className="block group hover:bg-zinc-50 -mx-4 px-4 rounded-lg transition-colors duration-150">
                <div className="flex justify-between items-center py-3 gap-4">
                    <div className="flex items-center gap-3">
                        <StarIcon className="w-5 h-5 text-zinc-400" />
                        <span className="text-sm font-medium text-zinc-600 flex-shrink-0">Top Artist</span>
                    </div>
                    <span
                        className="font-medium text-zinc-900 truncate group-hover:underline text-right"
                        title={`${capitalizeWords(mostProlificArtist.artist)} (${mostProlificArtist.count} albums)`}>
                        {`${capitalizeWords(mostProlificArtist.artist)} (${mostProlificArtist.count})`}
                    </span>
                </div>
            </Link>
        )}
      </div>
    </div>
  );
};

export default React.memo(QuickStats);