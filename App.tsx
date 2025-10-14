import React, { useState, useCallback, useEffect, useRef } from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { CD, CollectionData, SyncProvider, SyncStatus, SyncMode } from './types';
import Header from './components/Header';
import ListView from './views/ListView';
import DetailView from './views/DetailView';
import ArtistsView from './views/ArtistsView';
import DashboardView from './views/DashboardView';
import { getAlbumDetails } from './gemini';
import { useSupabaseSync } from './hooks/useSupabaseSync';
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
import SupabaseNotConfigured from './components/SupabaseNotConfigured';
import SupabaseAuth from './components/SupabaseAuth';

const INITIAL_CDS: CD[] = [
  { id: '2', artist: 'U2', title: 'The Joshua Tree', genre: 'Rock', year: 1987, recordLabel: 'Island', tags: ['80s rock', 'classic rock'] },
  { id: '1', artist: 'U2', title: 'War', genre: 'Post-Punk', year: 1983, recordLabel: 'Island', tags: ['80s rock', 'political', 'post-punk'] },
  { id: '3', artist: 'The Beatles', title: 'Abbey Road', genre: 'Rock', year: 1969, version: '2009 Remaster', recordLabel: 'Apple', tags: ['60s rock', 'classic rock'] },
  { id: '6', artist: 'Fleetwood Mac', title: 'Rumours', genre: 'Rock', year: 1977, recordLabel: 'Warner Bros.', tags: ['70s rock', 'soft rock'] },
  { id: '7', artist: 'Jean Michel Jarre', title: 'Equinoxe', genre: 'Electronic', year: 1978, recordLabel: 'Disques Dreyfus', tags: ['electronic', 'ambient', '70s'] },
];

const COLLECTION_STORAGE_KEY = 'disco_collection_v3';
const SYNC_PROVIDER_KEY = 'disco_sync_provider';
const SYNC_MODE_KEY = 'disco_sync_mode';

const isSupabaseConfigured = !!process.env.VITE_SUPABASE_URL && !!process.env.VITE_SUPABASE_ANON_KEY;

