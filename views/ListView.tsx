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
import { areStringsSimilar } from '../utils';
import MissingAlbumScanner from '../components/MissingAlbumScanner';

interface ListViewProps {
  cds: CD[];
  wantlist: WantlistItem[];
  onAddToWantlist: (item: Omit<WantlistItem, 'id' | 'created_at'>) => Promise<void>;
  onRequestAdd: (artist?: string) => void;
  onRequestEdit: (cd: CD) => void;
  collectionMode: CollectionMode;
}

const VIEW_MODE_KEY = 'disco_view_mode';

const ListView: React.FC<ListViewProps> = ({ cds, wantlist, onAddToWantlist, onRequestAdd, onRequestEdit, collectionMode }) => {
  const [sortBy, setSortBy] = useState<SortKey>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [featuredCd, setFeaturedCd] = useState<CD | null>(null);
  const [view, setView] = useState<'grid' | 'list'>(() => {
    const storedView = localStorage.getItem(VIEW_MODE_KEY);
    return storedView === 'list' ? 'list' : 'grid';
  });

  const [searchParams, setSearchParams] = useSearchParams();
  const urlSearchQuery = searchParams.get('q') || '';

  const [, startTransition] = useTransition();

  const handleSearch = useCallback((query: string) => {
    startTransition(() => {
      const newParams = new URLSearchParams(searchParams);
      if (query) {
        newParams.set('q', query);
      } else {
        newParams.delete('q');
      }
      setSearchParams(newParams, { replace: true });
    });
  }, [searchParams, setSearchParams]);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    localStorage.setItem(VIEW_MODE_KEY, view);
  }, [view]);

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
        setFeaturedCd(null);
        return;
    }

    const FEATURED_ALBUM_KEY = 'disco_featured_album';
    const ONE_WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000;

    const storedDataRaw = localStorage.getItem(FEATURED_ALBUM_KEY);
    let storedData: { cdId: string; timestamp: number } | null = null;
    if (storedDataRaw) {
      try {
        storedData = JSON.parse(storedDataRaw);
      } catch (e) {
        console.error("Could not parse featured album data from localStorage", e);
        localStorage.removeItem(FEATURED_ALBUM_KEY);
      }
    }
    
    let currentFeaturedCdInCollection: CD | null = null;
    if (storedData && storedData.cdId) {
        currentFeaturedCdInCollection = cds.find(cd => cd.id === storedData.cdId) || null;
    }
    
    const now = Date.now();
    const needsNewFeaturedAlbum = 
        !storedData || 
        !currentFeaturedCdInCollection ||
        (now - (storedData.timestamp || 0) > ONE_WEEK_IN_MS);

    if (needsNewFeaturedAlbum) {
        const potentialCds = currentFeaturedCdInCollection 
            ? cds.filter(cd => cd.id !== currentFeaturedCdInCollection!.id) 
            : cds;
        
        const selectionPool = potentialCds.length > 0 ? potentialCds : cds;

        const randomIndex = Math.floor(Math.random() * selectionPool.length);
        const newFeaturedCd = selectionPool[randomIndex];
        
        if (newFeaturedCd) {
            localStorage.setItem(FEATURED_ALBUM_KEY, JSON.stringify({
                cdId: newFeaturedCd.id,
                timestamp: now,
            }));
            setFeaturedCd(newFeaturedCd);
        }
    } else {
        setFeaturedCd(currentFeaturedCdInCollection);
    }
  }, [cds]);

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
          (cd.recordLabel && cd.recordLabel.toLowerCase().includes(lowerCaseQuery)) ||
          (cd.tags && cd.tags.some(tag => tag && tag.toLowerCase().includes(lowerCaseQuery)))
        );
      });
    
    const sorted = [...filtered]
      .sort((a, b) => {
        const valA = a[sortBy];
        const valB = b[sortBy];
        
        if (valA === undefined || valA === null) return 1;
        if (valB === undefined || valB === null) return -1;

        let comparison = 0;
        if (typeof valA === 'string' && typeof valB === 'string') {
          comparison = valA.localeCompare(valB);
        } else if (typeof valA === 'number' && typeof valB === 'number') {
          comparison = valA - valB;
        }

        return sortOrder === 'asc' ? comparison : -comparison;
      });

    let artistForScan: string | null = null;
    if (urlSearchQuery && sorted.length > 0) {
      const firstArtist = sorted[0].artist;
      // Condition 1: All results must be from the same artist.
      const allSameArtist = sorted.every(cd => areStringsSimilar(cd.artist, firstArtist, 0.95));
      // Condition 2: The search query itself must be similar to that artist's name.
      const queryMatchesArtist = areStringsSimilar(urlSearchQuery, firstArtist, 0.85);

      if (allSameArtist && queryMatchesArtist) {
        // Use the artist name from the data for accuracy, not the user's potentially misspelled query.
        artistForScan = firstArtist;
      }
    }
    return { filteredAndSortedCds: sorted, potentialArtistForScan: artistForScan };
  }, [cds, urlSearchQuery, sortBy, sortOrder]);

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
                  className="mt-4 flex items-center justify-center gap-2 bg-zinc-900 text-white font-bold py-2 px-4 rounded-lg hover:bg-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900"
                >
                  <PlusIcon className="h-5 w-5" />
                  Add a {albumType}
                </button>
              </div>
            )}
          </div>
          <div className="lg:w-1/3 mt-6 lg:mt-0">
            <QuickStats cds={cds} collectionMode={collectionMode} />
          </div>
        </div>
      )}
      <div className="sticky top-[89px] md:top-[93px] bg-zinc-100/80 backdrop-blur-sm z-10 py-3 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
          <SearchBar initialQuery={urlSearchQuery} onSearch={handleSearch} albumType={albumType} />
          <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
            <SortControls sortBy={sortBy} setSortBy={setSortBy} sortOrder={sortOrder} setSortOrder={setSortOrder} />
            <div className="hidden sm:flex items-center gap-2">
                <div className="flex items-center gap-1 p-1 bg-zinc-200 rounded-lg">
                    <button 
                      onClick={() => setView('grid')} 
                      className={`p-1.5 rounded-md ${view === 'grid' ? 'bg-white text-zinc-800 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                      aria-label="Grid View"
                      title="Grid View"
                    >
                        <Squares2x2Icon className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => setView('list')}
                      className={`p-1.5 rounded-md ${view === 'list' ? 'bg-white text-zinc-800 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
                      aria-label="List View"
                      title="List View"
                    >
                        <QueueListIcon className="w-5 h-5" />
                    </button>
                </div>
                {urlSearchQuery && (
                    <span className="flex items-center justify-center text-sm font-semibold text-zinc-500 bg-zinc-200 w-7 h-7 rounded-full">
                        {filteredAndSortedCds.length}
                    </span>
                )}
            </div>
          </div>
        </div>
        {urlSearchQuery && (
          <div className="mt-3 text-center sm:text-left">
            <p className="text-sm font-medium text-zinc-700">
                Found {filteredAndSortedCds.length} result{filteredAndSortedCds.length !== 1 ? 's' : ''}.
            </p>
          </div>
        )}
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