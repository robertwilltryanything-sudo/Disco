import React, { useMemo, useState } from 'react';
import { CD, CollectionMode } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRightIcon } from '../components/icons/ChevronRightIcon';
import { ChevronDownIcon } from '../components/icons/ChevronDownIcon';
import { LibraryIcon } from '../components/icons/LibraryIcon';
import { SparklesIcon } from '../components/icons/SparklesIcon';
import { PlexIcon } from '../components/icons/PlexIcon';
import { usePlex } from '../context/PlexContext';
import { isCdSingle, compareStrings, isVariousArtists, isSoundtrackTagged, sanitizeImageUrl } from '../utils';

interface ShelfViewProps {
  cds: CD[];
  collectionMode: CollectionMode;
  onOpenArtistSorter?: () => void;
}

export const VARIOUS_ARTISTS_SECTION = 'Various Artists';
export const SOUNDTRACK_SECTION = 'Soundtrack';
const ALPHABET = '#ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ'.split('');
const SHELF_SECTIONS = [...ALPHABET, VARIOUS_ARTISTS_SECTION, SOUNDTRACK_SECTION];

const ShelfView: React.FC<ShelfViewProps> = ({ cds, collectionMode, onOpenArtistSorter }) => {
  const navigate = useNavigate();
  const { isAvailableInPlex, getPlexUrl, getPlexTarget, getPlexRel } = usePlex();
  // Sections collapsed by default for a better "visual overlook"
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const groupedCds = useMemo(() => {
    const groups: Record<string, CD[]> = {};
    const sortInfoById = new Map<string, { groupChar: string; sortKey: string; isSingle: boolean; artistLower: string }>();
    
    // Initialize groups for all alphabetical letters, Various Artists, and Soundtrack at the end
    SHELF_SECTIONS.forEach(sec => groups[sec] = []);

    const computeShelfSortInfo = (cd: CD) => {
      if (isSoundtrackTagged(cd)) {
        return {
          groupChar: SOUNDTRACK_SECTION,
          sortKey: (cd.title || '').trim() || cd.artist || '',
        };
      }

      const rawSort = (cd.sort_name && cd.sort_name.trim()) ? cd.sort_name.trim() : '';
      const rawArtist = (cd.artist && cd.artist.trim()) ? cd.artist.trim() : '';

      if (isVariousArtists(rawSort) || isVariousArtists(rawArtist)) {
        return {
          groupChar: VARIOUS_ARTISTS_SECTION,
          sortKey: (cd.title || '').trim() || rawArtist,
        };
      }

      const raw = rawSort || rawArtist;
      if (!raw) return { groupChar: '#', sortKey: '' };

      const clean = raw.replace(/^the\s+/i, '').trim();
      const firstChar = (clean.charAt(0) || '#').toUpperCase();
      const groupChar = /[A-ZÅÄÖ]/.test(firstChar) ? firstChar : '#';

      return {
        groupChar,
        sortKey: clean,
      };
    };

    cds.forEach(cd => {
      const info = computeShelfSortInfo(cd);
      sortInfoById.set(cd.id, {
        ...info,
        isSingle: isCdSingle(cd),
        artistLower: (cd.artist || '').trim().toLowerCase(),
      });
      const targetGroup = groups[info.groupChar] !== undefined ? info.groupChar : '#';
      groups[targetGroup].push(cd);
    });

    // Sort items within each group using precomputed keys
    Object.keys(groups).forEach(key => {
      if (key === SOUNDTRACK_SECTION || key === VARIOUS_ARTISTS_SECTION) {
        groups[key].sort((a, b) => {
          const titleA = (a.title || '').trim();
          const titleB = (b.title || '').trim();
          const cleanA = titleA.replace(/^the\s+/i, '').trim();
          const cleanB = titleB.replace(/^the\s+/i, '').trim();
          const comp = compareStrings(cleanA, cleanB);
          if (comp !== 0) return comp;
          return compareStrings(titleA, titleB);
        });
      } else {
        groups[key].sort((a, b) => {
          const infoA = sortInfoById.get(a.id)!;
          const infoB = sortInfoById.get(b.id)!;
          
          const artComp = compareStrings(infoA.sortKey, infoB.sortKey);
          if (artComp !== 0 && infoA.artistLower !== infoB.artistLower) {
            return artComp;
          }
          
          if (infoA.isSingle !== infoB.isSingle) {
            return infoA.isSingle ? 1 : -1;
          }

          const yearComp = (a.year || 0) - (b.year || 0);
          if (yearComp !== 0) return yearComp;
          return compareStrings(a.title, b.title);
        });
      }
    });

    return groups;
  }, [cds]);

  const toggleSection = (id: string) => {
    setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const albumType = collectionMode === 'vinyl' ? 'Vinyl' : 'CD';

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8 flex items-center gap-4">
        <div className="p-3 bg-zinc-950 text-white rounded-2xl">
          <LibraryIcon className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-zinc-950 uppercase tracking-tight">Shelf Organizer</h1>
          <p className="text-zinc-600 font-medium">Organized strictly by the Sort Name field in the album details, then chronologically.</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        {onOpenArtistSorter ? (
          <button
            type="button"
            onClick={onOpenArtistSorter}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 text-xs font-bold transition-all shadow-xs"
            title="Automatically sort all bands under band names and solo artists by surname"
          >
            <SparklesIcon className="w-3.5 h-3.5 text-amber-600" />
            <span>Fix Artist Sorting</span>
          </button>
        ) : <div />}

        <div className="flex items-center">
          <button 
            type="button"
            onClick={() => {
              const allExpanded = SHELF_SECTIONS.reduce((acc, sec) => ({ ...acc, [sec]: true }), {});
              setExpandedSections(allExpanded);
            }}
            className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-950 px-2 cursor-pointer"
          >
            Expand All
          </button>
          <button 
            type="button"
            onClick={() => {
              const allCollapsed = SHELF_SECTIONS.reduce((acc, sec) => ({ ...acc, [sec]: false }), {});
              setExpandedSections(allCollapsed);
            }}
            className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-950 px-2 cursor-pointer"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Quick Jump Bar */}
      <div className="flex flex-wrap items-center gap-1.5 mb-6 p-2.5 bg-zinc-100/80 rounded-2xl border border-zinc-200">
        <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500 px-1.5">Jump to:</span>
        {SHELF_SECTIONS.map((sec) => {
          const count = groupedCds[sec]?.length || 0;
          const hasItems = count > 0;
          return (
            <button
              key={sec}
              type="button"
              disabled={!hasItems}
              onClick={() => {
                setExpandedSections(prev => ({ ...prev, [sec]: true }));
                const el = document.getElementById(`shelf-section-${sec}`);
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
              className={`px-2 py-1 text-xs rounded-lg transition-all ${
                !hasItems
                  ? 'text-zinc-300 opacity-40 cursor-not-allowed'
                  : 'bg-white hover:bg-zinc-950 hover:text-white text-zinc-800 font-bold shadow-xs cursor-pointer'
              }`}
              title={`${sec === '#' ? '0-9' : sec} (${count} items)`}
            >
              {sec === '#' ? '0-9' : sec}
            </button>
          );
        })}
      </div>

      <div className="space-y-4">
        {SHELF_SECTIONS.map((section) => {
          const items = groupedCds[section] || [];
          if (items.length === 0) return null;

          // Default to collapsed (false) if not explicitly set
          const isExpanded = expandedSections[section] ?? false;

          return (
            <div 
              key={section} 
              id={`shelf-section-${section}`}
              className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              <button 
                type="button"
                aria-expanded={isExpanded}
                onClick={() => toggleSection(section)}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-zinc-50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl font-black text-zinc-950 uppercase tracking-wide">
                    {section === '#' ? '0-9' : section}
                  </span>
                  <span className="text-xs font-black bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full">
                    {items.length}
                  </span>
                </div>
                {isExpanded ? <ChevronDownIcon className="w-5 h-5 text-zinc-400" /> : <ChevronRightIcon className="w-5 h-5 text-zinc-400" />}
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="p-5 pt-0 border-t border-zinc-100">
                      <div className="grid grid-cols-1 gap-3 mt-4">
                        {items.map((item) => {
                          const safeCoverUrl = sanitizeImageUrl(item.cover_art_url);
                          const plexUrl = isAvailableInPlex(item.artist, item.title) ? getPlexUrl(item.artist, item.title) : null;
                          const inPlex = isAvailableInPlex(item.artist, item.title);
                          return (
                          <div
                            key={item.id}
                            onClick={(e) => {
                              if ((e.target as HTMLElement).closest('a, button')) return;
                              navigate(`/cd/${item.id}`);
                            }}
                            className="flex items-center gap-3 p-3 bg-zinc-50 rounded-xl border border-zinc-100 hover:border-zinc-300 transition-colors group cursor-pointer"
                          >
                            <Link to={`/cd/${item.id}`} className="w-10 h-10 rounded-lg overflow-hidden bg-zinc-200 shrink-0 shadow-sm block" aria-label={`View ${item.title}`}>
                              {safeCoverUrl ? (
                                <img src={safeCoverUrl} alt={item.title} className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-zinc-400">
                                  <LibraryIcon className="w-5 h-5" />
                                </div>
                              )}
                            </Link>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Link to={`/cd/${item.id}`} className="text-sm font-bold text-zinc-950 truncate leading-tight group-hover:text-zinc-900 hover:underline">
                                  {item.artist}
                                </Link>
                                {section !== VARIOUS_ARTISTS_SECTION && section !== SOUNDTRACK_SECTION && item.sort_name && item.sort_name.trim().toLowerCase() !== (item.artist || '').trim().toLowerCase() && (
                                  <span className="text-[10px] font-medium text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                    Sort: {item.sort_name}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-zinc-600 truncate flex items-center gap-1.5">
                                <Link to={`/cd/${item.id}`} className="truncate hover:underline">
                                  {item.title} {item.year ? `(${item.year})` : ''}
                                </Link>
                                {inPlex && (
                                  <a
                                    href={plexUrl || undefined}
                                    target={getPlexTarget()}
                                    rel={getPlexRel()}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (!plexUrl) e.preventDefault();
                                    }}
                                    className="shrink-0 inline-flex items-center hover:opacity-75 transition-opacity cursor-pointer p-0.5 rounded"
                                    title="Open album in Plex"
                                    aria-label="Open album in Plex"
                                  >
                                    <PlexIcon className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {cds.length === 0 && (
        <div className="text-center py-20 bg-zinc-50 rounded-3xl border-2 border-dashed border-zinc-200">
          <LibraryIcon className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-zinc-950">Your collection is empty</h3>
          <p className="text-zinc-500 mt-2">Add some {albumType}s to start organizing your shelves.</p>
        </div>
      )}
    </div>
  );
};

export default React.memo(ShelfView);
