
import React, { useState, useMemo, useEffect, useCallback, useTransition } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { CD, SortKey, SortOrder, WantlistItem, CollectionMode } from '../types';
import CDList from '../components/CDList';
import SearchBar from '../components/SearchBar';
import SortControls from '../components/SortControls';
import { PlusIcon } from '../components/icons/PlusIcon';
import FeaturedAlbum from '../components/FeaturedAlbum';
import QuickStats from '../components/CollectionStats';
import { Squares2x2Icon } from '../components/icons/Squares2x2Icon';
import { QueueListIcon } from '../components/icons/QueueListIcon';
import CDTable from '../components/CDTable';
import { areStringsSimilar, getSortableName } from '../utils';
import MissingAlbumScanner from '../components/MissingAlbumScanner';

interface ListViewProps {
  cds: CD[];
  wantlist: WantlistItem[];
  onAddToWantlist: (item: Omit<WantlistItem, 'id' | 'created_at'>) => Promise<void>;
  onRequestAdd: (artist?: string) => void;
  onRequestEdit: (cd: CD) => void;
  collectionMode: CollectionMode;
  sortExceptions: string[];
}

const VIEW_MODE_KEY = 'disco_view_mode';

const ListView: React.FC<ListViewProps> = ({ cds, wantlist, onAddToWantlist, onRequestAdd, onRequestEdit, collectionMode, sortExceptions }) => {
  const [sortBy, setSortBy] = useState<SortKey>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [featuredCd, setFeaturedCd] = useState<CD | null>(null);
  const [view, setView] = useState<'grid' | 'list'>(() => {
    const storedView = localStorage.getItem(VIEW_MODE_KEY);
    return storedView === 'list' ? 'list' : 'grid';
  });

  const [searchParams, setSearchParams] = useSearchParams();
  const urlSearchQuery = searchParams.get('q') || '';
  const focusSearchIntent = searchParams.get('focus') === 'search';

  const [, startTransition] = useTransition();

  const handleSearch = useCallback((query: string) => {
    startTransition(() => {
      const newParams = new URLSearchParams(searchParams);
      if (query) {
        newParams.set('q', query);
      } else {
        newParams.delete('q');
      }
      newParams.delete('focus');
      setSearchParams(newParams, { replace: true });
    });
  }, [searchParams, setSearchParams]);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    localStorage.setItem(VIEW_MODE_KEY, view);
  }, [view]);

  useEffect(() => {
    if (focusSearchIntent) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        const input = document.getElementById('search-input');
        if (input) {
            input.focus();
        }
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('focus');
        setSearchParams(newParams, { replace: true });
    }
  }, [focusSearchIntent, searchParams, setSearchParams]);

  useEffect(() => {
    const { editCdId, addAlbumForArtist } = location.state || {};
    let stateWasHandled = false;

    if (editCdId) {
      const cd = cds.find(c => c.id === editCdId);
      if (cd) {
        onRequestEdit(cd);
        stateWasHandled = true;
      }
    } else if (addAlbumForArtist) {
        onRequestAdd(addAlbumForArtist);
        stateWasHandled = true;
    }

    if (stateWasHandled) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, cds, navigate, onRequestEdit, onRequestAdd]);

  useEffect(() => {
    if (cds.length === 0) {
        if (featuredCd !== null) setFeaturedCd(null);
        return;
    }

    const storageKey = `disco_featured_album_${collectionMode}`;
    const today = new Date().toISOString().split('T')[0];

    const storedDataRaw = localStorage.getItem(storageKey);
    let storedData: { cdId: string; date: string } | null = null;
    
    if (storedDataRaw) {
      try {
        storedData = JSON.parse(storedDataRaw);
      } catch (e) {
        localStorage.removeItem(storageKey);
      }
    }
    
    const currentFeaturedInCollection = storedData ? cds.find(cd => cd.id === storedData.cdId) : null;
    const needsRotation = !storedData || storedData.date !== today || !currentFeaturedInCollection;

    if (needsRotation) {
        let pool = cds;
        if (storedData && cds.length > 1) {
            pool = cds.filter(cd => cd.id !== storedData?.cdId);
        }
        const randomIndex = Math.floor(Math.random() * pool.length);
        const newSelection = pool[randomIndex];
        
        if (newSelection) {
            localStorage.setItem(storageKey, JSON.stringify({
                cdId: newSelection.id,
                date: today,
            }));
            if (featuredCd?.id !== newSelection.id) {
                setFeaturedCd(newSelection);
            }
        }
    } else if (currentFeaturedInCollection && featuredCd?.id !== currentFeaturedInCollection.id) {
        setFeaturedCd(currentFeaturedInCollection);
    }
  }, [cds, collectionMode, featuredCd?.id]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [urlSearchQuery]);

  const { filteredAndSortedCds, potentialArtistForScan } = useMemo(() => {
    const filtered = [...cds]
      .filter(cd => {
        if (!cd) return false;
        const lowerCaseQuery = urlSearchQuery.toLowerCase();
        const isNumericQuery = !isNaN(Number(lowerCaseQuery)) && lowerCaseQuery.length > 0;
        const isDecadeSearch = isNumericQuery && lowerCaseQuery.length === 4 && lowerCaseQuery.endsWith('0');
        const yearMatches = cd.year != null && (
          isDecadeSearch
            ? (cd.year >= Number(lowerCaseQuery) && cd.year <= Number(lowerCaseQuery) + 9)
            : cd.year.toString().includes(lowerCaseQuery)
        );
        return (
          (cd.artist && cd.artist.toLowerCase().includes(lowerCaseQuery)) ||
          (cd.title && cd.title.toLowerCase().includes(lowerCaseQuery)) ||
          yearMatches ||
          (cd.genre && cd.genre.toLowerCase().includes(lowerCaseQuery)) ||
          (cd.record_label && cd.record_label.toLowerCase().includes(lowerCaseQuery)) ||
          (cd.tags && cd.tags.some(tag => tag && tag.toLowerCase().includes(lowerCaseQuery)))
        );
      });
    
    const sorted = [...filtered]
      .sort((a, b) => {
        let valA = a[sortBy];
        let valB = b[sortBy];
        
        // Smart sorting for Artist and Title
        if (sortBy === 'artist') {
          valA = getSortableName(a.artist, true, sortExceptions);
          valB = getSortableName(b.artist, true, sortExceptions);
        } else if (sortBy === 'title') {
          valA = getSortableName(a.title, false, sortExceptions);
          valB = getSortableName(b.title, false, sortExceptions);
        }

        if (valA === undefined || valA === null) return 1;
        if (valB === undefined || valB === null) return -1;
        let comparison = 0;
        if (typeof valA === 'string' && typeof valB === 'string') {
          comparison = valA.localeCompare(valB);
        } else if (typeof valA === 'number' && typeof valB === 'number') {
          comparison = (valA as number) - (valB as number);
        }
        return sortOrder === 'asc' ? comparison : -comparison;
      });

    let artistForScan: string | null = null;
    if (urlSearchQuery && sorted.length > 0) {
      const firstArtist = sorted[0].artist;
      const allSameArtist = sorted.every(cd => areStringsSimilar(cd.artist, firstArtist, 0.95));
      const queryMatchesArtist = areStringsSimilar(urlSearchQuery, firstArtist, 0.85);
      if (allSameArtist && queryMatchesArtist) {
        artistForScan = firstArtist;
      }
    }
    return { filteredAndSortedCds: sorted, potentialArtistForScan: artistForScan };
  }, [cds, urlSearchQuery, sortBy, sortOrder, sortExceptions]);

  const albumType = collectionMode === 'vinyl' ? 'Vinyl' : 'CD';

  return (
    <div>
      {!urlSearchQuery && (
        <div className="lg:flex lg:gap-6 mb-8">
          <div className="lg:w-2/3">
            {featuredCd ? (
              <FeaturedAlbum cd={featuredCd} />
            ) : (
              <div className="bg-white rounded-lg border border-zinc-200 p-6 flex flex-col items-center justify-center h-full text-center min-h-[256px]">
                <h3 className="text-xl font-bold text-zinc-800">Welcome to DiscO!</h3>
                <p className="text-zinc-600 mt-2">Your {collectionMode} collection is empty. Add your first {albumType} to get started.</p>
                <button
                  onClick={() => onRequestAdd()}
                  className="mt-4 flex items-center justify-center gap-2 bg-zinc-900 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900"
                >
                  <PlusIcon className="h-5 w-5" />
                  Add a {albumType}
                </button>
              </div>
            )}
          </div>
          <div className="hidden lg:block lg:w-1/3 mt-6 lg:mt-0">
            <QuickStats cds={cds} collectionMode={collectionMode} />
          </div>
        </div>
      )}
      
      <div className="py-4 mb-6 space-y-4">
        {/* Row 1: Search */}
        <div className="w-full">
          <SearchBar initialQuery={urlSearchQuery} onSearch={handleSearch} albumType={albumType} />
        </div>
        
        {/* Row 2: Sort & View Options */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="w-full sm:w-auto">
            <SortControls sortBy={sortBy} setSortBy={setSortBy} sortOrder={sortOrder} setSortOrder={setSortOrder} />
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            {urlSearchQuery && (
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                {filteredAndSortedCds.length} match{filteredAndSortedCds.length !== 1 ? 'es' : ''}
              </span>
            )}
            
            <div className="flex items-center gap-1 p-1 bg-zinc-200 rounded-lg">
                <button 
                  onClick={() => setView('grid')} 
                  className={`p-1.5 rounded-md transition-all ${view === 'grid' ? 'bg-white text-zinc-800 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                  aria-label="Grid View"
                  title="Grid View"
                >
                    <Squares2x2Icon className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setView('list')}
                  className={`p-1.5 rounded-md transition-all ${view === 'list' ? 'bg-white text-zinc-800 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                  aria-label="List View"
                  title="List View"
                >
                    <QueueListIcon className="w-5 h-5" />
                </button>
            </div>
          </div>
        </div>
      </div>
      
      {view === 'grid' ? (
        <CDList cds={filteredAndSortedCds} albumType={albumType} />
      ) : (
        <CDTable cds={filteredAndSortedCds} onRequestEdit={onRequestEdit} albumType={albumType} />
      )}

      {potentialArtistForScan && filteredAndSortedCds.length > 0 && (
        <div className="mt-8">
          <MissingAlbumScanner 
            artistName={potentialArtistForScan}
            userAlbumsByArtist={filteredAndSortedCds}
            wantlist={wantlist}
            onAddToWantlist={onAddToWantlist}
          />
        </div>
      )}
    </div>
  );
};

export default ListView;
