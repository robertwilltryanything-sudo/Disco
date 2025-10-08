

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { CD } from './types';
import Header from './components/Header';
import ListView from './views/ListView';
import DetailView from './views/DetailView';
import ArtistsView from './views/ArtistsView';
import { getAlbumDetails } from './gemini';
import { useGoogleDrive } from './hooks/useGoogleDrive';
import { findCoverArt } from './wikipedia';
import AddCDForm from './components/AddCDForm';
import { XIcon } from './components/icons/XIcon';
import ConfirmDuplicateModal from './components/ConfirmDuplicateModal';
import { areStringsSimilar } from './utils';
import { useDebounce } from './hooks/useDebounce';

// Initial data for demonstration purposes. Cover art will be found on first load.
const INITIAL_CDS: CD[] = [
  { id: '1', artist: 'U2', title: 'War', genre: 'Post-Punk', year: 1983, recordLabel: 'Island', tags: ['80s rock', 'political', 'post-punk'] },
  { id: '3', artist: 'The Beatles', title: 'Abbey Road', genre: 'Rock', year: 1969, version: '2009 Remaster', recordLabel: 'Apple', tags: ['60s rock', 'classic rock'] },
  { id: '6', artist: 'Fleetwood Mac', title: 'Rumours', genre: 'Rock', year: 1977, recordLabel: 'Warner Bros.', tags: ['70s rock', 'soft rock'] },
  { id: '7', artist: 'Jean Michel Jarre', title: 'Equinoxe', genre: 'Electronic', year: 1978, recordLabel: 'Disques Dreyfus', tags: ['electronic', 'ambient', '70s'] },
];

const COLLECTION_STORAGE_KEY = 'disco_collection_v2';
const HAS_SYNCED_KEY = 'disco_has_synced_with_drive_v1';

// Helper to fetch artwork for the initial collection using the reliable findCoverArt function.
const populateInitialArtwork = async (initialCds: CD[]): Promise<CD[]> => {
  const cdsWithArtPromises = initialCds.map(async (cd) => {
    if (!cd.coverArtUrl) {
      try {
        const imageUrls = await findCoverArt(cd.artist, cd.title);
        if (imageUrls && imageUrls.length > 0) {
          // Use the first result as the cover art
          return { ...cd, coverArtUrl: imageUrls[0] };
        }
      } catch (error) {
        console.error(`Failed to find cover art for ${cd.title}:`, error);
      }
    }
    return cd;
  });

  return Promise.all(cdsWithArtPromises);
};

const findPotentialDuplicate = (newCd: Omit<CD, 'id'>, collection: CD[]): CD | null => {
    for (const existingCd of collection) {
        // Check if artist and title are very similar. A threshold of 0.85 handles minor typos.
        const artistSimilar = areStringsSimilar(newCd.artist, existingCd.artist, 0.85);
        const titleSimilar = areStringsSimilar(newCd.title, existingCd.title, 0.85);
        if (artistSimilar && titleSimilar) {
            return existingCd;
        }
    }
    return null;
};


