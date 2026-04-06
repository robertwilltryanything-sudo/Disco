import React, { useMemo, useState } from 'react';
import { CD, CollectionMode } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { ChevronRightIcon } from '../components/icons/ChevronRightIcon';
import { ChevronDownIcon } from '../components/icons/ChevronDownIcon';
import { LibraryIcon } from '../components/icons/LibraryIcon';

interface ShelfViewProps {
  cds: CD[];
  collectionMode: CollectionMode;
}

const ALPHABET = '#ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const ShelfView: React.FC<ShelfViewProps> = ({ cds, collectionMode }) => {
  // Sections collapsed by default for a better "visual overlook"
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const groupedCds = useMemo(() => {
    const groups: Record<string, CD[]> = {};
    
    // Initialize groups
    ALPHABET.forEach(char => groups[char] = []);

    const getSurnameInfo = (name: string) => {
      let cleanName = name.trim();
      if (!cleanName) return { groupChar: '#', sortKey: '' };

      const lower = cleanName.toLowerCase();
      
      // Special case for "Various Artists"
      if (lower === 'various artists') {
        return {
          groupChar: 'V',
          sortKey: 'various artists'
        };
      }

      // Special case for Bruce Springsteen (e.g. Bruce Springsteen & The E Street Band -> S)
      if (lower.includes('bruce springsteen')) {
        return {
          groupChar: 'S',
          sortKey: 'springsteen, bruce' + lower.replace('bruce springsteen', '')
        };
      }

      // Special case for Elvis Costello (e.g. Elvis Costello & The Attractions -> C)
      if (lower.includes('elvis costello')) {
        return {
          groupChar: 'C',
          sortKey: 'costello, elvis' + lower.replace('elvis costello', '')
        };
      }

      // Special case for Nick Cave (and Nice Cave) (under C)
      if (lower.includes('nick cave') || lower.includes('nice cave')) {
        const nameToUse = lower.includes('nick cave') ? 'nick cave' : 'nice cave';
        return {
          groupChar: 'C',
          sortKey: 'cave, nick' + lower.replace(nameToUse, '')
        };
      }

      // Special case for Mumford and Sons (under M)
      if (lower.includes('mumford and sons')) {
        return {
          groupChar: 'M',
          sortKey: lower
        };
      }

      // Special case for Van Morrison (under M)
      if (lower.includes('van morrison')) {
        return {
          groupChar: 'M',
          sortKey: 'morrison, van' + lower.replace('van morrison', '')
        };
      }

      // Special case for Black Sabbath (under B)
      if (lower.includes('black sabbath')) {
        return {
          groupChar: 'B',
          sortKey: lower
        };
      }

      // Special case for Bad News (under B)
      if (lower.includes('bad news')) {
        return {
          groupChar: 'B',
          sortKey: lower
        };
      }

      // Special case for Ryan Adams (e.g. Ryan Adams & The Cardinals -> A)
      if (lower.includes('ryan adams')) {
        return {
          groupChar: 'A',
          sortKey: 'adams, ryan' + lower.replace('ryan adams', '')
        };
      }

      // Special case for Bryan Adams (under A)
      if (lower.includes('bryan adams')) {
        return {
          groupChar: 'A',
          sortKey: 'adams, bryan' + lower.replace('bryan adams', '')
        };
      }

      // Special cases for bands under A
      if (['air supply', 'aerial m', 'alice in chains', 'aphex twin', 'arch enemy'].some(band => lower.includes(band))) {
        return {
          groupChar: 'A',
          sortKey: lower
        };
      }

      // Special case for Queens of the Stone Age (under Q)
      if (lower.includes('queens of the stone age')) {
        return {
          groupChar: 'Q',
          sortKey: lower
        };
      }

      // Special case for The Alan Parsons Project (under P)
      if (lower.includes('the alan parsons project')) {
        return {
          groupChar: 'P',
          sortKey: 'parsons project, alan'
        };
      }

      // Special case for Morbid Angel (under M)
      if (lower.includes('morbid angel')) {
        return {
          groupChar: 'M',
          sortKey: lower
        };
      }

      // Special case for Ella Fitzgerald (e.g. Ella Fitzgerald & Louis Armstrong -> F)
      if (lower.includes('ella fitzgerald')) {
        return {
          groupChar: 'F',
          sortKey: 'fitzgerald, ella' + lower.replace('ella fitzgerald', '')
        };
      }

      // Special case for Massive Attack (under M)
      if (lower.includes('massive attack')) {
        return {
          groupChar: 'M',
          sortKey: lower
        };
      }

      // Special case for Steely Dan (under S)
      if (lower.includes('steely dan')) {
        return {
          groupChar: 'S',
          sortKey: lower
        };
      }

      // Special case for Pink Floyd (under P)
      if (lower.includes('pink floyd')) {
        return {
          groupChar: 'P',
          sortKey: lower
        };
      }

      // Special case for Pet Shop Boys (under P)
      if (lower.includes('pet shop boys')) {
        return {
          groupChar: 'P',
          sortKey: lower
        };
      }

      // Special case for Dave Matthews Band (under M)
      if (lower.includes('dave matthews band')) {
        return {
          groupChar: 'M',
          sortKey: 'matthews band, dave' + lower.replace('dave matthews band', '')
        };
      }

      // Special case for Hootie & The Blowfish (under H)
      if (lower.includes('hootie & the blowfish')) {
        return {
          groupChar: 'H',
          sortKey: lower
        };
      }

      // Special case for Spag Bog (under S)
      if (lower.includes('spag bog')) {
        return {
          groupChar: 'S',
          sortKey: lower
        };
      }

      // Special case for Dimmu Borgir (under D)
      if (lower.includes('dimmu borgir')) {
        return {
          groupChar: 'D',
          sortKey: lower
        };
      }

      // Special case for Echo and the Bunnymen (under E)
      if (lower.includes('echo and the bunnymen')) {
        return {
          groupChar: 'E',
          sortKey: lower
        };
      }

      // Special case for Chris de Burgh (under D)
      if (lower.includes('chris de burgh')) {
        return {
          groupChar: 'D',
          sortKey: 'de burgh, chris'
        };
      }

      // Special case for Killswitch Engage (under K)
      if (lower.includes('killswitch engage')) {
        return {
          groupChar: 'K',
          sortKey: lower
        };
      }

      // Special case for Boards Of Canada (under B)
      if (lower.includes('boards of canada')) {
        return {
          groupChar: 'B',
          sortKey: lower
        };
      }

      // Special case for Belle And Sebastian / Belle & Sebastian (under B)
      if (lower.includes('belle and sebastian') || lower.includes('belle & sebastian')) {
        return {
          groupChar: 'B',
          sortKey: lower
        };
      }

      // Special case for Blind Guardian (under B)
      if (lower.includes('blind guardian')) {
        return {
          groupChar: 'B',
          sortKey: lower
        };
      }

      // Special case for Band of Horses (under B)
      if (lower.includes('band of horses')) {
        return {
          groupChar: 'B',
          sortKey: lower
        };
      }

      // Special case for Coheed and Cambria (under C)
      if (lower.includes('coheed and cambria')) {
        return {
          groupChar: 'C',
          sortKey: lower
        };
      }

      // Special case for Buena Vista Social Club (under B)
      if (lower.includes('buena vista social club')) {
        return {
          groupChar: 'B',
          sortKey: lower
        };
      }

      // Special case for Blue Pearl (under B)
      if (lower.includes('blue pearl')) {
        return {
          groupChar: 'B',
          sortKey: lower
        };
      }
      
      // Handle "The ..." bands - usually sorted by the first word after "The"
      if (lower.startsWith('the ')) {
        const afterThe = cleanName.slice(4).trim();
        return {
          groupChar: afterThe.charAt(0).toUpperCase(),
          sortKey: afterThe.toLowerCase()
        };
      }

      const parts = cleanName.split(/\s+/);
      
      // If multiple words, assume last is surname (e.g., David Bowie -> Bowie)
      if (parts.length > 1) {
        const lastPart = parts[parts.length - 1];
        
        // If the last part is a number (e.g., "Jurassic 5", "Maroon 5"), 
        // treat it as a band name and sort by the first word.
        if (/^\d+$/.test(lastPart)) {
          return {
            groupChar: cleanName.charAt(0).toUpperCase(),
            sortKey: cleanName.toLowerCase()
          };
        }

        const surname = lastPart;
        const firstName = parts.slice(0, -1).join(' ');
        return {
          groupChar: surname.charAt(0).toUpperCase(),
          sortKey: `${surname.toLowerCase()}, ${firstName.toLowerCase()}`
        };
      }

      // Single word name (e.g., Prince)
      return {
        groupChar: cleanName.charAt(0).toUpperCase(),
        sortKey: cleanName.toLowerCase()
      };
    };

    cds.forEach(cd => {
      const { groupChar } = getSurnameInfo(cd.artist);
      
      let targetGroup = '#';
      if (/[A-Z]/.test(groupChar)) {
        targetGroup = groupChar;
      }
      
      if (groups[targetGroup]) {
        groups[targetGroup].push(cd);
      } else {
        groups['#'].push(cd);
      }
    });

    // Sort items within each group: Surname Sort Key then Year (Chronological)
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => {
        const infoA = getSurnameInfo(a.artist);
        const infoB = getSurnameInfo(b.artist);
        
        const artComp = infoA.sortKey.localeCompare(infoB.sortKey);
        if (artComp !== 0) return artComp;
        return (a.year || 0) - (b.year || 0);
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
          <p className="text-zinc-600 font-medium">Grouped by surname (e.g. Bowie under B) or band name, then chronologically.</p>
        </div>
      </div>

      <div className="flex justify-end mb-4">
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
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-zinc-950 truncate leading-tight group-hover:text-zinc-900">{item.artist}</p>
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
