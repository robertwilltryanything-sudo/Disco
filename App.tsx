import React, { useState, useCallback, useEffect, useRef } from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { CD, CollectionData, SyncProvider } from './types';
import Header from './components/Header';
import ListView from './views/ListView';
import DetailView from './views/DetailView';
import ArtistsView from './views/ArtistsView';
import DashboardView from './views/DashboardView';
import { getAlbumDetails } from './gemini';
import { useSimpleSync, SyncStatus as SimpleSyncStatus } from './hooks/useSimpleSync';
import { useSupabaseSync, SyncStatus as SupabaseSyncStatus } from './hooks/useSupabaseSync';
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
import SyncConflictModal from './components/SyncConflictModal';
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
    return (storedProvider === 'simple' || storedProvider === 'supabase' || storedProvider === 'none') ? storedProvider : 'none';
  });
  
  const simpleSync = useSimpleSync();
  const supabaseSync = useSupabaseSync(setCds);
  const isInitialLoad = useRef(true);
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [cdToEdit, setCdToEdit] = useState<CD | null>(null);
  const [duplicateInfo, setDuplicateInfo] = useState<{ newCd: Omit<CD, 'id'>, existingCd: CD } | null>(null);
  const [importData, setImportData] = useState<CD[] | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [isErrorBannerVisible, setIsErrorBannerVisible] = useState(true);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [syncConflict, setSyncConflict] = useState<{ local: CollectionData, cloud: CollectionData } | null>(null);

  const activeSyncStatus: SimpleSyncStatus | SupabaseSyncStatus = syncProvider === 'simple' 
    ? simpleSync.syncStatus 
    : syncProvider === 'supabase'
    ? supabaseSync.syncStatus
    : 'idle';
    
  const activeSyncError: string | null = syncProvider === 'simple' 
    ? simpleSync.error 
    : syncProvider === 'supabase'
    ? supabaseSync.error
    : null;
  
  // This function is for local/simple sync providers only.
  const updateCollectionLocal = (updater: (prevCds: CD[]) => CD[], newTimestamp: boolean = true) => {
    setCds(updater);
    if (newTimestamp) {
        setLastUpdated(new Date().toISOString());
    }
  };

  // Initial Data Loading Effect
  useEffect(() => {
    const loadData = async () => {
      let loadedData: CollectionData = { collection: [], lastUpdated: null };

      if (syncProvider === 'simple') {
        const cloudData = await simpleSync.loadCollection();
        if (cloudData) loadedData = cloudData;
      } else if (syncProvider === 'none') {
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
    
    if (syncProvider === 'simple') {
      simpleSync.saveCollection(dataToSave);
    }
  }, [debouncedCds, lastUpdated, syncProvider, simpleSync.saveCollection]);
  
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
        updateCollectionLocal(prevCds => [newCd, ...prevCds]);
    }
  }, [fetchAndApplyAlbumDetails, syncProvider, supabaseSync.addCD]);

  const handleUpdateCD = useCallback(async (updatedCdData: CD) => {
    const enrichedCdData = await fetchAndApplyAlbumDetails(updatedCdData);
    if (syncProvider === 'supabase') {
        await supabaseSync.updateCD(enrichedCdData);
    } else {
        updateCollectionLocal(prevCds => prevCds.map(cd => (cd.id === enrichedCdData.id ? enrichedCdData : cd)));
    }
  }, [fetchAndApplyAlbumDetails, syncProvider, supabaseSync.updateCD]);

  const handleDeleteCD = useCallback((id: string) => {
    if (syncProvider === 'supabase') {
        supabaseSync.deleteCD(id);
    } else {
        updateCollectionLocal(prevCds => prevCds.filter(cd => cd.id !== id));
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
            updateCollectionLocal(prevCds => [...prevCds, ...newCds]);
        }
        setImportData(null);
    }
  };

  const handleReplaceImport = () => {
    if (importData) {
        if (syncProvider === 'supabase') {
            alert("Replace is not supported for Supabase sync. Please clear your collection manually if needed.");
        } else {
            updateCollectionLocal(() => importData);
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

    if (provider === 'simple') {
      const storedDataRaw = localStorage.getItem(COLLECTION_STORAGE_KEY);
      const localData: CollectionData = storedDataRaw ? JSON.parse(storedDataRaw) : { collection: [], lastUpdated: null };
      const cloudData = await simpleSync.loadCollection();

      if (!cloudData) {
        setIsSyncModalOpen(false); return;
      }

      let finalData: CollectionData;
      if (cloudData.collection.length > 0) {
        finalData = cloudData;
      } else if (localData.collection.length > 0) {
        finalData = { ...localData, lastUpdated: new Date().toISOString() };
        await simpleSync.saveCollection(finalData);
      } else {
        finalData = { collection: [], lastUpdated: null };
      }
      
      setCds(finalData.collection);
      setLastUpdated(finalData.lastUpdated);
    }
    
    localStorage.setItem(SYNC_PROVIDER_KEY, provider);
    setSyncProvider(provider);
    setIsSyncModalOpen(false);
  };
  
  const handleManualSync = async () => {
    if (syncProvider !== 'simple') return;

    const cloudData = await simpleSync.loadCollection();
    if (!cloudData) return;

    const localData: CollectionData = { collection: cds, lastUpdated };
    const cloudTimestamp = cloudData.lastUpdated ? new Date(cloudData.lastUpdated).getTime() : 0;
    const localTimestamp = localData.lastUpdated ? new Date(localData.lastUpdated).getTime() : 0;

    if (cloudTimestamp > localTimestamp) {
        setSyncConflict({ local: localData, cloud: cloudData });
    } else {
        const updatedLocalData = { ...localData, lastUpdated: new Date().toISOString() };
        await simpleSync.saveCollection(updatedLocalData);
        setLastUpdated(updatedLocalData.lastUpdated);
    }
  };
  
  const resolveSyncConflict = (useCloudVersion: boolean) => {
    if (!syncConflict) return;
    if (useCloudVersion) {
        setCds(syncConflict.cloud.collection);
        setLastUpdated(syncConflict.cloud.lastUpdated);
    } else {
        const updatedLocalData = { ...syncConflict.local, lastUpdated: new Date().toISOString() };
        simpleSync.saveCollection(updatedLocalData);
        setLastUpdated(updatedLocalData.lastUpdated);
    }
    setSyncConflict(null);
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
          onManualSync={handleManualSync}
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
      <SyncSettingsModal isOpen={isSyncModalOpen} onClose={() => setIsSyncModalOpen(false)} currentProvider={syncProvider} onProviderChange={handleSyncProviderChange} />
      {syncConflict && <SyncConflictModal isOpen={!!syncConflict} onClose={() => setSyncConflict(null)} onResolve={resolveSyncConflict} conflictData={syncConflict} />}
      <input type="file" ref={importInputRef} onChange={handleFileChange} accept=".json" className="hidden" />
    </HashRouter>
  );
};

export default App;
