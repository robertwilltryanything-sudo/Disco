import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CD, SortKey, SortOrder } from '../types';
import CDList from '../components/CDList';
import SearchBar from '../components/SearchBar';
import SortControls from '../components/SortControls';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import { PlusIcon } from '../components/icons/PlusIcon';
import { useDebounce } from '../hooks/useDebounce';
import FeaturedAlbum from '../components/FeaturedAlbum';
import QuickStats from '../components/CollectionStats';

interface ListViewProps {
  cds: CD[];
  onDeleteCD: (id: string) => void;
  onRequestAdd: () => void;
  onRequestEdit: (cd: CD) => void;
}

const ListView: React.FC<ListViewProps> = ({ cds, onDeleteCD, onRequestAdd, onRequestEdit }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300); // 300ms delay
  const [sortBy, setSortBy] = useState<SortKey>('artist');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [cdToDelete, setCdToDelete] = useState<CD | null>(null);

  const location = useLocation();
  const navigate = useNavigate();

  // Effect to handle navigation state for editing or filtering
  useEffect(() => {
    const { editCdId, filterByArtist, filterByYear, filterByGenre, filterByRecordLabel, filterByTag } = location.state || {};
    let stateWasHandled = false;

    if (editCdId) {
      const cd = cds.find(c => c.id === editCdId);
      if (cd) {
        onRequestEdit(cd);
        stateWasHandled = true;
      }
    } else if (filterByArtist) {
        setSearchQuery(filterByArtist);
        stateWasHandled = true;
    } else if (filterByYear) {
        setSearchQuery(String(filterByYear));
        stateWasHandled = true;
    } else if (filterByGenre) {
        setSearchQuery(filterByGenre);
        stateWasHandled = true;
    } else if (filterByRecordLabel) {
        setSearchQuery(filterByRecordLabel);
        stateWasHandled = true;
    } else if (filterByTag) {
        setSearchQuery(filterByTag);
        stateWasHandled = true;
    }

    if (stateWasHandled) {
      // Clear the state from history so the action doesn't re-trigger
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, cds, navigate, onRequestEdit]);

  const featuredCd = useMemo(() => {
    if (cds.length === 0) return null;
    // Feature the most recently added CD for freshness
    return cds[0];
  }, [cds]);

  const filteredAndSortedCds = useMemo(() => {
    return [...cds]
      .filter(cd => {
        const lowerCaseQuery = debouncedSearchQuery.toLowerCase();
        // Handle decade searches like "1980s" by just checking for "1980"
        const query = lowerCaseQuery.endsWith('s') && lowerCaseQuery.length === 5 ? lowerCaseQuery.slice(0, 4) : lowerCaseQuery;
        
        return (
          cd.artist.toLowerCase().includes(query) ||
          cd.title.toLowerCase().includes(query) ||
          (cd.year && cd.year.toString().includes(query)) ||
          (cd.genre && cd.genre.toLowerCase().includes(query)) ||
          (cd.recordLabel && cd.recordLabel.toLowerCase().includes(query)) ||
          (cd.tags && cd.tags.some(tag => tag.toLowerCase().includes(query)))
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
  }, [cds, debouncedSearchQuery, sortBy, sortOrder]);

  const handleRequestDelete = useCallback((id: string) => {
    const cd = cds.find(c => c.id === id);
    if (cd) {
      setCdToDelete(cd);
    }
  }, [cds]);

  const handleConfirmDelete = useCallback(() => {
    if (cdToDelete) {
      onDeleteCD(cdToDelete.id);
      setCdToDelete(null);
    }
  }, [cdToDelete, onDeleteCD]);

  const handleRequestEdit = useCallback((cd: CD) => {
    onRequestEdit(cd);
  }, [onRequestEdit]);
  

  return (
    <div>
      <div className="lg:flex lg:gap-6 mb-8">
        <div className="lg:w-2/3">
          {featuredCd ? (
            <FeaturedAlbum cd={featuredCd} />
          ) : (
            <div className="bg-white rounded-lg border border-zinc-200 p-6 flex flex-col items-center justify-center h-full text-center min-h-[250px]">
                <h3 className="text-xl font-bold text-zinc-800">Your Collection is Empty</h3>
                <p className="text-zinc-600 mt-2">Click the "Add CD" button to start building your collection.</p>
                <button
                    onClick={onRequestAdd}
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

      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
        <div className="w-full md:w-1/3">
           <SearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
        </div>
        <div className="w-full md:w-auto flex items-center gap-4">
          <div className="flex-grow">
            <SortControls sortBy={sortBy} setSortBy={setSortBy} sortOrder={sortOrder} setSortOrder={setSortOrder} />
          </div>
          <button
            onClick={onRequestAdd}
            className="flex-shrink-0 flex items-center justify-center gap-2 bg-zinc-900 text-white font-bold py-2 px-4 rounded-lg hover:bg-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900 h-12"
          >
            <PlusIcon className="h-5 w-5" />
            <span className="hidden sm:inline">Add CD</span>
          </button>
        </div>
      </div>

      <CDList cds={filteredAndSortedCds} onRequestDelete={handleRequestDelete} onRequestEdit={handleRequestEdit} />
      
      {/* Mobile-only Collection Snapshot Footer Section */}
      <div className="lg:hidden mt-8">
        <QuickStats cds={cds} className="!h-auto" />
      </div>
      
      <ConfirmDeleteModal
        isOpen={!!cdToDelete}
        onClose={() => setCdToDelete(null)}
        onConfirm={handleConfirmDelete}
        cd={cdToDelete}
      />

    </div>
  );
};

export default ListView;