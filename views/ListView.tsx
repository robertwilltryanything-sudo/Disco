

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CD, SortKey, SortOrder } from '../types';
import CDList from '../components/CDList';
import SearchBar from '../components/SearchBar';
import SortControls from '../components/SortControls';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import { PlusIcon } from '../components/icons/PlusIcon';
import FeaturedAlbum from '../components/FeaturedAlbum';
import { useDebounce } from '../hooks/useDebounce';

interface ListViewProps {
  cds: CD[];
  onDeleteCD: (id: string) => void;
  onRequestAdd: () => void;
  onRequestEdit: (cd: CD) => void;
}

/**
 * Gets a consistent string for the start of the current week (Sunday).
 * This ensures the featured album only changes once per week.
 * @param date The current date.
 * @returns A string representing the date of the most recent Sunday.
 */
const getWeekIdentifier = (date: Date): string => {
    const d = new Date(date);
    const day = d.getDay(); // Sunday is 0, Monday is 1, etc.
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff)).toDateString();
};


const ListView: React.FC<ListViewProps> = ({ cds, onDeleteCD, onRequestAdd, onRequestEdit }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300); // 300ms delay
  const [sortBy, setSortBy] = useState<SortKey>('artist');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [cdToDelete, setCdToDelete] = useState<CD | null>(null);
  const [featuredCD, setFeaturedCD] = useState<CD | null>(null);

  const location = useLocation();
  const navigate = useNavigate();

  const selectNewFeaturedCD = useCallback(() => {
    if (cds.length > 0) {
      const randomIndex = Math.floor(Math.random() * cds.length);
      const newFeaturedCD = cds[randomIndex];
      setFeaturedCD(newFeaturedCD);

      try {
        const dataToStore = {
          id: newFeaturedCD.id,
          date: getWeekIdentifier(new Date()),
        };
        localStorage.setItem('featuredAlbum', JSON.stringify(dataToStore));
      } catch (e) {
        console.error("Failed to save featured album to localStorage", e);
      }
    }
  }, [cds]);

  useEffect(() => {
    if (cds.length === 0) {
      setFeaturedCD(null);
      return;
    }

    const currentWeek = getWeekIdentifier(new Date());
    let featuredAlbumData;

    try {
      const storedData = localStorage.getItem('featuredAlbum');
      if (storedData) {
        featuredAlbumData = JSON.parse(storedData);
      }
    } catch (e) {
      console.error("Failed to parse featured album from localStorage", e);
      localStorage.removeItem('featuredAlbum');
    }

    if (featuredAlbumData && featuredAlbumData.date === currentWeek) {
      const existingFeaturedCD = cds.find(cd => cd.id === featuredAlbumData.id);
      if (existingFeaturedCD) {
        setFeaturedCD(existingFeaturedCD);
      } else {
        // The stored CD ID is no longer in the collection, so pick a new one
        selectNewFeaturedCD();
      }
    } else {
      // It's a new week or no featured album was stored, so pick a new one
      selectNewFeaturedCD();
    }
  }, [cds, selectNewFeaturedCD]);

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

  const filteredAndSortedCds = useMemo(() => {
    return [...cds]
      .filter(cd => {
        const lowerCaseQuery = debouncedSearchQuery.toLowerCase();
        return (
          cd.artist.toLowerCase().includes(lowerCaseQuery) ||
          cd.title.toLowerCase().includes(lowerCaseQuery) ||
          (cd.year && cd.year.toString().includes(debouncedSearchQuery)) ||
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
      {featuredCD && !searchQuery && (
        <div className="mb-8">
          <div className="w-full max-w-4xl mx-auto">
            <FeaturedAlbum cd={featuredCD} />
          </div>
        </div>
      )}

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
            className="flex-shrink-0 flex items-center justify-center gap-2 bg-zinc-900 text-white font-bold py-2 px-4 rounded-md hover:bg-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900 h-12"
          >
            <PlusIcon className="h-5 w-5" />
            <span className="hidden sm:inline">Add CD</span>
          </button>
        </div>
      </div>

      <CDList cds={filteredAndSortedCds} onRequestDelete={handleRequestDelete} onRequestEdit={handleRequestEdit} />
      
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