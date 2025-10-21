import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CD } from '../types';
import { ArrowLeftIcon } from '../components/icons/ArrowLeftIcon';
import { capitalizeWords } from '../utils';

interface DashboardViewProps {
  cds: CD[];
}

// A simple, reusable bar chart component for the dashboard
const BarChart = ({ data, title, onFilter }: { data: { label: string; value: number }[], title: string, onFilter: (value: string) => void }) => {
  const maxValue = Math.max(1, ...data.map(d => d.value)); // Use Math.max(1, ...) to avoid division by zero
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
                            className={`${barColor} h-6 rounded-full transition-all duration-500 ease-out`}
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


const TopItemsList = ({ data, title, onFilter }: { data: { label: string; value: number }[], title: string, onFilter: (value: string) => void }) => (
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


const DashboardView: React.FC<DashboardViewProps> = ({ cds }) => {
    const navigate = useNavigate();

    const handleNavigate = (filterValue: string) => {
        navigate({ pathname: '/', search: `?q=${encodeURIComponent(filterValue)}` });
    };

    const { uniqueArtists, albumsByDecade, topGenres, topLabels } = useMemo(() => {
        const artistSet = new Set(cds.map(cd => cd.artist));

        const decadeCounts: { [key: string]: number } = {};
        cds.forEach(cd => {
            if (cd.year) {
                const decade = Math.floor(cd.year / 10) * 10;
                const decadeLabel = `${decade}s`;
                decadeCounts[decadeLabel] = (decadeCounts[decadeLabel] || 0) + 1;
            }
        });

        const sortedDecades = Object.entries(decadeCounts)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([label, value]) => ({ label, value }));
        
        const countItems = (key: 'genre' | 'recordLabel') => {
            const counts: { [key: string]: number } = {};
            cds.forEach(cd => {
                const item = cd[key];
                if (item) {
                    // Use original casing for display, but lowercase for counting
                    const lowerItem = item.toLowerCase();
                    counts[lowerItem] = (counts[lowerItem] || 0) + 1;
                }
            });
            return Object.entries(counts)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([label, value]) => ({ label, value }));
        };

        return {
            uniqueArtists: artistSet.size,
            albumsByDecade: sortedDecades,
            topGenres: countItems('genre'),
            topLabels: countItems('recordLabel'),
        };
    }, [cds]);


  return (
    <div className="space-y-6">
        <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-zinc-800">Collection Dashboard</h1>
            <Link
            to="/"
            className="inline-flex items-center gap-2 text-zinc-600 hover:text-zinc-900 font-medium"
            >
            <ArrowLeftIcon className="h-5 w-5" />
            Back to Collection
            </Link>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg border border-zinc-200 p-6 text-center">
                <p className="text-sm font-medium text-zinc-500 uppercase">Total CDs</p>
                <p className="text-4xl text-zinc-900 mt-1">{cds.length}</p>
            </div>
            <div className="bg-white rounded-lg border border-zinc-200 p-6 text-center">
                <p className="text-sm font-medium text-zinc-500 uppercase">Unique Artists</p>
                <p className="text-4xl text-zinc-900 mt-1">{uniqueArtists}</p>
            </div>
        </div>
        
        <BarChart 
            data={albumsByDecade} 
            title="Albums by Decade" 
            onFilter={handleNavigate}
        />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <TopItemsList 
                data={topGenres} 
                title="Top 5 Genres"
                onFilter={handleNavigate}
            />
            <TopItemsList 
                data={topLabels} 
                title="Top 5 Record Labels" 
                onFilter={handleNavigate}
            />
        </div>
    </div>
  );
};

export default DashboardView;