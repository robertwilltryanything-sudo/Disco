import React, { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { CD, SortKey, SortOrder } from '../types';
import CDList from '../components/CDList';
import SearchBar from '../components/SearchBar';
import SortControls from '../components/SortControls';
import { PlusIcon } from '../components/icons/PlusIcon';
import FeaturedAlbum from '../components/FeaturedAlbum';
import QuickStats from '../components/CollectionStats';

interface ListViewProps {
  cds: CD[];
  onRequestAdd: (artist?: string) => void;
  onRequestEdit: (cd: CD) => void;
}

const ListView: React.FC<ListViewProps> = ({ cds, onRequestAdd, onRequestEdit }) => {
  const [sortBy, setSortBy] = useState<SortKey>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [featuredCd, setFeaturedCd] = useState<CD | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get('q') || '';

  const location = useLocation();
  const navigate = useNavigate();

  const setSearchQuery = (query: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (query) {
      newParams.set('q', query);
    } else {
      newParams.delete('q');
    }
    setSearchParams(newParams, { replace: true });
  };

  // Effect to change default sort order for artist searches.
  useEffect(() => {
    if (searchQuery) {
      const artistsInCollection = new Set(cds.map(cd => cd.artist.toLowerCase()));
      const isArtistSearch = artistsInCollection.has(searchQuery.toLowerCase());

      if (isArtistSearch) {
        setSortBy('year');
        setSortOrder('asc');
      } else {
        // Revert to default for non-artist searches.
        setSortBy('created_at');
        setSortOrder('desc');
      }
    } else {
      // Revert to default when search is cleared.
      setSortBy('created_at');
      setSortOrder('desc');
    }
  }, [searchQuery, cds]);

  // Effect to handle modal actions from navigation state (e.g., editing)
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
      // Clear the state to prevent the modal from re-opening on re-renders.
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
        // .find() returns undefined if not found, so we coerce it to null to match the state's type.
        currentFeaturedCdInCollection = cds.find(cd => cd.id === storedData.cdId) || null;
    }
    
    const now = Date.now();
    const needsNewFeaturedAlbum = 
        !storedData || 
        !currentFeaturedCdInCollection || // The old featured CD might have been deleted
        (now - (storedData.timestamp || 0) > ONE_WEEK_IN_MS);

    if (needsNewFeaturedAlbum) {
        // Select a new random CD. To avoid picking the same one if it exists, filter it out first.
        const potentialCds = currentFeaturedCdInCollection 
            ? cds.filter(cd => cd.id !== currentFeaturedCdInCollection!.id) 
            : cds;
        
        // If filtering out the only CD leaves an empty array, fall back to the full list.
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
        // Set the existing one
        setFeaturedCd(currentFeaturedCdInCollection);
    }
  }, [cds]);

  // Scroll to top whenever the filter criteria (search query) changes.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [searchQuery]);

  const filteredAndSortedCds = useMemo(() => {
    return [...cds]
      .filter(cd => {
        const lowerCaseQuery = searchQuery.toLowerCase();
        
        // A decade search from the dashboard is a 4-digit number like "1980"
        const isNumericQuery = !isNaN(Number(lowerCaseQuery)) && lowerCaseQuery.length > 0;
        const isDecadeSearch = isNumericQuery && lowerCaseQuery.length === 4 && lowerCaseQuery.endsWith('0');

        const yearMatches = cd.year && (
          isDecadeSearch
            // For a decade search, check if the year is within the 10-year range.
            ? (cd.year >= Number(lowerCaseQuery) && cd.year <= Number(lowerCaseQuery) + 9)
            // For other numeric searches, check if the year string includes the query.
            : cd.year.toString().includes(lowerCaseQuery)
        );

        return (
          cd.artist.toLowerCase().includes(lowerCaseQuery) ||
          cd.title.toLowerCase().includes(lowerCaseQuery) ||
          yearMatches ||
          (cd.genre && cd.genre.toLowerCase().includes(lowerCaseQuery)) ||
          (cd.recordLabel && cd.recordLabel.toLowerCase().includes(lowerCaseQuery)) ||
          (cd.tags && cd.tags.some(tag => tag.toLowerCase().includes(lowerCaseQuery)))
        );
      })
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
  }, [cds, searchQuery, sortBy, sortOrder]);

  return (
    <div>
      {!searchQuery && (
        <div className="lg:flex lg:gap-6 mb-8">
          <div className="lg:w-2/3">
            {featuredCd ? (
              <FeaturedAlbum cd={featuredCd} />
            ) : (
              <div className="bg-white rounded-lg border border-zinc-200 p-6 flex flex-col items-center justify-center h-full text-center min-h-[250px]">
                  <h3 className="text-xl font-bold text-zinc-800">Your Collection is Empty</h3>
                  <p className="text-zinc-600 mt-2">Click the "Add CD" button to start building your collection.</p>
                  <button
                      onClick={() => onRequestAdd()}
                      className="mt-4 flex-shrink-0 flex items-center justify-center gap-2 bg-zinc-900 text-white font-bold py-2 px-4 rounded-lg hover:bg-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900"
                  >
                      <PlusIcon className="h-5 w-5" />
                      Add Your First CD
                  </button>
              </div>
            )}
          </div>
          <div className="hidden lg:block lg:w-1/3">
            <QuickStats cds={cds} />
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
        <div className="w-full md:w-2/3 lg:w-1/2">
           <SearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
        </div>
        <div className="w-full md:w-auto">
          <SortControls sortBy={sortBy} setSortBy={setSortBy} sortOrder={sortOrder} setSortOrder={setSortOrder} />
        </div>
      </div>
      
      {searchQuery && (
        <div className="mb-4 -mt-2">
            <p className="text-sm text-zinc-600 text-center md:text-left">
                Found <span className="font-bold text-zinc-800">{filteredAndSortedCds.length}</span> {filteredAndSortedCds.length === 1 ? 'CD' : 'CDs'}.
            </p>
        </div>
      )}

      <CDList cds={filteredAndSortedCds} />
      
      {/* Mobile-only Collection Snapshot Footer Section */}
      <div className="lg:hidden mt-8">
        <QuickStats cds={cds} className="!h-auto" />
      </div>

    </div>
  );
};

export default ListView;