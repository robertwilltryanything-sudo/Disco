import React, { useState, useCallback, useEffect, useRef } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { CD } from './types';
import Header from './components/Header';
import ListView from './views/ListView';
import DetailView from './views/DetailView';
import ArtistsView from './views/ArtistsView';
import DashboardView from './views/DashboardView';
import { getAlbumDetails } from './gemini';
import { useSimpleSync, SyncStatus as SimpleSyncStatus } from './hooks/useSimpleSync';
import { findCoverArt } from './wikipedia';
import AddCDForm from './components/AddCDForm';
import { XIcon } from './components/icons/XIcon';
import ConfirmDuplicateModal from './components/ConfirmDuplicateModal';
import { areStringsSimilar } from './utils';
import { useDebounce } from './hooks/useDebounce';
import ImportConfirmModal from './components/ImportConfirmModal';
import { XCircleIcon } from './components/icons/XCircleIcon';
import BottomNavBar from './components/BottomNavBar';
import SyncSettingsModal from './components/SyncSettingsModal';

// Initial data for demonstration purposes. Cover art will be found on first load.
const INITIAL_CDS: CD[] = [
  { id: '2', artist: 'U2', title: 'The Joshua Tree', genre: 'Rock', year: 1987, recordLabel: 'Island', tags: ['80s rock', 'classic rock'] },
  { id: '1', artist: 'U2', title: 'War', genre: 'Post-Punk', year: 1983, recordLabel: 'Island', tags: ['80s rock', 'political', 'post-punk'] },
  { id: '3', artist: 'The Beatles', title: 'Abbey Road', genre: 'Rock', year: 1969, version: '2009 Remaster', recordLabel: 'Apple', tags: ['60s rock', 'classic rock'] },
  { id: '6', artist: 'Fleetwood Mac', title: 'Rumours', genre: 'Rock', year: 1977, recordLabel: 'Warner Bros.', tags: ['70s rock', 'soft rock'] },
  { id: '7', artist: 'Jean Michel Jarre', title: 'Equinoxe', genre: 'Electronic', year: 1978, recordLabel: 'Disques Dreyfus', tags: ['electronic', 'ambient', '70s'] },
];

const COLLECTION_STORAGE_KEY = 'disco_collection_v2';
const SYNC_PROVIDER_KEY = 'disco_sync_provider';

