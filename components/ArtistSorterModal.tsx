import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { CD, WantlistItem } from '../types';
import { determineArtistSortName, batchNormalizeWithGemini } from '../artistSorter';
import { SparklesIcon } from './icons/SparklesIcon';
import { XIcon } from './icons/XIcon';
import { CheckIcon } from './icons/CheckIcon';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { UserIcon } from './icons/UserIcon';
import { UserGroupIcon } from './icons/UserGroupIcon';
import { SearchIcon } from './icons/SearchIcon';

interface ArtistSorterModalProps {
  isOpen: boolean;
  onClose: () => void;
  cds: CD[];
  wantlist: WantlistItem[];
  onApplySortNames: (updates: Record<string, string>) => void;
}

interface EditableArtistItem {
  originalArtist: string;
  sortName: string;
  isGroup: boolean;
  groupChar: string;
  currentSortName?: string;
  isChanged: boolean;
  albumCount: number;
}

export const ArtistSorterModal: React.FC<ArtistSorterModalProps> = ({
  isOpen,
  onClose,
  cds,
  wantlist,
  onApplySortNames,
}) => {
  const [items, setItems] = useState<EditableArtistItem[]>([]);
  const [isScanningWithAi, setIsScanningWithAi] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'changes-only'>('all');
  const [aiError, setAiError] = useState<string | null>(null);

  // Compute unique artists and their album counts across collection and wantlist
  const uniqueArtistsData = useMemo(() => {
    const map = new Map<string, { count: number; currentSortName?: string }>();

    [...cds, ...wantlist].forEach(item => {
      const art = (item.artist || '').trim();
      if (!art) return;
      const existing = map.get(art);
      if (existing) {
        existing.count += 1;
        if (!existing.currentSortName && item.sort_name) {
          existing.currentSortName = item.sort_name;
        }
      } else {
        map.set(art, {
          count: 1,
          currentSortName: item.sort_name,
        });
      }
    });

    return map;
  }, [cds, wantlist]);

  // Initialize classification using the smart engine
  useEffect(() => {
    if (!isOpen) return;

    const initialList: EditableArtistItem[] = [];
    uniqueArtistsData.forEach((data, artist) => {
      const result = determineArtistSortName(artist);
      const existing = (data.currentSortName || '').trim();
      const sortName = existing || result.sort_name;
      const isGroup = existing ? !existing.includes(',') : result.isGroup;
      
      const clean = sortName.replace(/^the\s+/i, '').trim();
      const firstChar = clean ? clean.charAt(0).toUpperCase() : '#';
      const groupChar = /[A-Z]/.test(firstChar) ? firstChar : '#';
      const isChanged = !existing && result.sort_name.trim() !== artist.trim();

      initialList.push({
        originalArtist: artist,
        sortName,
        isGroup,
        groupChar,
        currentSortName: data.currentSortName,
        isChanged,
        albumCount: data.count,
      });
    });

    // Sort by original artist name alphabetically
    initialList.sort((a, b) => a.originalArtist.localeCompare(b.originalArtist));
    setItems(initialList);
    setAiError(null);
  }, [isOpen, uniqueArtistsData]);

  // Deep Scan with Gemini AI
  const handleAiScan = useCallback(async () => {
    setIsScanningWithAi(true);
    setAiError(null);

    try {
      const artistNames = items.map(i => i.originalArtist);
      const aiResults = await batchNormalizeWithGemini(artistNames);

      setItems(prev =>
        prev.map(item => {
          const ai = aiResults[item.originalArtist];
          if (!ai) return item;

          const isChanged = (item.currentSortName || '').trim() !== ai.sort_name.trim();
          return {
            ...item,
            sortName: ai.sort_name,
            isGroup: ai.isGroup,
            groupChar: ai.groupChar,
            isChanged,
          };
        })
      );
    } catch (err: any) {
      console.error("AI batch scan failed:", err);
      setAiError(err?.message || "AI scanning failed. Kept built-in music rules.");
    } finally {
      setIsScanningWithAi(false);
    }
  }, [items]);

  // Toggle single artist type (Band <-> Solo)
  const handleToggleType = (artistName: string) => {
    setItems(prev =>
      prev.map(item => {
        if (item.originalArtist !== artistName) return item;

        const newIsGroup = !item.isGroup;
        let newSortName = item.sortName;

        if (newIsGroup) {
          // Changed to group: use original name (strip leading "The " if present)
          newSortName = item.originalArtist.replace(/^the\s+/i, '').trim();
        } else {
          // Changed to solo: if 2 words, format as Surname, Firstname
          const words = item.originalArtist.split(/\s+/);
          if (words.length >= 2) {
            const surname = words[words.length - 1];
            const first = words.slice(0, -1).join(' ');
            newSortName = `${surname}, ${first}`;
          }
        }

        const clean = newSortName.replace(/^the\s+/i, '').trim();
        const groupChar = clean ? clean.charAt(0).toUpperCase() : '#';
        const isChanged = (item.currentSortName || '').trim() !== newSortName.trim();

        return {
          ...item,
          isGroup: newIsGroup,
          sortName: newSortName,
          groupChar: /[A-Z]/.test(groupChar) ? groupChar : '#',
          isChanged,
        };
      })
    );
  };

  // Change sortName text manually
  const handleSortNameChange = (artistName: string, newSortName: string) => {
    setItems(prev =>
      prev.map(item => {
        if (item.originalArtist !== artistName) return item;

        const clean = newSortName.replace(/^the\s+/i, '').trim();
        const groupChar = clean ? clean.charAt(0).toUpperCase() : '#';
        const isChanged = (item.currentSortName || '').trim() !== newSortName.trim();

        return {
          ...item,
          sortName: newSortName,
          groupChar: /[A-Z]/.test(groupChar) ? groupChar : '#',
          isChanged,
        };
      })
    );
  };

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (filterMode === 'changes-only' && !item.isChanged) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        item.originalArtist.toLowerCase().includes(q) ||
        item.sortName.toLowerCase().includes(q)
      );
    });
  }, [items, filterMode, searchQuery]);

  const totalChangesCount = useMemo(() => {
    return items.filter(i => i.isChanged).length;
  }, [items]);

  const totalAlbumsAffected = useMemo(() => {
    return items.filter(i => i.isChanged).reduce((sum, i) => sum + i.albumCount, 0);
  }, [items]);

  // Apply to collection
  const handleApply = () => {
    const updates: Record<string, string> = {};
    items.forEach(item => {
      updates[item.originalArtist] = item.sortName;
    });

    onApplySortNames(updates);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="artist-sorter-title"
    >
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-zinc-200 flex items-start justify-between bg-zinc-50/50">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-zinc-950 text-amber-400 rounded-xl shadow-sm">
              <SparklesIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 id="artist-sorter-title" className="text-xl sm:text-2xl font-black text-zinc-950 tracking-tight">
                Fix Artist Sorting
              </h2>
              <p className="text-xs sm:text-sm text-zinc-600 mt-0.5">
                Automatically organizes your artists so bands stay under their band name and solo artists sort by surname.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-900 rounded-lg hover:bg-zinc-100 transition-colors"
            aria-label="Close"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Action & Filter Toolbar */}
        <div className="p-4 sm:p-5 border-b border-zinc-100 space-y-3 bg-white">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <SearchIcon className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search artists..."
                className="w-full pl-9 pr-3 py-1.5 text-sm bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:bg-white transition-all"
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="flex bg-zinc-100 p-1 rounded-lg border border-zinc-200 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setFilterMode('all')}
                  className={`px-3 py-1 rounded-md transition-all ${
                    filterMode === 'all'
                      ? 'bg-white text-zinc-950 shadow-sm font-bold'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  All ({items.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('changes-only')}
                  className={`px-3 py-1 rounded-md transition-all ${
                    filterMode === 'changes-only'
                      ? 'bg-white text-zinc-950 shadow-sm font-bold'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  Will Update ({totalChangesCount})
                </button>
              </div>

              <button
                type="button"
                onClick={handleAiScan}
                disabled={isScanningWithAi}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 transition-colors disabled:opacity-50"
                title="Use Gemini AI to double-check any obscure artists"
              >
                {isScanningWithAi ? (
                  <>
                    <SpinnerIcon className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <SparklesIcon className="w-3.5 h-3.5 text-amber-700" />
                    <span>Deep AI Scan</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {aiError && (
            <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200">
              {aiError}
            </p>
          )}

          {/* Quick stats banner */}
          <div className="flex items-center justify-between text-xs text-zinc-500 pt-1">
            <span>
              Scanned <strong className="text-zinc-900 font-semibold">{items.length}</strong> unique artists across your collection
            </span>
            <span>
              {totalChangesCount > 0 ? (
                <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  ✨ {totalChangesCount} artist(s) will be corrected ({totalAlbumsAffected} album{totalAlbumsAffected === 1 ? '' : 's'})
                </span>
              ) : (
                <span className="text-zinc-600">All artists match sorting rules</span>
              )}
            </span>
          </div>
        </div>

        {/* Artists List */}
        <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 p-2 sm:p-4">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12 px-4 text-zinc-500">
              <p className="text-sm">No artists found matching your criteria.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredItems.map(item => (
                <div
                  key={item.originalArtist}
                  className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    item.isChanged
                      ? 'bg-amber-50/40 border-amber-200/80 shadow-xs'
                      : 'bg-white border-zinc-200/70 hover:border-zinc-300'
                  }`}
                >
                  <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                    {/* Alphabet letter badge */}
                    <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
                      {item.groupChar}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-zinc-900 text-sm truncate">
                          {item.originalArtist}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-medium">
                          ({item.albumCount} {item.albumCount === 1 ? 'record' : 'records'})
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mt-1">
                        <button
                          type="button"
                          onClick={() => handleToggleType(item.originalArtist)}
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border cursor-pointer transition-colors ${
                            item.isGroup
                              ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                              : 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100'
                          }`}
                          title="Click to switch between Band and Solo"
                        >
                          {item.isGroup ? (
                            <>
                              <UserGroupIcon className="w-3 h-3" />
                              <span>Band / Group</span>
                            </>
                          ) : (
                            <>
                              <UserIcon className="w-3 h-3" />
                              <span>Solo Artist</span>
                            </>
                          )}
                        </button>

                        {item.currentSortName && item.currentSortName !== item.sortName && (
                          <span className="text-[10px] text-zinc-400 line-through truncate max-w-[150px]">
                            was: {item.currentSortName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Sort key editor */}
                  <div className="flex items-center gap-2 sm:self-center">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-zinc-500 font-medium shrink-0">Sorts as:</span>
                      <input
                        type="text"
                        value={item.sortName}
                        onChange={e => handleSortNameChange(item.originalArtist, e.target.value)}
                        className="text-xs font-semibold px-2.5 py-1.5 border border-zinc-300 rounded-lg bg-white text-zinc-900 w-44 sm:w-52 focus:outline-none focus:ring-2 focus:ring-zinc-900"
                        title="Click to manually edit sort name if desired"
                      />
                    </div>

                    {item.isChanged && (
                      <span className="shrink-0 text-emerald-600 bg-emerald-100 p-1 rounded-full" title="Will update to this rule">
                        <CheckIcon className="w-4 h-4" />
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-zinc-200 bg-zinc-50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-zinc-500 text-center sm:text-left">
            Updates take effect immediately on your Shelf, List, and Artists pages.
          </p>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial py-2 px-4 rounded-xl bg-white text-zinc-700 font-semibold border border-zinc-300 hover:bg-zinc-100 transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="flex-1 sm:flex-initial py-2 px-5 rounded-xl bg-zinc-950 text-white font-bold hover:bg-zinc-800 transition-all text-sm shadow-md flex items-center justify-center gap-2"
            >
              <SparklesIcon className="w-4 h-4 text-amber-400" />
              <span>Apply Fixes ({totalChangesCount})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(ArtistSorterModal);
