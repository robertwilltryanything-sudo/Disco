import React, { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';
import { CD, CollectionMode } from '../types';
import { ArrowLeftIcon } from '../components/icons/ArrowLeftIcon';
import { capitalizeWords } from '../utils';
import { AlbumIcon } from '../components/icons/AlbumIcon';
import { MusicianIcon } from '../components/icons/MusicianIcon';

interface DashboardViewProps {
  cds: CD[];
  collectionMode: CollectionMode;
}

/**
 * Original Disco dashboard color palette (Tailwind pastel colors):
 * bg-sky-300: #7dd3fc
 * bg-orange-200: #fed7aa
 * bg-yellow-200: #fef08a
 * bg-pink-300: #f9a8d4
 * bg-teal-200: #99f6e4
 * bg-indigo-200: #c7d2fe
 * bg-rose-200: #fecdd3
 * bg-lime-200: #d9f99d
 */
const DISCO_PALETTE = [
  { hex: '#7dd3fc', bg: 'bg-sky-300', text: 'text-sky-950', border: 'border-sky-400' },
  { hex: '#fed7aa', bg: 'bg-orange-200', text: 'text-orange-950', border: 'border-orange-400' },
  { hex: '#fef08a', bg: 'bg-yellow-200', text: 'text-yellow-950', border: 'border-yellow-400' },
  { hex: '#f9a8d4', bg: 'bg-pink-300', text: 'text-pink-950', border: 'border-pink-400' },
  { hex: '#99f6e4', bg: 'bg-teal-200', text: 'text-teal-950', border: 'border-teal-400' },
  { hex: '#c7d2fe', bg: 'bg-indigo-200', text: 'text-indigo-950', border: 'border-indigo-400' },
  { hex: '#fecdd3', bg: 'bg-rose-200', text: 'text-rose-950', border: 'border-rose-400' },
  { hex: '#d9f99d', bg: 'bg-lime-200', text: 'text-lime-950', border: 'border-lime-400' },
];

const DISCO_HEX_COLORS = DISCO_PALETTE.map(c => c.hex);

interface GenreChartItem {
  name: string;
  count: number;
  percentage: number;
  raw: string;
}

interface DecadeChartItem {
  decade: string;
  count: number;
  percentage: number;
  filterYear: string;
}

interface LabelItem {
  label: string;
  value: number;
}

const GenreTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data: GenreChartItem = payload[0].payload;
    const color = payload[0].color || payload[0].fill || DISCO_HEX_COLORS[0];
    return (
      <div className="bg-zinc-950 text-white px-3.5 py-2.5 rounded-lg shadow-xl text-xs border border-zinc-800 pointer-events-none z-50">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/20" style={{ backgroundColor: color }} />
          <p className="font-bold text-sm text-zinc-100">{data.name}</p>
        </div>
        <p className="text-zinc-300">
          <span className="font-bold text-white">{data.count}</span> {data.count === 1 ? 'album' : 'albums'} ({data.percentage}%)
        </p>
        <p className="text-[10px] text-zinc-400 mt-1.5 border-t border-zinc-800 pt-1">
          Click bar to filter collection
        </p>
      </div>
    );
  }
  return null;
};

const DecadeTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data: DecadeChartItem = payload[0].payload;
    const color = payload[0].color || payload[0].fill || DISCO_HEX_COLORS[0];
    return (
      <div className="bg-zinc-950 text-white px-3.5 py-2.5 rounded-lg shadow-xl text-xs border border-zinc-800 pointer-events-none z-50">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/20" style={{ backgroundColor: color }} />
          <p className="font-bold text-sm text-zinc-100">{data.decade}</p>
        </div>
        <p className="text-zinc-300">
          <span className="font-bold text-white">{data.count}</span> {data.count === 1 ? 'album' : 'albums'} ({data.percentage}%)
        </p>
        <p className="text-[10px] text-zinc-400 mt-1.5 border-t border-zinc-800 pt-1">
          Click bar to filter collection
        </p>
      </div>
    );
  }
  return null;
};

