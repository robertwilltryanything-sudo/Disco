import React, { useState, useCallback, useEffect, useRef } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { CD } from './types';
import Header from './components/Header';
import ListView from './views/ListView';
import DetailView from './views/DetailView';
import ArtistsView from './views/ArtistsView';
import DashboardView from './views/DashboardView';
import { getAlbumDetails } from './gemini';
import { useGoogleDrive } from './hooks/useGoogleDrive';
import { findCoverArt } from './wikipedia';
import AddCDForm from './components/AddCDForm';
import { XIcon } from './components/icons/XIcon';
import ConfirmDuplicateModal from './components/ConfirmDuplicateModal';
import { areStringsSimilar } from './utils';
import { useDebounce } from './hooks/useDebounce';
import ImportConfirmModal from './components/ImportConfirmModal';
import { XCircleIcon } from './components/icons/XCircleIcon';
import BottomNavBar from './components/BottomNavBar';

// Initial data for demonstration purposes. Cover art will be found on first load.
const INITIAL_CDS: CD[] = [
  { id: '2', artist: 'U2', title: 'The Joshua Tree', genre: 'Rock', year: 1987, recordLabel: 'Island', tags: ['80s rock', 'classic rock'] },
  { id: '1', artist: 'U2', title: 'War', genre: 'Post-Punk', year: 1983, recordLabel: 'Island', tags: ['80s rock', 'political', 'post-punk'] },
  { id: '3', artist: 'The Beatles', title: 'Abbey Road', genre: 'Rock', year: 1969, version: '2009 Remaster', recordLabel: 'Apple', tags: ['60s rock', 'classic rock'] },
  { id: '6', artist: 'Fleetwood Mac', title: 'Rumours', genre: 'Rock', year: 1977, recordLabel: 'Warner Bros.', tags: ['70s rock', 'soft rock'] },
  { id: '7', artist: 'Jean Michel Jarre', title: 'Equinoxe', genre: 'Electronic', year: 1978, recordLabel: 'Disques Dreyfus', tags: ['electronic', 'ambient', '70s'] },
];

const COLLECTION_STORAGE_KEY = 'disco_collection_v2';

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
    signIn,
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
  const [importData, setImportData] = useState<CD[] | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [isErrorBannerVisible, setIsErrorBannerVisible] = useState(true);

  // Initial data load effect
  useEffect(() => {
    const initialLoad = async () => {
      if (isSignedIn && !hasLoadedFromDrive.current) {
        try {
          const driveCds = await loadCollection();
          if (driveCds) {
            setCds(driveCds);
            hasLoadedFromDrive.current = true;
            return;
          }
        } catch(e) {
            console.error("Failed to load from Google Drive, falling back to local storage.", e);
        }
      }
      
      try {
        const storedCds = localStorage.getItem(COLLECTION_STORAGE_KEY);
        if (storedCds) {
          setCds(JSON.parse(storedCds));
        } else {
          // On first load, populate artwork for initial data using the reliable findCoverArt function.
          console.log("No local data found. Populating initial album artwork...");
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
  
  // Using a generic type `T` with a `Partial<CD>` constraint preserves the specific type of the
  // `cd` object passed in (`CD` for updates, `Omit<CD, 'id'>` for additions). This resolves
  // type errors at both call sites while ensuring type safety.
  const fetchAndApplyAlbumDetails = useCallback(async <T extends Partial<CD>>(cd: T): Promise<T> => {
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
                // The type of `year` is `number | undefined`, so the check `!enrichedCd.year`
                // is sufficient to see if the year is missing.
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
      // This is an update. Reconstruct the object to be explicitly of type `CD`
      // to satisfy TypeScript's strict checking.
      const cdToUpdate: CD = { ...cdData, id: cdData.id };
      await handleUpdateCD(cdToUpdate);
      handleCloseModal();
    } else {
      // This is a new CD, check for duplicates.
      const duplicate = findPotentialDuplicate(cdData, cds);
      if (duplicate) {
        // Found a duplicate, open confirmation modal.
        // The add/edit modal remains open in the background.
        setDuplicateInfo({ newCd: cdData, existingCd: duplicate });
      } else {
        // No duplicate, proceed with adding and close the modal.
        await handleAddCD(cdData);
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
  
  const handleExportCollection = useCallback(() => {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(cds, null, 2))}`;
    const link = document.createElement("a");
    link.href = jsonString;
    link.download = "disco_collection_backup.json";
    link.click();
  }, [cds]);

  const handleImportClick = () => {
    importInputRef.current?.click();
  };
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const text = e.target?.result;
            if (typeof text !== 'string') throw new Error("File content is not readable.");
            const data = JSON.parse(text);

            // Basic validation
            if (Array.isArray(data) && (data.length === 0 || (data[0].artist && data[0].title))) {
                setImportData(data);
            } else {
                alert("Import failed: The file does not appear to be a valid collection.");
            }
        } catch (error) {
            console.error("Error parsing import file:", error);
            alert("Import failed: Could not parse the JSON file.");
        }
    };
    reader.readAsText(file);
    // Reset file input value to allow re-importing the same file
    event.target.value = '';
  };

  const handleMergeImport = () => {
    if (importData) {
        // Generate new IDs for imported CDs to avoid conflicts.
        const newCds = importData.map(cd => ({
            ...cd,
            id: `${new Date().getTime()}-${Math.random()}`
        }));
        setCds(prevCds => [...prevCds, ...newCds]);
        setImportData(null);
    }
  };

  const handleReplaceImport = () => {
    if (importData) {
        setCds(importData);
        setImportData(null);
    }
  };

  const handleDismissError = () => {
    setIsErrorBannerVisible(false);
  };

  // Show the banner again if a new error occurs
  useEffect(() => {
    if (driveError) {
      setIsErrorBannerVisible(true);
    }
  }, [driveError]);

  const RouteWrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
    <main className="container mx-auto p-4 md:p-6 pb-24 md:pb-6">{children}</main>
  );

  return (
    <HashRouter>
      <div className="flex flex-col min-h-screen">
        {driveError && isErrorBannerVisible && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 w-full sticky top-0 z-30" role="alert">
            <div className="flex items-start">
              <div className="py-1">
                <XCircleIcon className="h-6 w-6 text-red-500 mr-4 flex-shrink-0" />
              </div>
              <div className="flex-grow">
                <p className="font-bold">Sync Error</p>
                <p className="text-sm">{driveError}</p>
              </div>
              <button
                onClick={handleDismissError}
                className="ml-auto p-2 rounded-full text-red-500 hover:bg-red-200 flex-shrink-0"
                aria-label="Dismiss error message"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
        <Header 
          isApiReady={isApiReady}
          isSignedIn={isSignedIn}
          signIn={signIn}
          signOut={signOut}
          syncStatus={syncStatus}
          driveError={driveError}
          onAddClick={handleRequestAdd}
          collectionCount={cds.length}
          onImport={handleImportClick}
          onExport={handleExportCollection}
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
          <Route path="/dashboard" element={
            <RouteWrapper>
              <DashboardView cds={cds} />
            </RouteWrapper>
          } />
        </Routes>
        <BottomNavBar onAddClick={handleRequestAdd} />
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
       <ImportConfirmModal
            isOpen={!!importData}
            importCount={importData?.length || 0}
            onClose={() => setImportData(null)}
            onMerge={handleMergeImport}
            onReplace={handleReplaceImport}
        />
        <input
            type="file"
            ref={importInputRef}
            onChange={handleFileChange}
            accept=".json"
            className="hidden"
        />
    </HashRouter>
  );
};

export default App;