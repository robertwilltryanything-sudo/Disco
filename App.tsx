import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { HashRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { CD, SyncProvider, SyncStatus, SyncMode, WantlistItem, CollectionMode } from './types';
import Header from './components/Header';
import ListView from './views/ListView';
import DetailView from './views/DetailView';
import ArtistsView from './views/ArtistsView';
import DashboardView from './views/DashboardView';
import { getAlbumDetails } from './gemini';
import { useSupabaseSync } from './hooks/useSupabaseSync';
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
import SupabaseAuth from './components/SupabaseAuth';

/**
 * Migration helper to ensure old data with camelCase keys is updated
 * to the standardized snake_case format used by the database.
 */
const normalizeData = <T extends CD | WantlistItem>(item: any): T => {
    if (!item) return item;
    const normalized = { ...item };
    if (item.coverArtUrl && !item.cover_art_url) normalized.cover_art_url = item.coverArtUrl;
    if (item.recordLabel && !item.record_label) normalized.record_label = item.recordLabel;
    // Clean up old keys to avoid payload bloat
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
  },
  {
    id: '2',
    artist: 'U2',
    title: 'The Joshua Tree',
    genre: 'Rock',
    year: 1987,
    cover_art_url: 'https://upload.wikimedia.org/wikipedia/en/6/6b/The_Joshua_Tree.png',
    created_at: new Date(Date.now() - 20000).toISOString(),
    format: 'cd'
  },
  {
    id: '5',
    artist: 'Jean-Michel Jarre',
    title: 'Oxygène',
    genre: 'Electronic',
    year: 1976,
    cover_art_url: 'https://upload.wikimedia.org/wikipedia/en/2/25/Oxygene_album_cover.jpg',
    created_at: new Date(Date.now() - 50000).toISOString(),
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
      return (localStorage.getItem('disco_sync_provider') as SyncProvider) || 'none';
  });
  const [syncMode, setSyncMode] = useState<SyncMode>(() => {
       return (localStorage.getItem('disco_sync_mode') as SyncMode) || 'manual';
  });

  const supabaseSync = useSupabaseSync(setCollection, setWantlist, syncMode, syncProvider);
  const googleDriveSync = useGoogleDrive();

  const handleToggleMode = useCallback(() => {
    setCollectionMode(prev => prev === 'cd' ? 'vinyl' : 'cd');
  }, []);

  useEffect(() => {
    localStorage.setItem('disco_mode', collectionMode);
  }, [collectionMode]);

  useEffect(() => {
    if (syncProvider === 'none' || (syncProvider === 'supabase' && syncMode === 'manual')) {
        localStorage.setItem('disco_collection', JSON.stringify(collection));
        localStorage.setItem('disco_wantlist', JSON.stringify(wantlist));
    }
  }, [collection, wantlist, syncProvider, syncMode]);
  
  useEffect(() => { localStorage.setItem('disco_sync_provider', syncProvider); }, [syncProvider]);
  useEffect(() => { localStorage.setItem('disco_sync_mode', syncMode); }, [syncMode]);

  let currentSyncStatus: SyncStatus = 'idle';
  let currentSyncError: string | null = null;
  
  if (syncProvider === 'supabase') {
      currentSyncStatus = supabaseSync.syncStatus;
      currentSyncError = supabaseSync.error;
  } else if (syncProvider === 'google_drive') {
       currentSyncStatus = googleDriveSync.syncStatus;
       currentSyncError = googleDriveSync.error;
  }

  const handleManualSync = useCallback(async () => {
    if (syncProvider === 'supabase') await supabaseSync.manualSync();
  }, [syncProvider, supabaseSync]);

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
          } catch (error) { alert("Failed to parse the file."); }
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
    const dataStr = JSON.stringify({ collection: currentCollection, lastUpdated: new Date().toISOString() }, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `disco_${collectionMode}_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [currentCollection, collectionMode]);

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
                if (syncProvider === 'supabase' && supabaseSync.user) {
                    await supabaseSync.updateCD(updatedCd);
                } else {
                    setCollection(prev => prev.map(c => c.id === cd.id ? updatedCd : c));
                }
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

    const originalCollection = [...collection];
    let finalCd: CD;

    // Optimistic Update
    if (cdData.id) {
        finalCd = { 
            ...cdData, 
            id: cdData.id, 
            created_at: cdData.created_at || new Date().toISOString(),
            format: cdData.format || collectionMode 
        } as CD;
        setCollection(prev => prev.map(c => c.id === cdData.id ? finalCd : c));
    } else {
        finalCd = { 
            ...cdData, 
            id: generateId(), 
            created_at: new Date().toISOString(),
            format: collectionMode 
        } as CD;
        setCollection(prev => [finalCd, ...prev]);
    }

    setIsAddModalOpen(false);
    setCdToEdit(null);
    setPrefillData(null);
    setDuplicateCheckResult(null);

    // Sync to Cloud
    try {
        if (syncProvider === 'supabase') {
            if (!supabaseSync.user) { throw new Error("You must be signed in to save changes to the cloud."); }
            if (cdData.id) {
                const success = await supabaseSync.updateCD(finalCd);
                if (!success) throw new Error(supabaseSync.error || "Update failed");
            } else {
                const savedFromServer = await supabaseSync.addCD(finalCd);
                if (!savedFromServer) throw new Error(supabaseSync.error || "Save failed");
                // Replace optimistic item with server item to ensure synced metadata
                setCollection(prev => prev.map(c => c.id === finalCd.id ? savedFromServer : c));
                finalCd = savedFromServer;
            }
        }
        fetchAndApplyAlbumDetails(finalCd);
        if (cdData.id) navigate(`/cd/${finalCd.id}`);
    } catch (e: any) {
        console.error("Sync error:", e);
        setCollection(originalCollection); // Revert on failure
        throw e;
    }
  }, [collection, collectionMode, syncProvider, supabaseSync, duplicateCheckResult, navigate]);

  const handleDeleteCD = useCallback(async (id: string) => {
    const originalCollection = [...collection];
    setCollection(prev => prev.filter(cd => cd.id !== id));
    
    if (syncProvider === 'supabase') {
        try {
            if (!supabaseSync.user) return;
            await supabaseSync.deleteCD(id);
        } catch (e) {
            console.error("Delete sync error:", e);
            setCollection(originalCollection);
            alert("Could not delete from cloud. Reverting local change.");
        }
    }
  }, [collection, syncProvider, supabaseSync]);
  
  const handleSaveWantlistItem = useCallback(async (itemData: Omit<WantlistItem, 'id'> & { id?: string }) => {
      const originalWantlist = [...wantlist];
      let finalItem: WantlistItem;

      // Optimistic Update
      if (itemData.id) {
          finalItem = { 
              ...itemData, 
              id: itemData.id, 
              created_at: itemData.created_at || new Date().toISOString(),
              format: itemData.format || collectionMode 
          } as WantlistItem;
          setWantlist(prev => prev.map(i => i.id === itemData.id ? finalItem : i));
      } else {
          finalItem = { 
              ...itemData, 
              id: generateId(), 
              created_at: new Date().toISOString(),
              format: collectionMode 
          } as WantlistItem;
          setWantlist(prev => [finalItem, ...prev]);
      }

      setIsAddWantlistModalOpen(false);
      setWantlistItemToEdit(null);

      // Sync to Cloud
      try {
          if (syncProvider === 'supabase') {
              if (!supabaseSync.user) { throw new Error("Please sign in to update your wantlist."); }
              if (itemData.id) {
                  const success = await supabaseSync.updateWantlistItem(finalItem);
                  if (!success) throw new Error(supabaseSync.error || "Update failed");
              } else {
                  const savedFromServer = await supabaseSync.addWantlistItem(finalItem);
                  if (!savedFromServer) throw new Error(supabaseSync.error || "Save failed");
                  setWantlist(prev => prev.map(i => i.id === finalItem.id ? savedFromServer : i));
                  finalItem = savedFromServer;
              }
          }
          if (itemData.id) navigate(`/wantlist/${finalItem.id}`);
      } catch (e: any) {
          console.error("Wantlist sync error:", e);
          setWantlist(originalWantlist);
          throw e;
      }
  }, [wantlist, syncProvider, supabaseSync, collectionMode, navigate]);

  const handleDeleteWantlistItem = useCallback(async (id: string) => {
    const originalWantlist = [...wantlist];
    setWantlist(prev => prev.filter(item => item.id !== id));

    if (syncProvider === 'supabase') {
        try {
            if (!supabaseSync.user) return;
            await supabaseSync.deleteWantlistItem(id);
        } catch (e) {
            console.error("Delete wantlist sync error:", e);
            setWantlist(originalWantlist);
            alert("Could not delete from cloud. Reverting local change.");
        }
    }
  }, [wantlist, syncProvider, supabaseSync]);

  const handleMoveToCollection = useCallback(async (item: WantlistItem) => {
      const cdData: Omit<CD, 'id'> = { ...item, created_at: new Date().toISOString() };
      await handleSaveCD(cdData);
      await handleDeleteWantlistItem(item.id);
  }, [handleSaveCD, handleDeleteWantlistItem]);

  const location = useLocation();
  const isOnWantlistPage = location.pathname.startsWith('/wantlist');
  const isSupabaseSelectedButLoggedOut = syncProvider === 'supabase' && !supabaseSync.user;

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
        user={supabaseSync.user}
        onSignOut={supabaseSync.signOut}
        isOnWantlistPage={isOnWantlistPage}
        collectionMode={collectionMode}
        onToggleMode={handleToggleMode}
      />
      <main className="container mx-auto p-4 md:p-6">
        {isSupabaseSelectedButLoggedOut && (
            <div className="mb-8">
                <SupabaseAuth 
                    user={null} 
                    signIn={supabaseSync.signIn} 
                    syncStatus={supabaseSync.syncStatus} 
                    error={supabaseSync.error} 
                    onOpenSyncSettings={() => setIsSyncSettingsOpen(true)} 
                />
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