const DashboardView: React.FC<DashboardViewProps> = ({ cds, collectionMode }) => {
  const navigate = useNavigate();

  const handleNavigate = (filterValue: string) => {
    navigate({ pathname: '/', search: `?q=${encodeURIComponent(filterValue)}` });
  };

  const stats = useMemo(() => {
    const validCds = cds.filter((cd: CD) => !!cd);
    const artistSet = new Set(validCds.map((cd: CD) => cd.artist).filter(Boolean));

    // Decade breakdown
    const decadeCounts: Record<string, number> = {};
    let totalWithYear = 0;
    validCds.forEach((cd: CD) => {
      if (cd.year && !isNaN(cd.year)) {
        totalWithYear++;
        const decade = Math.floor(cd.year / 10) * 10;
        const decadeLabel = `${decade}s`;
        decadeCounts[decadeLabel] = (decadeCounts[decadeLabel] || 0) + 1;
      }
    });

    const sortedDecades: DecadeChartItem[] = Object.entries(decadeCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([decade, count]) => ({
        decade,
        count,
        percentage: totalWithYear > 0 ? Math.round((count / totalWithYear) * 100) : 0,
        filterYear: decade.slice(0, 4),
      }));

    // Genre breakdown (top 5)
    const genreCounts: Record<string, number> = {};
    let totalGenreOccurrences = 0;
    validCds.forEach((cd: CD) => {
      const genres = cd.genre;
      if (genres) {
        const list = Array.isArray(genres) ? genres : [genres as unknown as string];
        list.forEach(g => {
          if (typeof g === 'string') {
            const trimmed = g.trim();
            if (trimmed) {
              totalGenreOccurrences++;
              const lower = trimmed.toLowerCase();
              genreCounts[lower] = (genreCounts[lower] || 0) + 1;
            }
          }
        });
      }
    });

    const topGenres: GenreChartItem[] = Object.entries(genreCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([raw, count]) => ({
        name: capitalizeWords(raw),
        raw,
        count,
        percentage: totalGenreOccurrences > 0 ? Math.round((count / totalGenreOccurrences) * 100) : 0,
      }));

    // Record labels breakdown
    const labelCounts: Record<string, number> = {};
    validCds.forEach((cd: CD) => {
      if (cd.record_label) {
        const trimmed = cd.record_label.trim();
        if (trimmed) {
          const lower = trimmed.toLowerCase();
          labelCounts[lower] = (labelCounts[lower] || 0) + 1;
        }
      }
    });

    const topLabels: LabelItem[] = Object.entries(labelCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([label, value]) => ({ label: capitalizeWords(label), value }));

    return {
      uniqueArtistsCount: artistSet.size,
      albumsByDecade: sortedDecades,
      topGenres,
      topLabels,
      totalWithYear,
      totalGenreOccurrences,
    };
  }, [cds]);

  const albumTypePlural = collectionMode === 'vinyl' ? 'Vinyl' : 'CDs';
  const albumType = collectionMode === 'vinyl' ? 'Vinyl' : 'CD';

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-zinc-800">Stats</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Overview and historical metrics for your {collectionMode} collection.
          </p>
        </div>
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-zinc-600 hover:text-zinc-950 font-medium transition-colors"
        >
          <ArrowLeftIcon className="h-5 w-5" />
          Back to Collection
        </Link>
      </div>

      {cds.length === 0 ? (
        <div className="text-center py-12 px-4 bg-zinc-50 rounded-xl border border-dashed border-zinc-300">
          <p className="text-zinc-600 font-medium">Your {collectionMode} collection is empty.</p>
          <p className="text-sm text-zinc-500 mt-1">Add some {albumTypePlural} to see your analytics and charts here!</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative bg-white rounded-xl border border-zinc-200 p-5 shadow-sm overflow-hidden">
              <div className="relative z-10">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  Total {albumTypePlural}
                </h3>
                <p className="text-3xl font-extrabold text-zinc-900 mt-1">{cds.length}</p>
                <p className="text-xs text-zinc-400 mt-1">In your active library</p>
              </div>
              <AlbumIcon className="absolute -right-3 -bottom-3 w-20 h-20 text-zinc-100 pointer-events-none" />
            </div>

            <div className="relative bg-white rounded-xl border border-zinc-200 p-5 shadow-sm overflow-hidden">
              <div className="relative z-10">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  Unique Artists
                </h3>
                <p className="text-3xl font-extrabold text-zinc-900 mt-1">{stats.uniqueArtistsCount}</p>
                <p className="text-xs text-zinc-400 mt-1">Distinct musicians & bands</p>
              </div>
              <MusicianIcon className="absolute -right-3 -bottom-3 w-20 h-20 text-zinc-100 pointer-events-none" />
            </div>

            <div className="relative bg-white rounded-xl border border-zinc-200 p-5 shadow-sm overflow-hidden">
              <div className="relative z-10">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  Represented Decades
                </h3>
                <p className="text-3xl font-extrabold text-zinc-900 mt-1">{stats.albumsByDecade.length}</p>
                <p className="text-xs text-zinc-400 mt-1">Eras in catalog</p>
              </div>
            </div>

            <div className="relative bg-white rounded-xl border border-zinc-200 p-5 shadow-sm overflow-hidden">
              <div className="relative z-10">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  Top Genre
                </h3>
                <p className="text-xl font-extrabold text-zinc-900 mt-1 truncate" title={stats.topGenres[0]?.name || 'N/A'}>
                  {stats.topGenres[0]?.name || 'N/A'}
                </p>
                <p className="text-xs text-zinc-400 mt-1">
                  {stats.topGenres[0] ? `${stats.topGenres[0].count} albums (${stats.topGenres[0].percentage}%)` : 'No genre data'}
                </p>
              </div>
            </div>
          </div>

          {/* Collection Analytics Section */}
          <section className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-zinc-800 tracking-tight">Collection Analytics</h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Visual breakdowns powered by Recharts. Click any bar to filter your collection.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Chart 1: Albums per Decade (Colored exactly like before) */}
              <div className="bg-white rounded-xl border border-zinc-200 p-6 shadow-xs flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-zinc-800">{albumType}s by Decade</h3>
                    <p className="text-xs text-zinc-500 mt-0.5">Chronological release timeline across eras</p>
                  </div>
                  <span className="text-xs font-semibold text-zinc-600 bg-zinc-100 px-2.5 py-1 rounded-full">
                    {stats.albumsByDecade.length} Eras
                  </span>
                </div>

                {stats.albumsByDecade.length > 0 ? (
                  <div className="flex-1 flex flex-col justify-between">
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsBarChart
                          data={stats.albumsByDecade}
                          margin={{ top: 12, right: 16, left: -16, bottom: 8 }}
                          onClick={(state: any) => {
                            if (state && state.activePayload && state.activePayload.length) {
                              const item = state.activePayload[0].payload as DecadeChartItem;
                              handleNavigate(item.filterYear);
                            }
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                          <XAxis
                            dataKey="decade"
                            tick={{ fontSize: 11, fill: '#52525b', fontWeight: 500 }}
                            axisLine={{ stroke: '#e4e4e7' }}
                            tickLine={false}
                          />
                          <YAxis
                            allowDecimals={false}
                            tick={{ fontSize: 11, fill: '#71717a' }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip content={<DecadeTooltip />} cursor={{ fill: '#f4f4f5', opacity: 0.6 }} />
                          <Bar dataKey="count" radius={[6, 6, 0, 0]} className="cursor-pointer">
                            {stats.albumsByDecade.map((_, index) => (
                              <Cell
                                key={`decade-cell-${index}`}
                                fill={DISCO_HEX_COLORS[index % DISCO_HEX_COLORS.length]}
                                className="hover:opacity-80 transition-opacity"
                              />
                            ))}
                          </Bar>
                        </RechartsBarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Decade chips / quick filters */}
                    <div className="mt-4 pt-4 border-t border-zinc-100 grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {stats.albumsByDecade.map((item, index) => (
                        <button
                          key={item.decade}
                          onClick={() => handleNavigate(item.filterYear)}
                          className="flex items-center justify-between text-left hover:bg-zinc-50 px-2.5 py-1.5 rounded-lg border border-zinc-200/80 transition-colors group cursor-pointer"
                          title={`Filter collection to ${item.decade}`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/10"
                              style={{ backgroundColor: DISCO_HEX_COLORS[index % DISCO_HEX_COLORS.length] }}
                            />
                            <span className="text-xs font-bold text-zinc-800 group-hover:text-zinc-950 truncate">
                              {item.decade}
                            </span>
                          </div>
                          <span className="text-xs font-semibold text-zinc-500 shrink-0">
                            {item.count}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="py-16 text-center text-zinc-500 text-sm">
                    No release year data available in this collection yet.
                  </div>
                )}
              </div>

              {/* Chart 2: Top 5 Most Frequent Genres (Colored using Disco palette) */}
              <div className="bg-white rounded-xl border border-zinc-200 p-6 shadow-xs flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-zinc-800">Top 5 Most Frequent Genres</h3>
                    <p className="text-xs text-zinc-500 mt-0.5">Most represented styles in your library</p>
                  </div>
                  <span className="text-xs font-semibold text-zinc-600 bg-zinc-100 px-2.5 py-1 rounded-full">
                    Top 5
                  </span>
                </div>

                {stats.topGenres.length > 0 ? (
                  <div className="flex-1 flex flex-col justify-between">
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsBarChart
                          data={stats.topGenres}
                          layout="vertical"
                          margin={{ top: 8, right: 24, left: 16, bottom: 8 }}
                          onClick={(state: any) => {
                            if (state && state.activePayload && state.activePayload.length) {
                              const item = state.activePayload[0].payload as GenreChartItem;
                              handleNavigate(item.name);
                            }
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f4f4f5" />
                          <XAxis
                            type="number"
                            allowDecimals={false}
                            tick={{ fontSize: 11, fill: '#71717a' }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            type="category"
                            dataKey="name"
                            width={110}
                            tick={{ fontSize: 12, fill: '#18181b', fontWeight: 500 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip content={<GenreTooltip />} cursor={{ fill: '#f4f4f5', opacity: 0.6 }} />
                          <Bar dataKey="count" radius={[0, 6, 6, 0]} className="cursor-pointer">
                            {stats.topGenres.map((_, index) => (
                              <Cell
                                key={`genre-cell-${index}`}
                                fill={DISCO_HEX_COLORS[index % DISCO_HEX_COLORS.length]}
                                className="hover:opacity-80 transition-opacity"
                              />
                            ))}
                          </Bar>
                        </RechartsBarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Genre list breakdown */}
                    <div className="mt-4 pt-4 border-t border-zinc-100 space-y-1.5">
                      {stats.topGenres.map((item, index) => (
                        <button
                          key={item.name}
                          onClick={() => handleNavigate(item.name)}
                          className="w-full flex items-center justify-between text-left hover:bg-zinc-50 px-2.5 py-1.5 rounded-lg transition-colors group cursor-pointer"
                          title={`Filter collection by ${item.name}`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/10"
                              style={{ backgroundColor: DISCO_HEX_COLORS[index % DISCO_HEX_COLORS.length] }}
                            />
                            <span className="text-xs font-semibold text-zinc-800 group-hover:text-zinc-950 truncate">
                              {item.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 shrink-0">
                            <span>{item.count} {item.count === 1 ? 'album' : 'albums'}</span>
                            <span className="text-zinc-400">({item.percentage}%)</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="py-16 text-center text-zinc-500 text-sm">
                    No genre data available in this collection yet.
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Additional Catalog Breakdown: Top Record Labels */}
          {stats.topLabels.length > 0 && (
            <div className="bg-white rounded-xl border border-zinc-200 p-6 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-zinc-800">Top 5 Record Labels</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">Publishers with the most albums in your library</p>
                </div>
                <span className="text-xs font-semibold text-zinc-500 bg-zinc-100 px-2.5 py-1 rounded-full">
                  Labels
                </span>
              </div>
              <ul className="divide-y divide-zinc-100">
                {stats.topLabels.map((item) => (
                  <li key={item.label} className="py-2.5 flex justify-between items-center">
                    <button
                      onClick={() => handleNavigate(item.label)}
                      className="text-sm font-medium text-zinc-800 hover:text-zinc-950 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500 rounded-sm text-left truncate mr-3"
                      title={`Filter by ${item.label}`}
                    >
                      {item.label}
                    </button>
                    <span className="font-bold text-zinc-900 bg-zinc-100 text-xs py-1 px-2.5 rounded-full shrink-0">
                      {item.value} {item.value === 1 ? 'album' : 'albums'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DashboardView;