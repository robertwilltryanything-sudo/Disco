import React, { useMemo, useState } from 'react';
import { CD, CollectionMode } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRightIcon } from '../components/icons/ChevronRightIcon';
import { ChevronDownIcon } from '../components/icons/ChevronDownIcon';
import { LibraryIcon } from '../components/icons/LibraryIcon';

interface ShelfViewProps {
  cds: CD[];
  collectionMode: CollectionMode;
}

const MAJOR_GENRES = [
  { id: 'rock', name: 'Rock', keywords: ['rock', 'metal', 'grunge', 'punk', 'alternative', 'prog', 'psychedelic'] },
  { id: 'jazz', name: 'Jazz', keywords: ['jazz', 'fusion', 'bop', 'swing', 'bebop'] },
  { id: 'pop', name: 'Pop', keywords: ['pop', 'dance', 'synthpop', 'disco'] },
  { id: 'electronic', name: 'Electronic', keywords: ['electronic', 'techno', 'house', 'ambient', 'trance', 'edm', 'idm', 'industrial'] },
  { id: 'hiphop', name: 'Hip Hop', keywords: ['hip hop', 'rap', 'trap', 'r&b'] },
  { id: 'soul', name: 'Soul & Funk', keywords: ['soul', 'funk', 'motown', 'rhythm and blues'] },
  { id: 'classical', name: 'Classical', keywords: ['classical', 'orchestral', 'opera', 'baroque', 'chamber'] },
  { id: 'country', name: 'Country & Folk', keywords: ['country', 'folk', 'bluegrass', 'americana', 'singer-songwriter'] },
  { id: 'blues', name: 'Blues', keywords: ['blues'] },
  { id: 'soundtrack', name: 'Soundtracks', keywords: ['soundtrack', 'score', 'ost', 'movie', 'film'] },
  { id: 'yacht', name: 'Yacht Rock', keywords: ['yacht rock', 'soft rock', 'aor', 'west coast'] },
  { id: 'reggae', name: 'Reggae', keywords: ['reggae', 'dub', 'ska'] },
];

const ShelfView: React.FC<ShelfViewProps> = ({ cds, collectionMode }) => {
  const [expandedGenres, setExpandedGenres] = useState<Record<string, boolean>>({});

  const groupedCds = useMemo(() => {
    const groups: Record<string, CD[]> = {};
    
    // Initialize groups
    MAJOR_GENRES.forEach(g => groups[g.id] = []);
    groups['other'] = [];

    cds.forEach(cd => {
      const genres = (cd.genre || []).map(g => g.toLowerCase());
      const tags = (cd.tags || []).map(t => t.toLowerCase());
      const combined = [...genres, ...tags];
      
      // Find the best matching major genre
      let matchedId = 'other';
      
      // Check keywords
      for (const major of MAJOR_GENRES) {
        if (major.keywords.some(keyword => combined.some(g => g.includes(keyword)))) {
          matchedId = major.id;
          break;
        }
      }
      
      groups[matchedId].push(cd);
    });

    // Sort items within each group: Artist (A-Z, ignoring "The") then Year (Chronological)
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => {
        const getSortName = (name: string) => {
          const lower = name.toLowerCase();
          if (lower.startsWith('the ')) return lower.slice(4);
          return lower;
        };
        
        const nameA = getSortName(a.artist);
        const nameB = getSortName(b.artist);
        
        const artComp = nameA.localeCompare(nameB);
        if (artComp !== 0) return artComp;
        return (a.year || 0) - (b.year || 0);
      });
    });

    return groups;
  }, [cds]);

  const toggleGenre = (id: string) => {
    setExpandedGenres(prev => ({ ...prev, [id]: !prev[id] }));
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
          <p className="text-zinc-600 font-medium">Grouped by genre, then sorted alphabetically by artist and chronologically by year.</p>
        </div>
      </div>

      <div className="flex justify-end mb-4">
        <button 
          onClick={() => {
            const allExpanded = Object.keys(groupedCds).reduce((acc, key) => ({ ...acc, [key]: true }), {});
            setExpandedGenres(allExpanded);
          }}
          className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-950 px-2"
        >
          Expand All
        </button>
        <button 
          onClick={() => {
            const allCollapsed = Object.keys(groupedCds).reduce((acc, key) => ({ ...acc, [key]: false }), {});
            setExpandedGenres(allCollapsed);
          }}
          className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-950 px-2"
        >
          Collapse All
        </button>
      </div>

      <div className="space-y-4">
        {[...MAJOR_GENRES, { id: 'other', name: 'Other / Unclassified', keywords: [] }].map((genre) => {
          const items = groupedCds[genre.id] || [];
          if (items.length === 0) return null;

          const isExpanded = expandedGenres[genre.id] ?? true;

          return (
            <div key={genre.id} className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <button 
                onClick={() => toggleGenre(genre.id)}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-zinc-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-zinc-950 uppercase tracking-wide">{genre.name}</span>
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
                          <div key={item.id} className="flex items-center gap-3 p-3 bg-zinc-50 rounded-xl border border-zinc-100 hover:border-zinc-300 transition-colors group">
                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-zinc-200 flex-shrink-0 shadow-sm">
                              {item.cover_art_url ? (
                                <img src={item.cover_art_url} alt={item.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-zinc-400">
                                  <LibraryIcon className="w-5 h-5" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-zinc-950 truncate leading-tight">{item.artist}</p>
                              <p className="text-xs text-zinc-600 truncate">{item.title}</p>
                            </div>
                          </div>
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