const populateInitialArtwork = async (initialCds: CD[]): Promise<CD[]> => {
  const cdsWithArtPromises = initialCds.map(async (cd) => {
    if (!cd.coverArtUrl) {
      try {
        const imageUrls = await findCoverArt(cd.artist, cd.title);
        if (imageUrls && imageUrls.length > 0) {
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

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

const findPotentialDuplicate = (newCd: Omit<CD, 'id'>, collection: CD[]): CD | null => {
    for (const existingCd of collection) {
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
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const debouncedCds = useDebounce(cds, 1000);

  const [syncProvider, setSyncProvider] = useState<SyncProvider>(() => {
    const storedProvider = localStorage.getItem(SYNC_PROVIDER_KEY);
    // If supabase is stored as the provider but the app is not configured for it, default to 'none'.
    if (storedProvider === 'supabase' && !isSupabaseConfigured) {
      return 'none';
    }
    return (storedProvider === 'supabase' || storedProvider === 'none') ? storedProvider : 'none';
  });

  const [syncMode, setSyncMode] = useState<SyncMode>(() => {
    const storedMode = localStorage.getItem(SYNC_MODE_KEY);
    return (storedMode === 'realtime' || storedMode === 'manual') ? storedMode : 'realtime';
  });
  
  const supabaseSync = useSupabaseSync(setCds, syncMode);
  const isInitialLoad = useRef(true);
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [cdToEdit, setCdToEdit] = useState<CD | null>(null);
  const [duplicateInfo, setDuplicateInfo] = useState<{ newCd: Omit<CD, 'id'>, existingCd: CD } | null>(null);
  const [importData, setImportData] = useState<CD[] | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [isErrorBannerVisible, setIsErrorBannerVisible] = useState(true);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  const activeSyncStatus: SyncStatus = syncProvider === 'supabase'
    ? supabaseSync.syncStatus
    : 'idle';
    
  const activeSyncError: string | null = syncProvider === 'supabase'
    ? supabaseSync.error
    : null;
  
  // This function is for the local-only provider.
  const updateLocalCollection = (updater: (prevCds: CD[]) => CD[], newTimestamp: boolean = true) => {
    setCds(updater);
    if (newTimestamp) {
        setLastUpdated(new Date().toISOString());
    }
  };

  // Initial Data Loading Effect
  useEffect(() => {
    const loadData = async () => {
      let loadedData: CollectionData = { collection: [], lastUpdated: null };

      if (syncProvider === 'none') {
        try {
          const storedDataRaw = localStorage.getItem(COLLECTION_STORAGE_KEY);
          if (storedDataRaw) {
            loadedData = JSON.parse(storedDataRaw);
          } else {
            const cdsWithArt = await populateInitialArtwork(INITIAL_CDS);
            loadedData = { collection: cdsWithArt, lastUpdated: new Date().toISOString() };
          }
        } catch (error) {
          console.error("Error loading data from localStorage:", error);
          const cdsWithArt = await populateInitialArtwork(INITIAL_CDS);
          loadedData = { collection: cdsWithArt, lastUpdated: new Date().toISOString() };
        }
      }
      // Supabase loading is handled by its own hook via real-time subscription
      if (syncProvider !== 'supabase') {
        setCds(loadedData.collection);
        setLastUpdated(loadedData.lastUpdated);
      }
    };
    loadData();
  }, [syncProvider]);

  // Data Saving Effect for non-Supabase providers
  useEffect(() => {
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }
    
    // Supabase handles its own saving via direct function calls
    if (syncProvider === 'supabase') return;

    const dataToSave: CollectionData = { collection: debouncedCds, lastUpdated };
    try {
      localStorage.setItem(COLLECTION_STORAGE_KEY, JSON.stringify(dataToSave));
    } catch (error) {
      console.error("Error saving data to localStorage:", error);
    }
  }, [debouncedCds, lastUpdated, syncProvider]);
  
  const fetchAndApplyAlbumDetails = useCallback(async <T extends Partial<CD>>(cd: T): Promise<T> => {
    const shouldFetch = !cd.genre || !cd.recordLabel || !cd.tags || cd.tags.length === 0;
    if (shouldFetch && cd.artist && cd.title) {
        try {
            const details = await getAlbumDetails(cd.artist, cd.title);
            if (details) {
                return { 
                    ...cd, 
                    genre: cd.genre || details.genre,
                    recordLabel: cd.recordLabel || details.recordLabel,
                    year: cd.year || details.year,
                    tags: [...new Set([...(cd.tags || []), ...(details.tags || [])])]
                };
            }
        } catch (error) {
            console.error("Could not fetch additional album details from Gemini:", error);
        }
    }
    return cd;
  }, []);

  const handleAddCD = useCallback(async (cdData: Omit<CD, 'id'>) => {
    const enrichedCdData = await fetchAndApplyAlbumDetails(cdData);
    if (syncProvider === 'supabase') {
        await supabaseSync.addCD(enrichedCdData);
    } else {
        const newCd: CD = { ...enrichedCdData, id: `${new Date().getTime()}-${Math.random()}` };
        updateLocalCollection(prevCds => [newCd, ...prevCds]);
    }
  }, [fetchAndApplyAlbumDetails, syncProvider, supabaseSync.addCD]);

  const handleUpdateCD = useCallback(async (updatedCdData: CD) => {
    const enrichedCdData = await fetchAndApplyAlbumDetails(updatedCdData);
    if (syncProvider === 'supabase') {
        await supabaseSync.updateCD(enrichedCdData);
    } else {
        updateLocalCollection(prevCds => prevCds.map(cd => (cd.id === enrichedCdData.id ? enrichedCdData : cd)));
    }
  }, [fetchAndApplyAlbumDetails, syncProvider, supabaseSync.updateCD]);

  const handleDeleteCD = useCallback((id: string) => {
    if (syncProvider === 'supabase') {
        supabaseSync.deleteCD(id);
    } else {
        updateLocalCollection(prevCds => prevCds.filter(cd => cd.id !== id));
    }
  }, [syncProvider, supabaseSync.deleteCD]);

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
      await handleUpdateCD({ ...cdData, id: cdData.id });
    } else {
      const duplicate = findPotentialDuplicate(cdData, cds);
      if (duplicate) {
        setDuplicateInfo({ newCd: cdData, existingCd: duplicate });
      } else {
        await handleAddCD(cdData);
      }
    }
    handleCloseModal();
  }, [handleUpdateCD, handleAddCD, handleCloseModal, cds]);
  
  const handleConfirmDuplicate = useCallback(async (version: string) => {
    if (duplicateInfo) {
      await handleAddCD({ ...duplicateInfo.newCd, version });
      setDuplicateInfo(null);
      handleCloseModal();
    }
  }, [duplicateInfo, handleAddCD, handleCloseModal]);

  const handleCancelDuplicate = useCallback(() => setDuplicateInfo(null), []);
  
  const handleExportCollection = useCallback(() => {
    const dataToExport: CollectionData = { collection: cds, lastUpdated };
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(dataToExport, null, 2))}`;
    const link = document.createElement("a");
    link.href = jsonString;
    link.download = "disco_collection_backup.json";
    link.click();
  }, [cds, lastUpdated]);

  const handleImportClick = () => importInputRef.current?.click();
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const text = e.target?.result as string;
            const data = JSON.parse(text);
            const collectionToImport = Array.isArray(data) ? data : data?.collection;
            if (Array.isArray(collectionToImport)) {
                setImportData(collectionToImport);
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
        if (syncProvider === 'supabase') {
            importData.forEach(cd => supabaseSync.addCD(cd));
        } else {
            const newCds = importData.map(cd => ({ ...cd, id: `${new Date().getTime()}-${Math.random()}` }));
            updateLocalCollection(prevCds => [...prevCds, ...newCds]);
        }
        setImportData(null);
    }
  };

  const handleReplaceImport = () => {
    if (importData) {
        if (syncProvider === 'supabase') {
            alert("Replace is not supported for Supabase sync. Please clear your collection manually if needed.");
        } else {
            updateLocalCollection(() => importData);
        }
        setImportData(null);
    }
  };

  const handleDismissError = () => setIsErrorBannerVisible(false);

  useEffect(() => {
    if (activeSyncError) setIsErrorBannerVisible(true);
  }, [activeSyncError]);

  const handleSyncProviderChange = async (provider: SyncProvider) => {
    if (provider === syncProvider) {
      setIsSyncModalOpen(false);
      return;
    }
    
    localStorage.setItem(SYNC_PROVIDER_KEY, provider);
    setSyncProvider(provider);
    setIsSyncModalOpen(false);
  };

  const handleSyncModeChange = (mode: SyncMode) => {
    localStorage.setItem(SYNC_MODE_KEY, mode);
    setSyncMode(mode);
  };

  const RouteWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    if (syncProvider === 'supabase') {
        if (!supabaseSync.isConfigured) {
             return (
                <main className="container mx-auto p-4 md:p-6 pb-24 md:pb-6">
                    <SupabaseNotConfigured onOpenSyncSettings={() => setIsSyncModalOpen(true)} />
                </main>
             );
        }
        
        if (!supabaseSync.session) {
            return (
                <main className="container mx-auto p-4 md:p-6 flex-grow flex items-center justify-center">
                    <SupabaseAuth 
                        user={supabaseSync.user} 
                        signIn={supabaseSync.signIn}
                        syncStatus={supabaseSync.syncStatus}
                        error={supabaseSync.error}
                        onOpenSyncSettings={() => setIsSyncModalOpen(true)}
                    />
                </main>
            );
        }
    }
    return <main className="container mx-auto p-4 md:p-6 pb-24 md:pb-6">{children}</main>;
  };

  return (
    <HashRouter>
      <ScrollToTop />
      <div className="flex flex-col min-h-screen">
        {activeSyncError && isErrorBannerVisible && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 w-full sticky top-0 z-30" role="alert">
            <div className="flex items-start">
              <div className="py-1"><XCircleIcon className="h-6 w-6 text-red-500 mr-4 flex-shrink-0" /></div>
              <div className="flex-grow">
                <p className="font-bold">Sync Error</p>
                <p className="text-sm">{activeSyncError}</p>
              </div>
              <button onClick={handleDismissError} className="ml-auto p-2 rounded-full text-red-500 hover:bg-red-200 flex-shrink-0" aria-label="Dismiss"><XIcon className="h-5 w-5" /></button>
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
          syncMode={syncMode}
          onManualSync={supabaseSync.manualSync}
          user={supabaseSync.user}
          onSignOut={supabaseSync.signOut}
        />
        <Routes>
          <Route path="/" element={<RouteWrapper><ListView cds={cds} onDeleteCD={handleDeleteCD} onRequestAdd={handleRequestAdd} onRequestEdit={handleRequestEdit} /></RouteWrapper>} />
          <Route path="/cd/:id" element={<RouteWrapper><DetailView cds={cds} /></RouteWrapper>} />
          <Route path="/artists" element={<RouteWrapper><ArtistsView cds={cds} /></RouteWrapper>} />
          <Route path="/dashboard" element={<RouteWrapper><DashboardView cds={cds} /></RouteWrapper>} />
        </Routes>
        <BottomNavBar onAddClick={handleRequestAdd} />
      </div>
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-start md:items-center justify-center z-40 p-4 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="bg-white rounded-lg border border-zinc-200 w-full max-w-2xl relative">
            <button onClick={handleCloseModal} className="absolute top-3 right-3 p-2 rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-500 z-10" aria-label="Close form"><XIcon className="w-6 h-6" /></button>
            <div className="p-1"><AddCDForm key={cdToEdit ? cdToEdit.id : 'add'} onSave={handleSaveCD} cdToEdit={cdToEdit} onCancel={handleCloseModal} /></div>
          </div>
        </div>
      )}
      {duplicateInfo && <ConfirmDuplicateModal isOpen={!!duplicateInfo} onClose={handleCancelDuplicate} onConfirm={handleConfirmDuplicate} newCdData={duplicateInfo.newCd} existingCd={duplicateInfo.existingCd} />}
      <ImportConfirmModal isOpen={!!importData} importCount={importData?.length || 0} onClose={() => setImportData(null)} onMerge={handleMergeImport} onReplace={handleReplaceImport} />
      <SyncSettingsModal 
        isOpen={isSyncModalOpen} 
        onClose={() => setIsSyncModalOpen(false)} 
        currentProvider={syncProvider} 
        onProviderChange={handleSyncProviderChange}
        syncMode={syncMode}
        onSyncModeChange={handleSyncModeChange}
      />
      <input type="file" ref={importInputRef} onChange={handleFileChange} accept=".json" className="hidden" />
    </HashRouter>
  );
};

export default App;