const App: React.FC = () => {
  const [cds, setCds] = useState<CD[]>([]);
  const debouncedCds = useDebounce(cds, 1000);
  const { 
    isApiReady, 
    isSignedIn, 
    signOut, 
    loadCollection, 
    saveCollection, 
    syncStatus,
    error: driveError,
  } = useGoogleDrive();
  const isInitialLoad = useRef(true);
  const hasLoadedFromDrive = useRef(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [cdToEdit, setCdToEdit] = useState<CD | null>(null);
  const [duplicateInfo, setDuplicateInfo] = useState<{ newCd: Omit<CD, 'id'>, existingCd: CD } | null>(null);

  // Initial data load effect
  useEffect(() => {
    const initialLoad = async () => {
      // Priority 1: Google Drive (if signed in)
      if (isSignedIn && !hasLoadedFromDrive.current) {
        try {
          const driveCds = await loadCollection(); // Returns CD[] or null on error
          
          if (driveCds !== null) { // A non-null response means the connection was successful.
            hasLoadedFromDrive.current = true;
            const hasSyncedBefore = localStorage.getItem(HAS_SYNCED_KEY);

            // Case 1: First time syncing and Drive is empty.
            // We should use local data if it exists, otherwise seed with initial data.
            if (driveCds.length === 0 && !hasSyncedBefore) {
              try {
                const storedCds = localStorage.getItem(COLLECTION_STORAGE_KEY);
                if (storedCds) {
                  const localCds = JSON.parse(storedCds);
                  if (localCds.length > 0) {
                    console.log("First sync: Using existing local data and preparing to upload.");
                    setCds(localCds);
                    localStorage.setItem(HAS_SYNCED_KEY, 'true'); // Mark that we've now handled the first sync.
                    return; // Done. The save effect will handle the upload.
                  }
                }
              } catch (e) {
                  console.error("Could not parse local storage during first sync check", e);
              }
              
              // No valid local data, so this is a true first run. Seed the data.
              console.log("First sync: No local data found. Populating initial album artwork.");
              const cdsWithArt = await populateInitialArtwork(INITIAL_CDS);
              setCds(cdsWithArt);
              localStorage.setItem(HAS_SYNCED_KEY, 'true');
              return;
            }
            
            // Case 2: We have synced before OR Drive already has data.
            // In this case, Drive is the definitive source of truth.
            console.log("Loading collection from Google Drive as the source of truth.");
            setCds(driveCds);
            if (!hasSyncedBefore) {
              localStorage.setItem(HAS_SYNCED_KEY, 'true');
            }
            return;
          }
        } catch(e) {
          console.error("Failed to load from Google Drive, will fall back to local storage.", e);
        }
      }
      
      // Priority 2: Local Storage (if not signed in, or if Drive sync failed)
      try {
        const storedCds = localStorage.getItem(COLLECTION_STORAGE_KEY);
        if (storedCds) {
          setCds(JSON.parse(storedCds));
        } else {
          // This is a first run without sync enabled, or there's no data anywhere.
          console.log("No local data found. Populating initial album artwork.");
          const cdsWithArt = await populateInitialArtwork(INITIAL_CDS);
          setCds(cdsWithArt);
        }
      } catch (error) {
        console.error("Error loading CDs from localStorage:", error);
        // Fallback if localStorage is corrupt.
        const cdsWithArt = await populateInitialArtwork(INITIAL_CDS);
        setCds(cdsWithArt);
      }
    };

    if (isApiReady) {
      initialLoad();
    }
  }, [isApiReady, isSignedIn, loadCollection]);

  // Data saving effect - now debounced to avoid excessive writes during rapid changes.
  useEffect(() => {
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }

    try {
      localStorage.setItem(COLLECTION_STORAGE_KEY, JSON.stringify(debouncedCds));
    } catch (error) {
      console.error("Error saving CDs to localStorage:", error);
    }
    
    if (isSignedIn) {
      saveCollection(debouncedCds);
    }
  }, [debouncedCds, isSignedIn, saveCollection]);
  
  // FIX: Using a generic type `T` to preserve the exact type of the `cd` object passed in.
  // This ensures that if a `CD` with a required `id` is passed, the function returns a `CD`,
  // resolving a downstream type error in `handleUpdateCD`.
  const fetchAndApplyAlbumDetails = useCallback(async <T extends Omit<CD, 'id'> & { id?: string }>(cd: T): Promise<T> => {
    const shouldFetch = !cd.genre || !cd.recordLabel || !cd.tags || cd.tags.length === 0;

    if (shouldFetch && cd.artist && cd.title) {
        console.log(`Fetching missing details for ${cd.artist} - ${cd.title}`);
        try {
            const details = await getAlbumDetails(cd.artist, cd.title);
            if (details) {
                const enrichedCd = { ...cd };

                if (!enrichedCd.genre && details.genre) {
                    enrichedCd.genre = details.genre;
                }
                if (!enrichedCd.recordLabel && details.recordLabel) {
                    enrichedCd.recordLabel = details.recordLabel;
                }
                // FIX: The type of `year` is `number | undefined`, so it cannot be compared to an empty string.
                // The check `!enrichedCd.year` is sufficient to see if the year is missing.
                if (!enrichedCd.year && details.year) {
                    enrichedCd.year = details.year;
                }

                const existingTags = new Set(enrichedCd.tags?.map(t => t.toLowerCase()) || []);
                if (details.tags) {
                    details.tags.forEach(tag => existingTags.add(tag.toLowerCase()));
                }
                enrichedCd.tags = Array.from(existingTags);
                
                return enrichedCd;
            }
        } catch (error) {
            console.error("Could not fetch additional album details from Gemini:", error);
            return cd; // Return original on error
        }
    }
    return cd; // Return original if no fetch was needed
  }, []);

  const handleAddCD = useCallback(async (cdData: Omit<CD, 'id'>) => {
    const enrichedCdData = await fetchAndApplyAlbumDetails(cdData);
    const newCd: CD = {
      ...enrichedCdData,
      id: `${new Date().getTime()}-${Math.random()}`, // More unique ID
    };
    setCds(prevCds => [newCd, ...prevCds]);
  }, [fetchAndApplyAlbumDetails]);

  const handleUpdateCD = useCallback(async (updatedCdData: CD) => {
    const enrichedCdData = await fetchAndApplyAlbumDetails(updatedCdData);
    setCds(prevCds =>
      prevCds.map(cd => (cd.id === enrichedCdData.id ? enrichedCdData : cd))
    );
  }, [fetchAndApplyAlbumDetails]);


  const handleDeleteCD = useCallback((id: string) => {
    setCds(prevCds => prevCds.filter(cd => cd.id !== id));
  }, []);

  const handleRequestAdd = useCallback(() => {
    setCdToEdit(null);
    setIsAddModalOpen(true);
  }, []);

  const handleRequestEdit = useCallback((cd: CD) => {
    setCdToEdit(cd);
    setIsAddModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsAddModalOpen(false);
    setCdToEdit(null);
  }, []);

  const handleSaveCD = useCallback(async (cdData: Omit<CD, 'id'> & { id?: string }) => {
    if (cdData.id) {
      // This is an update, no duplicate check needed
      await handleUpdateCD(cdData as CD);
      handleCloseModal();
    } else {
      // This is a new CD, check for duplicates
      const duplicate = findPotentialDuplicate(cdData, cds);
      if (duplicate) {
        // Found a duplicate, open confirmation modal
        // The add/edit modal remains open in the background
        setDuplicateInfo({ newCd: cdData, existingCd: duplicate });
      } else {
        // No duplicate, proceed with adding and close the modal
        await handleAddCD(cdData as Omit<CD, 'id'>);
        handleCloseModal();
      }
    }
  }, [handleUpdateCD, handleAddCD, handleCloseModal, cds]);
  
  const handleConfirmDuplicate = useCallback(async (version: string) => {
    if (duplicateInfo) {
      const cdWithVersion = {
        ...duplicateInfo.newCd,
        version: version, // The version from the modal input
      };
      await handleAddCD(cdWithVersion);
      setDuplicateInfo(null);
      handleCloseModal(); // Close the main form modal
    }
  }, [duplicateInfo, handleAddCD, handleCloseModal]);

  const handleCancelDuplicate = useCallback(() => {
    setDuplicateInfo(null);
    // Do nothing, user is back in the form to edit the entry
  }, []);
  
  const RouteWrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
    <main className="container mx-auto p-4 md:p-6">{children}</main>
  );

  return (
    <HashRouter>
      <div className="flex flex-col min-h-screen">
        <Header 
          isApiReady={isApiReady}
          isSignedIn={isSignedIn}
          signOut={signOut}
          syncStatus={syncStatus}
          driveError={driveError}
          onAddClick={handleRequestAdd}
          collectionCount={cds.length}
        />
        <Routes>
          <Route path="/" element={
            <RouteWrapper>
              <ListView 
                cds={cds} 
                onDeleteCD={handleDeleteCD}
                onRequestAdd={handleRequestAdd}
                onRequestEdit={handleRequestEdit}
              />
            </RouteWrapper>
          } />
          <Route path="/cd/:id" element={
            <RouteWrapper>
              <DetailView cds={cds} />
            </RouteWrapper>
          } />
          <Route path="/artists" element={
            <RouteWrapper>
              <ArtistsView cds={cds} />
            </RouteWrapper>
          } />
        </Routes>
      </div>
      {isAddModalOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-60 flex items-start md:items-center justify-center z-40 p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-lg border border-zinc-200 w-full max-w-2xl relative">
            <button 
              onClick={handleCloseModal}
              className="absolute top-3 right-3 p-2 rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-500 z-10"
              aria-label="Close form"
            >
              <XIcon className="w-6 h-6" />
            </button>
            <div className="p-1">
              <AddCDForm 
                key={cdToEdit ? cdToEdit.id : 'add'}
                onSave={handleSaveCD}
                cdToEdit={cdToEdit}
                onCancel={handleCloseModal}
              />
            </div>
          </div>
        </div>
      )}
      {duplicateInfo && (
        <ConfirmDuplicateModal
            isOpen={!!duplicateInfo}
            onClose={handleCancelDuplicate}
            onConfirm={handleConfirmDuplicate}
            newCdData={duplicateInfo.newCd}
            existingCd={duplicateInfo.existingCd}
        />
      )}
    </HashRouter>
  );
};

export default App;
