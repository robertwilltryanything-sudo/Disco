import React, { useState, useCallback, useEffect } from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { CD, SyncProvider, SyncStatus, SyncMode, WantlistItem } from './types';
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
import ImportConfirmModal from './components/ImportConfirmModal';
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

const INITIAL_COLLECTION: CD[] = [
  {
    id: '1',
    artist: 'Pink Floyd',
    title: 'The Dark Side of the Moon',
    genre: 'Progressive Rock',
    year: 1973,
    coverArtUrl: 'https://upload.wikimedia.org/wikipedia/en/3/3b/Dark_Side_of_the_Moon.png',
    notes: 'Classic.',
    created_at: new Date(Date.now() - 10000).toISOString(),
  },
  {
    id: '2',
    artist: 'U2',
    title: 'The Joshua Tree',
    genre: 'Rock',
    year: 1987,
    coverArtUrl: 'https://upload.wikimedia.org/wikipedia/en/6/6b/The_Joshua_Tree.png',
    created_at: new Date(Date.now() - 20000).toISOString(),
  },
  {
    id: '5',
    artist: 'Jean-Michel Jarre',
    title: 'Oxygène',
    genre: 'Electronic',
    year: 1976,
    coverArtUrl: 'https://upload.wikimedia.org/wikipedia/en/2/25/Oxygene_album_cover.jpg',
    created_at: new Date(Date.now() - 50000).toISOString()
  }
];

