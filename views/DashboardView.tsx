import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CD, CollectionMode } from '../types';
import { ArrowLeftIcon } from '../components/icons/ArrowLeftIcon';
import { capitalizeWords } from '../utils';
import { AlbumIcon } from '../components/icons/AlbumIcon';
import { MusicianIcon } from '../components/icons/MusicianIcon';

interface DashboardViewProps {
  cds: CD[];
  collectionMode: CollectionMode;
}

interface ChartDataItem {
  label: string;
  value: number;
}

/**
 * A simple, reusable bar chart component for the dashboard.
 */
const BarChart: React.FC<{ data: ChartDataItem[]; title: string; onFilter: (value: string) => void }> = ({ data, title, onFilter }) => {
  const maxValue = Math.max(1, ...data.map(d => d.value));
  const barColors = [
    'bg-sky-300',
    'bg-orange-200',
    'bg-yellow-200',
    'bg-pink-300',
    'bg-teal-200',
    'bg-indigo-200',
    'bg-rose-200',
    'bg-lime-200',
  ];

  return (
    <div className="bg-white rounded-lg border border-zinc-200 p-6">
      <h3 className="text-lg font-bold text-zinc-800 mb-4">{title}</h3>
      <div className="space-y-3">
        {data.length > 0 ? (
          data.map((item, index) => {
            const barWidthPercentage = (item.value / maxValue) * 100;
            const barColor = barColors[index % barColors.length];
            return (
                <div key={item.label} className="grid grid-cols-[80px_1fr_40px] items-center gap-3" aria-label={`${item.label}: ${item.value} albums`}>
                    <button 
                        onClick={() => onFilter(item.label.slice(0, 4))}
                        className="text-sm font-medium text-zinc-600 text-right truncate hover:text-zinc-900 hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500 rounded-sm" 
                        title={`Filter by ${item.label}`}
                    >
                        {item.label}
                    </button>
                    <div className="w-full bg-zinc-200 rounded-full h-6" role="presentation">
                        <div
                            className={`${barColor} h-6 rounded-full`}
                            style={{ width: `${barWidthPercentage}%` }}
                            role="progressbar"
                            aria-valuenow={item.value}
                            aria-valuemin={0}
                            aria-valuemax={maxValue}
                        />
                    </div>
                    <span className="text-sm font-bold text-zinc-800 text-left">
                        {item.value}
                    </span>
                </div>
            );
          })
        ) : (
          <p className="text-zinc-500">Not enough data to display.</p>
        )}
      </div>
    </div>
  );
};

/**
 * Component for top items (labels, genres).
 */
const TopItemsList: React.FC<{ data: ChartDataItem[]; title: string; onFilter: (value: string) => void }> = ({ data, title, onFilter }) => (
    <div className="bg-white rounded-lg border border-zinc-200 p-6">
        <h3 className="text-lg font-bold text-zinc-800 mb-4">{title}</h3>
        <div className="space-y-2">
            {data.length > 0 ? (
                <ul className="divide-y divide-zinc-200">
                    {data.map(item => (
                        <li key={item.label} className="py-2 flex justify-between items-center">
                            <button 
                                onClick={() => onFilter(item.label)}
                                className="text-zinc-700 hover:text-zinc-900 hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500 rounded-sm" 
                                title={`Filter by ${capitalizeWords(item.label)}`}
                            >
                                {capitalizeWords(item.label)}
                            </button>
                            <span className="font-bold text-zinc-900 bg-zinc-200 text-xs py-1 px-2 rounded-full">{item.value}</span>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="text-zinc-500">Not enough data to display.</p>
            )}
        </div>
    </div>
);

const DashboardView: React.FC<DashboardViewProps> = ({ cds, collectionMode }) => {
    const navigate = useNavigate();

    const handleNavigate = (filterValue: string) => {
        navigate({ pathname: '/', search: `?q=${encodeURIComponent(filterValue)}` });
    };

    const stats = useMemo(() => {
        const validCds = cds.filter((cd: CD) => !!cd);

        const artistSet = new Set(validCds.map((cd: CD) => cd.artist).filter(Boolean));

        const decadeCounts: Record<string, number> = {};
        validCds.forEach((cd: CD) => {
            if (cd.year) {
                const decade = Math.floor(cd.year / 10) * 10;
                const decadeLabel = `${decade}s`;
                decadeCounts[decadeLabel] = (decadeCounts[decadeLabel] || 0) + 1;
            }
        });

        const sortedDecades = Object.entries(decadeCounts)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([label, value]) => ({ label, value }));
        
        const countItems = (key: 'genre' | 'record_label') => {
            const counts: Record<string, number> = {};
            validCds.forEach((cd: CD) => {
                const itemValue = cd[key];
                if (itemValue) {
                    const lowerItem = itemValue.toLowerCase();
                    counts[lowerItem] = (counts[lowerItem] || 0) + 1;
                }
            });
            return Object.entries(counts)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([label, value]) => ({ label, value }));
        };

        return {
            uniqueArtistsCount: artistSet.size,
            albumsByDecade: sortedDecades,
            topGenres: countItems('genre'),
            topLabels: countItems('record_label'),
        };
    }, [cds]);
    
    const albumTypePlural = collectionMode === 'vinyl' ? 'Vinyl' : 'CDs';
    const albumType = collectionMode === 'vinyl' ? 'Vinyl' : 'CD';

    return (
    <div>
        <div className="mb-6 flex justify-between items-center">
            <h1 className="text-3xl font-bold text-zinc-800">Stats</h1>
            <Link to="/" className="inline-flex items-center gap-2 text-zinc-600 hover:text-zinc-900 font-medium">
                <ArrowLeftIcon className="h-5 w-5" />
                Back to Collection
            </Link>
        </div>

        {cds.length === 0 ? (
             <div className="text-center py-10 px-4 bg-zinc-50 rounded-lg border border-dashed border-zinc-300">
                <p className="text-zinc-600">Your {collectionMode} collection is empty.</p>
                <p className="text-sm text-zinc-500 mt-1">Add some {albumTypePlural} to see your stats here!</p>
            </div>
        ) : (
            <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                    <div className="relative bg-white rounded-lg border border-zinc-200 p-6 overflow-hidden">
                       <div className="relative z-10">
                         <h3 className="text-base font-bold text-zinc-500 uppercase tracking-wider">
                           Total {albumTypePlural}
                         </h3>
                         <p className="text-4xl font-extrabold text-zinc-900 mt-1">{cds.length}</p>
                       </div>
                       <AlbumIcon className="absolute -right-4 -bottom-4 w-24 h-24 text-zinc-100" />
                    </div>
                    <div className="relative bg-white rounded-lg border border-zinc-200 p-6 overflow-hidden">
                        <div className="relative z-10">
                           <h3 className="text-base font-bold text-zinc-500 uppercase tracking-wider">
                              Unique Artists
                           </h3>
                           <p className="text-4xl font-extrabold text-zinc-900 mt-1">{stats.uniqueArtistsCount}</p>
                       </div>
                       <MusicianIcon className="absolute -right-4 -bottom-4 w-24 h-24 text-zinc-100" />
                    </div>
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <BarChart data={stats.albumsByDecade} title={`${albumType}s by Decade`} onFilter={handleNavigate} />
                    <div className="space-y-6">
                        <TopItemsList data={stats.topGenres} title="Top 5 Genres" onFilter={handleNavigate} />
                        <TopItemsList data={stats.topLabels} title="Top 5 Record Labels" onFilter={handleNavigate} />
                    </div>
                </div>
            </>
        )}
    </div>
  );
};

export default DashboardView;