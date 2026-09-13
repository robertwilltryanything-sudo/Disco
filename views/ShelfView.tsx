import React, { useMemo, useState } from 'react';
import { CD, CollectionMode } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { ChevronRightIcon } from '../components/icons/ChevronRightIcon';
import { ChevronDownIcon } from '../components/icons/ChevronDownIcon';
import { LibraryIcon } from '../components/icons/LibraryIcon';
import { SparklesIcon } from '../components/icons/SparklesIcon';

interface ShelfViewProps {
  cds: CD[];
  collectionMode: CollectionMode;
  onOpenArtistSorter?: () => void;
}

const ALPHABET = '#ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const ShelfView: React.FC<ShelfViewProps> = ({ cds, collectionMode, onOpenArtistSorter }) => {
  // Sections collapsed by default for a better "visual overlook"
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const groupedCds = useMemo(() => {
    const groups: Record<string, CD[]> = {};
    
    // Initialize groups
    ALPHABET.forEach(char => groups[char] = []);

    // The "Used for shelf organization and artist sorting" field in the Edit window is `sort_name`.
    // It is the ONE AND ONLY authority for shelf organization and artist sorting.
    // If empty or unset, it simply falls back to `artist`.
    const getShelfSortInfo = (cd: CD) => {
      const raw = (cd.sort_name && cd.sort_name.trim()) ? cd.sort_name.trim() : (cd.artist || '').trim();
      if (!raw) return { groupChar: '#', sortKey: '' };

      // Strip leading "The " for alphabetical group letter and sorting (e.g. "The Clash" -> "Clash")
      const clean = raw.replace(/^the\s+/i, '').trim();
      const firstChar = (clean.charAt(0) || '#').toUpperCase();
      const groupChar = /[A-Z]/.test(firstChar) ? firstChar : '#';

      return {
        groupChar,
        sortKey: clean.toLowerCase()
      };
    };

    cds.forEach(cd => {
      const { groupChar } = getShelfSortInfo(cd);
      const targetGroup = groups[groupChar] ? groupChar : '#';
      groups[targetGroup].push(cd);
    });

    // Sort items within each group: Sort Key then Year (Chronological) then Title
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => {
        const infoA = getShelfSortInfo(a);
        const infoB = getShelfSortInfo(b);
        
        const artComp = infoA.sortKey.localeCompare(infoB.sortKey);
        if (artComp !== 0) return artComp;
        const yearComp = (a.year || 0) - (b.year || 0);
        if (yearComp !== 0) return yearComp;
        return (a.title || '').localeCompare(b.title || '');
      });
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

      <div className="flex items-center justify-between mb-4">
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
            onClick={() => {
              const allExpanded = ALPHABET.reduce((acc, char) => ({ ...acc, [char]: true }), {});
              setExpandedSections(allExpanded);
            }}
            className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-950 px-2"
          >
            Expand All
          </button>
          <button 
            onClick={() => {
              const allCollapsed = ALPHABET.reduce((acc, char) => ({ ...acc, [char]: false }), {});
              setExpandedSections(allCollapsed);
            }}
            className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-950 px-2"
          >
            Collapse All
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {ALPHABET.map((char) => {
          const items = groupedCds[char] || [];
          if (items.length === 0) return null;

          // Default to collapsed (false) if not explicitly set
          const isExpanded = expandedSections[char] ?? false;

          return (
            <div key={char} className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <button 
                onClick={() => toggleSection(char)}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-zinc-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl font-black text-zinc-950 uppercase tracking-wide">
                    {char === '#' ? '0-9' : char}
                  </span>
                  <span className="text-xs font-black bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full">{items.length}</span>
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
                        {items.map((item) => (
                          <Link 
                            key={item.id} 
                            to={`/cd/${item.id}`}
                            className="flex items-center gap-3 p-3 bg-zinc-50 rounded-xl border border-zinc-100 hover:border-zinc-300 transition-colors group"
                          >
                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-zinc-200 flex-shrink-0 shadow-sm">
                              {item.cover_art_url ? (
                                <img src={item.cover_art_url} alt={item.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-zinc-400">
                                  <LibraryIcon className="w-5 h-5" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-bold text-zinc-950 truncate leading-tight group-hover:text-zinc-900">{item.artist}</p>
                                {item.sort_name && item.sort_name.trim().toLowerCase() !== (item.artist || '').trim().toLowerCase() && (
                                  <span className="text-[10px] font-medium text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                    Sort: {item.sort_name}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-zinc-600 truncate">{item.title} {item.year ? `(${item.year})` : ''}</p>
                            </div>
                          </Link>
                        ))}
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

export default ShelfView;