export type SyncProvider = 'simple' | 'none';

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

  const [syncProvider, setSyncProvider] = useState<SyncProvider>(() => {
    const storedProvider = localStorage.getItem(SYNC_PROVIDER_KEY);
    if (storedProvider === 'simple' || storedProvider === 'none') {
        return storedProvider;
    }
    // Default to 'none' if the stored value is invalid (e.g., the old 'google' value)
    return 'none';
  });
  
  const simpleSync = useSimpleSync();

  const isInitialLoad = useRef(true);
  const hasLoadedFromCloud = useRef(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [cdToEdit, setCdToEdit] = useState<CD | null>(null);
  const [duplicateInfo, setDuplicateInfo] = useState<{ newCd: Omit<CD, 'id'>, existingCd: CD } | null>(null);
  const [importData, setImportData] = useState<CD[] | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [isErrorBannerVisible, setIsErrorBannerVisible] = useState(true);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  const activeSyncStatus: SimpleSyncStatus = syncProvider === 'simple' ? simpleSync.syncStatus : 'idle';
  const activeSyncError: string | null = syncProvider === 'simple' ? simpleSync.error : null;

  // Initial data load effect
  useEffect(() => {
    const initialLoad = async () => {
      if (syncProvider === 'simple') {
        // When sync is enabled, the cloud is the single source of truth.
        // We do NOT fall back to localStorage on failure, as this can cause
        // fresh cloud data to be overwritten by stale local data.
        if (!hasLoadedFromCloud.current) {
            try {
                const simpleCds = await simpleSync.loadCollection();
                // A null response from loadCollection indicates an error occurred.
                if (simpleCds !== null) { 
                    setCds(simpleCds);
                    hasLoadedFromCloud.current = true;
                }
                // If simpleCds is null, the sync hook has set an error state,
                // which will be displayed in the UI. The app will show an empty
                // collection until the sync issue is resolved.
            } catch (e) {
                console.error("Unhandled error during Simple Sync load:", e);
            }
        }
      } else {
        // Sync provider is 'none', so use localStorage as the source of truth.
        try {
          const storedCds = localStorage.getItem(COLLECTION_STORAGE_KEY);
          if (storedCds) {
            setCds(JSON.parse(storedCds));
          } else {
            console.log("No local data found. Populating initial album artwork...");
            const cdsWithArt = await populateInitialArtwork(INITIAL_CDS);
            setCds(cdsWithArt);
          }
        } catch (error) {
          console.error("Error loading CDs from localStorage:", error);
          const cdsWithArt = await populateInitialArtwork(INITIAL_CDS);
          setCds(cdsWithArt);
        }
      }
    };

    initialLoad();
  }, [simpleSync.loadCollection, syncProvider]);

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
    
    if (syncProvider === 'simple') {
      simpleSync.saveCollection(debouncedCds);
    }
  }, [debouncedCds, syncProvider, simpleSync.saveCollection]);
  
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
            return cd;
        }
    }
    return cd;
  }, []);

  const handleAddCD = useCallback(async (cdData: Omit<CD, 'id'>) => {
    const enrichedCdData = await fetchAndApplyAlbumDetails(cdData);
    const newCd: CD = {
      ...enrichedCdData,
      id: `${new Date().getTime()}-${Math.random()}`,
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
      const cdToUpdate: CD = { ...cdData, id: cdData.id };
      await handleUpdateCD(cdToUpdate);
      handleCloseModal();
    } else {
      const duplicate = findPotentialDuplicate(cdData, cds);
      if (duplicate) {
        setDuplicateInfo({ newCd: cdData, existingCd: duplicate });
      } else {
        await handleAddCD(cdData);
        handleCloseModal();
      }
    }
  }, [handleUpdateCD, handleAddCD, handleCloseModal, cds]);
  
  const handleConfirmDuplicate = useCallback(async (version: string) => {
    if (duplicateInfo) {
      const cdWithVersion = { ...duplicateInfo.newCd, version };
      await handleAddCD(cdWithVersion);
      setDuplicateInfo(null);
      handleCloseModal();
    }
  }, [duplicateInfo, handleAddCD, handleCloseModal]);

  const handleCancelDuplicate = useCallback(() => {
    setDuplicateInfo(null);
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
    event.target.value = '';
  };

  const handleMergeImport = () => {
    if (importData) {
        const newCds = importData.map(cd => ({ ...cd, id: `${new Date().getTime()}-${Math.random()}` }));
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

  useEffect(() => {
    if (activeSyncError) {
      setIsErrorBannerVisible(true);
    }
  }, [activeSyncError]);

  const handleSyncProviderChange = (provider: SyncProvider) => {
    localStorage.setItem(SYNC_PROVIDER_KEY, provider);
    setSyncProvider(provider);
    if (provider === 'simple') {
      // When switching to simple sync, trigger a load from the cloud.
      hasLoadedFromCloud.current = false;
      simpleSync.loadCollection().then(cloudCds => {
          if (cloudCds) {
              setCds(cloudCds);
              hasLoadedFromCloud.current = true;
          }
      });
    }
  };

  const RouteWrapper: React.FC<React.PropsWithChildren> = ({ children }) => (
    <main className="container mx-auto p-4 md:p-6 pb-24 md:pb-6">{children}</main>
  );

  return (
    <HashRouter>
      <div className="flex flex-col min-h-screen">
        {activeSyncError && isErrorBannerVisible && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 w-full sticky top-0 z-30" role="alert">
            <div className="flex items-start">
              <div className="py-1">
                <XCircleIcon className="h-6 w-6 text-red-500 mr-4 flex-shrink-0" />
              </div>
              <div className="flex-grow">
                <p className="font-bold">Sync Error</p>
                <p className="text-sm">{activeSyncError}</p>
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
          onAddClick={handleRequestAdd}
          collectionCount={cds.length}
          onImport={handleImportClick}
          onExport={handleExportCollection}
          onOpenSyncSettings={() => setIsSyncModalOpen(true)}
          syncStatus={activeSyncStatus}
          syncError={activeSyncError}
          syncProvider={syncProvider}
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
       <SyncSettingsModal
          isOpen={isSyncModalOpen}
          onClose={() => setIsSyncModalOpen(false)}
          currentProvider={syncProvider}
          onProviderChange={handleSyncProviderChange}
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