const AppContent: React.FC = () => {
  const [cds, setCds] = useState<CD[]>(() => {
    const saved = localStorage.getItem('disco_collection');
    return saved ? JSON.parse(saved) : INITIAL_COLLECTION;
  });
  
  const [wantlist, setWantlist] = useState<WantlistItem[]>(() => {
      const saved = localStorage.getItem('disco_wantlist');
      return saved ? JSON.parse(saved) : [];
  });

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

  const supabaseSync = useSupabaseSync(setCds, setWantlist, syncMode, syncProvider);
  const googleDriveSync = useGoogleDrive();

  useEffect(() => {
    if (syncProvider === 'none' || (syncProvider === 'supabase' && syncMode === 'manual')) {
        localStorage.setItem('disco_collection', JSON.stringify(cds));
        localStorage.setItem('disco_wantlist', JSON.stringify(wantlist));
    }
  }, [cds, wantlist, syncProvider, syncMode]);
  
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
            setPendingImport(Array.isArray(importedData) ? importedData : (importedData.collection || null));
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
          setCds(pendingImport);
      } else {
          const existingIds = new Set(cds.map(c => c.id));
          const newItems = pendingImport.filter(c => !existingIds.has(c.id));
          setCds([...cds, ...newItems]);
      }
      setPendingImport(null);
  }, [pendingImport, cds]);

  const handleExport = useCallback(() => {
    const dataStr = JSON.stringify({ collection: cds, lastUpdated: new Date().toISOString() }, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `disco_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [cds]);

  const fetchAndApplyAlbumDetails = async (cd: CD) => {
    // Check if basic metadata is missing
    if (!cd.genre || !cd.year) {
        try {
            const details = await getAlbumDetails(cd.artist, cd.title);
            if (details) {
                const updatedCd: CD = {
                    ...cd,
                    genre: cd.genre || details.genre,
                    year: cd.year || details.year,
                    recordLabel: cd.recordLabel || details.recordLabel,
                    tags: [...new Set([...(cd.tags || []), ...(details.tags || [])])],
                };
                if (syncProvider === 'supabase') {
                    await supabaseSync.updateCD(updatedCd);
                } else {
                    setCds(prev => prev.map(c => c.id === cd.id ? updatedCd : c));
                }
            }
        } catch (e) { console.error("Detail fetch error:", e); }
    }
  };

  const handleSaveCD = useCallback(async (cdData: Omit<CD, 'id'> & { id?: string }) => {
    if (!cdData.id && !duplicateCheckResult) {
        const potentialDuplicate = cds.find(c => 
            areStringsSimilar(c.artist, cdData.artist) && 
            areStringsSimilar(c.title, cdData.title)
        );
        if (potentialDuplicate) {
            setDuplicateCheckResult({ newCd: cdData, existingCd: potentialDuplicate });
            return;
        }
    }

    let savedCd: CD | null = null;
    if (cdData.id) {
      const updatedCd: CD = { 
          ...cdData, 
          id: cdData.id, 
          created_at: cdData.created_at || new Date().toISOString(),
          user_id: (syncProvider === 'supabase' && supabaseSync.user) ? supabaseSync.user.id : undefined
      };
      if (syncProvider === 'supabase') { await supabaseSync.updateCD(updatedCd); } 
      else { setCds(prev => prev.map(cd => cd.id === cdData.id ? updatedCd : cd)); }
      savedCd = updatedCd;
    } else {
      const newCdBase = { ...cdData, created_at: new Date().toISOString() };
      if (syncProvider === 'supabase') { savedCd = await supabaseSync.addCD(newCdBase); } 
      else {
         const newCd: CD = { ...newCdBase, id: crypto.randomUUID() };
         setCds(prev => [newCd, ...prev]);
         savedCd = newCd;
      }
    }
    if (savedCd) fetchAndApplyAlbumDetails(savedCd);
    setIsAddModalOpen(false);
    setCdToEdit(null);
    setPrefillData(null);
    setDuplicateCheckResult(null);
  }, [cds, syncProvider, supabaseSync, duplicateCheckResult]);

  const handleDeleteCD = useCallback((id: string) => {
    if (syncProvider === 'supabase') supabaseSync.deleteCD(id);
    else setCds(prev => prev.filter(cd => cd.id !== id));
  }, [syncProvider, supabaseSync]);
  
  const handleSaveWantlistItem = useCallback(async (itemData: Omit<WantlistItem, 'id'> & { id?: string }) => {
      if (itemData.id) {
           const updatedItem: WantlistItem = {
              ...itemData,
              id: itemData.id,
              created_at: itemData.created_at || new Date().toISOString(),
              user_id: (syncProvider === 'supabase' && supabaseSync.user) ? supabaseSync.user.id : undefined
          };
          if (syncProvider === 'supabase') await supabaseSync.updateWantlistItem(updatedItem);
          else setWantlist(prev => prev.map(item => item.id === itemData.id ? updatedItem : item));
      } else {
          const newItemBase = { ...itemData, created_at: new Date().toISOString() };
          if (syncProvider === 'supabase') await supabaseSync.addWantlistItem(newItemBase);
          else {
              const newItem: WantlistItem = { ...newItemBase, id: crypto.randomUUID() };
              setWantlist(prev => [newItem, ...prev]);
          }
      }
      setIsAddWantlistModalOpen(false);
      setWantlistItemToEdit(null);
  }, [syncProvider, supabaseSync]);

  const handleDeleteWantlistItem = useCallback((id: string) => {
    if (syncProvider === 'supabase') supabaseSync.deleteWantlistItem(id);
    else setWantlist(prev => prev.filter(item => item.id !== id));
  }, [syncProvider, supabaseSync]);

  const handleMoveToCollection = useCallback(async (item: WantlistItem) => {
      const cdData: Omit<CD, 'id'> = { ...item, created_at: new Date().toISOString() };
      await handleSaveCD(cdData);
      handleDeleteWantlistItem(item.id);
  }, [handleSaveCD, handleDeleteWantlistItem]);

  const location = useLocation();
  const isOnWantlistPage = location.pathname.startsWith('/wantlist');

  return (
    <div className="min-h-screen pb-20 md:pb-0 font-sans selection:bg-zinc-200">
      <Header 
        onAddClick={() => {
            if (isOnWantlistPage) { setIsAddWantlistModalOpen(true); setWantlistItemToEdit(null); } 
            else { setIsAddModalOpen(true); setCdToEdit(null); setPrefillData(null); }
        }} 
        collectionCount={cds.length} 
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
      />
      <main className="container mx-auto p-4 md:p-6 animate-in fade-in duration-500">
        <Routes>
          <Route path="/" element={<ListView cds={cds} wantlist={wantlist} onAddToWantlist={(item) => handleSaveWantlistItem(item)} onRequestAdd={(artist) => { setPrefillData(artist ? { artist } : null); setIsAddModalOpen(true); }} onRequestEdit={(cd) => { setCdToEdit(cd); setIsAddModalOpen(true); }} />} />
          <Route path="/cd/:id" element={<DetailView cds={cds} onDeleteCD={handleDeleteCD} onUpdateCD={handleSaveCD} />} />
          <Route path="/artists" element={<ArtistsView cds={cds} />} />
          <Route path="/artist/:artistName" element={<ArtistDetailView cds={cds} wantlist={wantlist} onAddToWantlist={(item) => handleSaveWantlistItem(item)} />} />
          <Route path="/dashboard" element={<DashboardView cds={cds} />} />
          <Route path="/duplicates" element={<DuplicatesView cds={cds} onDeleteCD={handleDeleteCD} />} />
          <Route path="/wantlist" element={<WantlistView wantlist={wantlist} onRequestEdit={(item) => { setWantlistItemToEdit(item); setIsAddWantlistModalOpen(true); }} onDelete={handleDeleteWantlistItem} onMoveToCollection={handleMoveToCollection} />} />
          <Route path="/wantlist/:id" element={<WantlistDetailView wantlist={wantlist} cds={cds} onDelete={handleDeleteWantlistItem} onMoveToCollection={handleMoveToCollection} />} />
        </Routes>
      </main>

      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start md:items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="w-full max-w-3xl my-8 shadow-2xl">
            <AddCDForm onSave={handleSaveCD} onCancel={() => { setIsAddModalOpen(false); setCdToEdit(null); setPrefillData(null); }} cdToEdit={cdToEdit} prefill={prefillData} />
          </div>
        </div>
      )}
      {isAddWantlistModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start md:items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="w-full max-w-3xl my-8 shadow-2xl">
                <AddWantlistItemForm onSave={handleSaveWantlistItem} onCancel={() => { setIsAddWantlistModalOpen(false); setWantlistItemToEdit(null); }} itemToEdit={wantlistItemToEdit} />
            </div>
        </div>
      )}
      {duplicateCheckResult && <ConfirmDuplicateModal isOpen={true} onClose={() => setDuplicateCheckResult(null)} onConfirm={(version) => handleSaveCD({ ...duplicateCheckResult.newCd, version })} newCdData={duplicateCheckResult.newCd} existingCd={duplicateCheckResult.existingCd} />}
      <ImportConfirmModal isOpen={!!pendingImport} onClose={() => setPendingImport(null)} onMerge={() => confirmImport('merge')} onReplace={() => confirmImport('replace')} importCount={pendingImport?.length || 0} />
      <SyncSettingsModal isOpen={isSyncSettingsOpen} onClose={() => setIsSyncSettingsOpen(false)} currentProvider={syncProvider} onProviderChange={setSyncProvider} syncMode={syncMode} onSyncModeChange={setSyncMode} />
      <BottomNavBar />
      <button onClick={() => { if (isOnWantlistPage) { setWantlistItemToEdit(null); setIsAddWantlistModalOpen(true); } else { setCdToEdit(null); setPrefillData(null); setIsAddModalOpen(true); } }} className="md:hidden fixed bottom-20 right-4 w-14 h-14 bg-zinc-900 text-white rounded-full shadow-xl flex items-center justify-center z-30 hover:scale-105 active:scale-95 transition-all" aria-label="Add New"><PlusIcon className="h-6 w-6" /></button>
    </div>
  );
};

const App: React.FC = () => (<HashRouter><ScrollToTop /><AppContent /></HashRouter>);
export default App;