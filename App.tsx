
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { HashRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { CD, SyncProvider, SyncStatus, SyncMode, WantlistItem, CollectionMode } from './types';
import Header from './components/Header';
import ListView from './views/ListView';
import DetailView from './views/DetailView';
import ArtistsView from './views/ArtistsView';
import DashboardView from './views/DashboardView';
import { getAlbumDetails } from './gemini';
import AddCDForm from './components/AddCDForm';
import ConfirmDuplicateModal from './components/ConfirmDuplicateModal';
import { areStringsSimilar } from './utils';
import BottomNavBar from './components/BottomNavBar';
import SyncSettingsModal from './components/SyncSettingsModal';
import DuplicatesView from './views/DuplicatesView';
import WantlistView from './views/WantlistView';
import { PlusIcon } from './components/icons/PlusIcon';
import AddWantlistItemForm from './components/AddWantlistItemForm';
import WantlistDetailView from './views/WantlistDetailView';
import ArtistDetailView from './views/ArtistDetailView';
import { useGoogleDrive } from './hooks/useGoogleDrive';
import ScrollToTop from './components/ScrollToTop';
import ImportConfirmModal from './components/ImportConfirmModal';
import { SpinnerIcon } from './components/icons/SpinnerIcon';

const normalizeData = <T extends CD | WantlistItem>(item: any): T => {
    if (!item) return item;
    const normalized = { ...item };
    if (item.coverArtUrl && !item.cover_art_url) normalized.cover_art_url = item.coverArtUrl;
    if (item.recordLabel && !item.record_label) normalized.record_label = item.recordLabel;
    delete normalized.coverArtUrl;
    delete normalized.recordLabel;
    return normalized as T;
};

const generateId = () => {
    try {
        return crypto.randomUUID();
    } catch (e) {
        return Math.random().toString(36).substring(2) + Date.now().toString(36);
    }
};

const INITIAL_COLLECTION: CD[] = [
  {
    id: '1',
    artist: 'Pink Floyd',
    title: 'The Dark Side of the Moon',
    genre: 'Progressive Rock',
    year: 1973,
    cover_art_url: 'https://upload.wikimedia.org/wikipedia/en/3/3b/Dark_Side_of_the_Moon.png',
    notes: 'Classic.',
    created_at: new Date(Date.now() - 10000).toISOString(),
    format: 'cd'
  }
];

const AppContent: React.FC = () => {
  const navigate = useNavigate();
  const [collectionMode, setCollectionMode] = useState<CollectionMode>(() => {
    return (localStorage.getItem('disco_mode') as CollectionMode) || 'cd';
  });

  const [collection, setCollection] = useState<CD[]>(() => {
    const saved = localStorage.getItem('disco_collection');
    const data = saved ? JSON.parse(saved) : INITIAL_COLLECTION;
    return Array.isArray(data) ? data.map(normalizeData<CD>) : [];
  });

  const [wantlist, setWantlist] = useState<WantlistItem[]>(() => {
      const saved = localStorage.getItem('disco_wantlist');
      const data = saved ? JSON.parse(saved) : [];
      return Array.isArray(data) ? data.map(normalizeData<WantlistItem>) : [];
  });

  const [hasAttemptedInitialLoad, setHasAttemptedInitialLoad] = useState(false);

  const currentCollection = useMemo(() => 
    collection.filter(item => (item.format || 'cd') === collectionMode), 
  [collection, collectionMode]);

  const currentWantlist = useMemo(() => 
    wantlist.filter(item => (item.format || 'cd') === collectionMode), 
  [wantlist, collectionMode]);
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [cdToEdit, setCdToEdit] = useState<CD | null>(null);
  const [prefillData, setPrefillData] = useState<Partial<CD> | null>(null);
  const [isAddWantlistModalOpen, setIsAddWantlistModalOpen] = useState(false);
  const [wantlistItemToEdit, setWantlistItemToEdit] = useState<WantlistItem | null>(null);
  const [duplicateCheckResult, setDuplicateCheckResult] = useState<{ newCd: Omit<CD, 'id'>, existingCd: CD } | null>(null);
  const [pendingImport, setPendingImport] = useState<CD[] | null>(null);
  const [isSyncSettingsOpen, setIsSyncSettingsOpen] = useState(false);

  const [syncProvider, setSyncProvider] = useState<SyncProvider>(() => {
      const saved = localStorage.getItem('disco_sync_provider');
      return (saved === 'google_drive' ? 'google_drive' : 'none');
  });

  const [syncMode, setSyncMode] = useState<SyncMode>(() => {
       return (localStorage.getItem('disco_sync_mode') as SyncMode) || 'realtime';
  });

  const { 
    isSignedIn: driveSignedIn, 
    signIn: driveSignIn, 
    signOut: driveSignOut, 
    loadData: driveLoadData, 
    saveData: driveSaveData, 
    checkRemoteUpdate: driveCheckUpdate,
    syncStatus: driveStatus,
    error: driveError,
    lastSyncHash: driveLastSyncHash,
    isApiReady: driveReady,
    resetSyncStatus: driveResetStatus
  } = useGoogleDrive();

  const handlePullLatest = useCallback(async () => {
    const data = await driveLoadData();
    if (data) {
        setCollection(data.collection || []);
        setWantlist(data.wantlist || []);
    }
    setHasAttemptedInitialLoad(true);
  }, [driveLoadData]);

  // Initial load when signing in
  useEffect(() => {
      if (syncProvider === 'google_drive' && driveSignedIn && !hasAttemptedInitialLoad && driveStatus !== 'loading') {
          handlePullLatest();
      }
  }, [syncProvider, driveSignedIn, handlePullLatest, hasAttemptedInitialLoad, driveStatus]);

  // Robust background & visibility sync
  useEffect(() => {
    const checkSync = async () => {
        if (syncProvider === 'google_drive' && driveSignedIn && driveStatus !== 'loading' && driveStatus !== 'saving' && hasAttemptedInitialLoad) {
            const hasUpdate = await driveCheckUpdate();
            if (hasUpdate) {
                const currentLocalHash = JSON.stringify({ collection, wantlist });
                // If local matches cloud's last known state, pull silently
                const noLocalChanges = currentLocalHash === driveLastSyncHash;

                if (noLocalChanges) {
                    handlePullLatest();
                } else {
                    if (window.confirm("Cloud updates detected! Would you like to refresh your collection? Unsaved local changes will be lost.")) {
                        handlePullLatest();
                    }
                }
            }
        }
    };

    const handleVisibility = () => {
        if (document.visibilityState === 'visible') {
            checkSync();
        }
    };

    // Polling interval for users who keep the app open (e.g. tablet on a shelf)
    const interval = setInterval(checkSync, 30000); 

    window.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', checkSync);
    return () => {
        clearInterval(interval);
        window.removeEventListener('visibilitychange', handleVisibility);
        window.removeEventListener('focus', checkSync);
    };
  }, [syncProvider, driveSignedIn, driveCheckUpdate, handlePullLatest, collection, wantlist, driveLastSyncHash, driveStatus, hasAttemptedInitialLoad]);

  // Auto-Save Effect with strict Safety Gate
  useEffect(() => {
      if (syncProvider === 'google_drive' && driveSignedIn && syncMode === 'realtime' && hasAttemptedInitialLoad && driveStatus === 'synced') {
          const timeout = setTimeout(() => {
              driveSaveData({
                  collection,
                  wantlist,
                  lastUpdated: new Date().toISOString()
              });
          }, 4000); 
          return () => clearTimeout(timeout);
      }
  }, [collection, wantlist, syncProvider, driveSignedIn, syncMode, driveSaveData, hasAttemptedInitialLoad, driveStatus]);

  const handleToggleMode = useCallback(() => {
    setCollectionMode(prev => prev === 'cd' ? 'vinyl' : 'cd');
  }, []);

  useEffect(() => { localStorage.setItem('disco_mode', collectionMode); }, [collectionMode]);
  
  // Only persist collection to local storage if we have successfully engaged with the sync provider OR we aren't using one
  useEffect(() => {
    if (syncProvider === 'none' || hasAttemptedInitialLoad) {
        localStorage.setItem('disco_collection', JSON.stringify(collection));
        localStorage.setItem('disco_wantlist', JSON.stringify(wantlist));
    }
  }, [collection, wantlist, syncProvider, hasAttemptedInitialLoad]);

  useEffect(() => { localStorage.setItem('disco_sync_provider', syncProvider); }, [syncProvider]);
  useEffect(() => { localStorage.setItem('disco_sync_mode', syncMode); }, [syncMode]);

  const currentSyncStatus: SyncStatus = syncProvider === 'google_drive' ? driveStatus : 'idle';
  const currentSyncError: string | null = syncProvider === 'google_drive' ? driveError : null;

  const handleManualSync = useCallback(async () => {
    if (syncProvider === 'google_drive') {
        // Force pull instead of conditional check
        await handlePullLatest();
    }
  }, [syncProvider, handlePullLatest]);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const content = event.target?.result as string;
            const importedData = JSON.parse(content);
            const rawItems = Array.isArray(importedData) ? importedData : (importedData.collection || []);
            setPendingImport(rawItems.map(normalizeData<CD>));
          } catch (error) { alert("Failed to parse file."); }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  }, []);

  const confirmImport = useCallback((strategy: 'merge' | 'replace') => {
      if (!pendingImport) return;
      if (strategy === 'replace') {
          setCollection(pendingImport);
      } else {
          const existingIds = new Set(collection.map(c => c.id));
          const newItems = pendingImport.filter(c => !existingIds.has(c.id));
          setCollection([...collection, ...newItems]);
      }
      setPendingImport(null);
  }, [pendingImport, collection]);

  const handleExport = useCallback(() => {
    const dataStr = JSON.stringify({ collection, wantlist, lastUpdated: new Date().toISOString() }, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `disco_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [collection, wantlist]);

  const fetchAndApplyAlbumDetails = async (cd: CD) => {
    if (!cd.genre || !cd.year) {
        try {
            const details = await getAlbumDetails(cd.artist, cd.title);
            if (details) {
                const normalizedDetails = normalizeData<CD>(details);
                const updatedCd: CD = {
                    ...cd,
                    genre: cd.genre || normalizedDetails.genre,
                    year: cd.year || normalizedDetails.year,
                    record_label: cd.record_label || normalizedDetails.record_label,
                    tags: [...new Set([...(cd.tags || []), ...(normalizedDetails.tags || [])])],
                };
                setCollection(prev => prev.map(c => c.id === cd.id ? updatedCd : c));
            }
        } catch (e) { console.error("Detail fetch error:", e); }
    }
  };

  const handleSaveCD = useCallback(async (cdData: Omit<CD, 'id'> & { id?: string }) => {
    if (!cdData.id && !duplicateCheckResult) {
        const potentialDuplicate = currentCollection.find(c => 
            areStringsSimilar(c.artist, cdData.artist) && 
            areStringsSimilar(c.title, cdData.title)
        );
        if (potentialDuplicate) {
            setDuplicateCheckResult({ newCd: cdData, existingCd: potentialDuplicate });
            return;
        }
    }

    const tempId = cdData.id || generateId();
    let finalCd: CD = { 
        ...cdData, 
        id: tempId, 
        created_at: cdData.created_at || new Date().toISOString(),
        format: cdData.format || collectionMode 
    } as CD;

    if (cdData.id) {
        setCollection(prev => prev.map(c => c.id === cdData.id ? finalCd : c));
    } else {
        setCollection(prev => [finalCd, ...prev]);
    }

    setIsAddModalOpen(false);
    setCdToEdit(null);
    setPrefillData(null);
    setDuplicateCheckResult(null);
    fetchAndApplyAlbumDetails(finalCd);
    if (cdData.id) navigate(`/cd/${finalCd.id}`);
  }, [collectionMode, duplicateCheckResult, navigate, currentCollection]);

  const handleDeleteCD = useCallback(async (id: string) => { setCollection(prev => prev.filter(cd => cd.id !== id)); }, []);
  
  const handleSaveWantlistItem = useCallback(async (itemData: Omit<WantlistItem, 'id'> & { id?: string }) => {
      const tempId = itemData.id || generateId();
      let finalItem: WantlistItem = { 
          ...itemData, 
          id: tempId, 
          created_at: itemData.created_at || new Date().toISOString(),
          format: itemData.format || collectionMode 
      } as WantlistItem;

      if (itemData.id) {
          setWantlist(prev => prev.map(i => i.id === itemData.id ? finalItem : i));
      } else {
          setWantlist(prev => [finalItem, ...prev]);
      }
      setIsAddWantlistModalOpen(false);
      setWantlistItemToEdit(null);
      if (itemData.id) navigate(`/wantlist/${finalItem.id}`);
  }, [collectionMode, navigate]);

  const handleDeleteWantlistItem = useCallback(async (id: string) => { setWantlist(prev => prev.filter(item => item.id !== id)); }, []);

  const handleMoveToCollection = useCallback(async (item: WantlistItem) => {
      const cdData: Omit<CD, 'id'> = { ...item, created_at: new Date().toISOString() };
      await handleSaveCD(cdData);
      await handleDeleteWantlistItem(item.id);
  }, [handleSaveCD, handleDeleteWantlistItem]);

  const location = useLocation();
  const isOnWantlistPage = location.pathname.startsWith('/wantlist');
  const isGoogleDriveSelectedButLoggedOut = syncProvider === 'google_drive' && !driveSignedIn;

  return (
    <div className="min-h-screen pb-20 md:pb-0 font-sans selection:bg-zinc-200">
      <Header 
        onAddClick={() => {
            if (isOnWantlistPage) { setIsAddWantlistModalOpen(true); setWantlistItemToEdit(null); } 
            else { setIsAddModalOpen(true); setCdToEdit(null); setPrefillData(null); }
        }} 
        collectionCount={currentCollection.length} 
        onImport={handleImport}
        onExport={handleExport}
        onOpenSyncSettings={() => setIsSyncSettingsOpen(true)}
        syncStatus={currentSyncStatus}
        syncError={currentSyncError}
        syncProvider={syncProvider}
        syncMode={syncMode}
        onManualSync={handleManualSync}
        onSignOut={driveSignOut}
        isOnWantlistPage={isOnWantlistPage}
        collectionMode={collectionMode}
        onToggleMode={handleToggleMode}
      />
      <main className="container mx-auto p-4 md:p-6">
        {isGoogleDriveSelectedButLoggedOut && (
             <div className="p-8 bg-white rounded-lg border border-zinc-200 max-w-md mx-auto my-8 text-center shadow-xl">
                <h2 className="text-xl font-bold text-zinc-900">Google Drive Sync</h2>
                <p className="text-zinc-600 mt-2">Sign in to your Google account to keep your collection and wantlist synced across devices.</p>
                {driveError && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700 flex flex-col gap-2">
                        <p>{driveError}</p>
                        <button onClick={driveResetStatus} className="text-xs font-bold underline">Clear error and try again</button>
                    </div>
                )}
                {!driveReady ? (
                    <div className="mt-6 flex flex-col items-center gap-2">
                        <SpinnerIcon className="w-8 h-8 text-zinc-400" />
                        <button disabled className="w-full bg-zinc-200 text-zinc-400 font-bold py-3 px-6 rounded-lg cursor-not-allowed">Initializing...</button>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        <button 
                            onClick={driveSignIn} 
                            disabled={driveStatus === 'authenticating'}
                            className="mt-6 w-full bg-zinc-900 text-white font-bold py-3 px-6 rounded-lg hover:bg-black transition-all transform active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {driveStatus === 'authenticating' && <SpinnerIcon className="w-5 h-5" />}
                            {driveStatus === 'authenticating' ? 'Signing in...' : 'Sign in with Google'}
                        </button>
                        {driveStatus === 'authenticating' && (
                            <button onClick={driveResetStatus} className="text-xs text-zinc-400 underline">Cancel or Reset</button>
                        )}
                    </div>
                )}
                <p className="mt-4 text-[10px] text-zinc-400">DiscO only requests access to files it creates in your Drive.</p>
             </div>
        )}

        <Routes>
          <Route path="/" element={<ListView cds={currentCollection} wantlist={currentWantlist} onAddToWantlist={(item) => handleSaveWantlistItem(item)} onRequestAdd={(artist) => { setPrefillData(artist ? { artist } : null); setIsAddModalOpen(true); }} onRequestEdit={(cd) => { setCdToEdit(cd); setIsAddModalOpen(true); }} collectionMode={collectionMode} />} />
          <Route path="/cd/:id" element={<DetailView cds={currentCollection} onDeleteCD={handleDeleteCD} onUpdateCD={handleSaveCD} collectionMode={collectionMode} />} />
          <Route path="/artists" element={<ArtistsView cds={currentCollection} collectionMode={collectionMode} />} />
          <Route path="/artist/:artistName" element={<ArtistDetailView cds={currentCollection} wantlist={currentWantlist} onAddToWantlist={(item) => handleSaveWantlistItem(item)} collectionMode={collectionMode} />} />
          <Route path="/stats" element={<DashboardView cds={currentCollection} collectionMode={collectionMode} />} />
          <Route path="/duplicates" element={<DuplicatesView cds={currentCollection} onDeleteCD={handleDeleteCD} collectionMode={collectionMode} />} />
          <Route path="/wantlist" element={<WantlistView wantlist={currentWantlist} onRequestEdit={(item) => { setWantlistItemToEdit(item); setIsAddWantlistModalOpen(true); }} onDelete={handleDeleteWantlistItem} onMoveToCollection={handleMoveToCollection} collectionMode={collectionMode} />} />
          <Route path="/wantlist/:id" element={<WantlistDetailView wantlist={currentWantlist} cds={currentCollection} onDelete={handleDeleteWantlistItem} onMoveToCollection={handleMoveToCollection} collectionMode={collectionMode} />} />
        </Routes>
      </main>

      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start md:items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="w-full max-w-3xl my-8 shadow-2xl">
            <AddCDForm onSave={handleSaveCD} onCancel={() => { setIsAddModalOpen(false); setCdToEdit(null); setPrefillData(null); }} cdToEdit={cdToEdit} prefill={prefillData} isVinyl={collectionMode === 'vinyl'} />
          </div>
        </div>
      )}
      {isAddWantlistModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start md:items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="w-full max-w-3xl my-8 shadow-2xl">
                <AddWantlistItemForm onSave={handleSaveWantlistItem} onCancel={() => { setIsAddWantlistModalOpen(false); setWantlistItemToEdit(null); }} itemToEdit={wantlistItemToEdit} isVinyl={collectionMode === 'vinyl'} />
            </div>
        </div>
      )}
      {duplicateCheckResult && <ConfirmDuplicateModal isOpen={true} onClose={() => setDuplicateCheckResult(null)} onConfirm={(version) => handleSaveCD({ ...duplicateCheckResult.newCd, version })} newCdData={duplicateCheckResult.newCd} existingCd={duplicateCheckResult.existingCd} />}
      <ImportConfirmModal isOpen={!!pendingImport} onClose={() => setPendingImport(null)} onMerge={() => confirmImport('merge')} onReplace={() => confirmImport('replace')} importCount={pendingImport?.length || 0} />
      <SyncSettingsModal isOpen={isSyncSettingsOpen} onClose={() => setIsSyncSettingsOpen(false)} currentProvider={syncProvider} onProviderChange={setSyncProvider} syncMode={syncMode} onSyncModeChange={setSyncMode} />
      <BottomNavBar collectionMode={collectionMode} onToggleMode={handleToggleMode} />
      <button onClick={() => { if (isOnWantlistPage) { setWantlistItemToEdit(null); setIsAddWantlistModalOpen(true); } else { setCdToEdit(null); setPrefillData(null); setIsAddModalOpen(true); } }} className="md:hidden fixed bottom-20 right-4 w-14 h-14 bg-zinc-900 text-white rounded-full shadow-xl flex items-center justify-center z-30" aria-label="Add New"><PlusIcon className="h-6 w-6" /></button>
    </div>
  );
};

const App: React.FC = () => (<HashRouter><ScrollToTop /><AppContent /></HashRouter>);
export default App;
