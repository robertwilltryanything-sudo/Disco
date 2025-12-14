import React, { useState, useCallback, useEffect } from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { CD, CollectionData, SyncProvider, SyncStatus, SyncMode, WantlistItem } from './types';
import Header from './components/Header';
import ListView from './views/ListView';
import DetailView from './views/DetailView';
import ArtistsView from './views/ArtistsView';
import DashboardView from './views/DashboardView';
import { getAlbumDetails } from './gemini';
import { useSupabaseSync } from './hooks/useSupabaseSync';
import AddCDForm from './components/AddCDForm';
import { XIcon } from './components/icons/XIcon';
import ConfirmDuplicateModal from './components/ConfirmDuplicateModal';
import { areStringsSimilar, getBestCD } from './utils';
import { useDebounce } from './hooks/useDebounce';
import ImportConfirmModal from './components/ImportConfirmModal';
import { XCircleIcon } from './components/icons/XCircleIcon';
import BottomNavBar from './components/BottomNavBar';
import SyncSettingsModal from './components/SyncSettingsModal';
import SupabaseNotConfigured from './components/SupabaseNotConfigured';
import SupabaseAuth from './components/SupabaseAuth';
import DuplicatesView from './views/DuplicatesView';
import WantlistView from './views/WantlistView';
import { PlusIcon } from './components/icons/PlusIcon';
import AddWantlistItemForm from './components/AddWantlistItemForm';
import WantlistDetailView from './views/WantlistDetailView';
import ArtistDetailView from './views/ArtistDetailView';
import { useSimpleSync } from './hooks/useSimpleSync';
import { useGoogleDrive } from './hooks/useGoogleDrive';
import SyncConflictModal from './components/SyncConflictModal';
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
    tracklist: [
      { number: 1, title: 'Speak to Me', duration: '1:30' },
      { number: 2, title: 'Breathe', duration: '2:43' },
      { number: 3, title: 'On the Run', duration: '3:36' },
      { number: 4, title: 'Time', duration: '7:01' },
      { number: 5, title: 'The Great Gig in the Sky', duration: '4:36' },
      { number: 6, title: 'Money', duration: '6:22' },
      { number: 7, title: 'Us and Them', duration: '7:46' },
      { number: 8, title: 'Any Colour You Like', duration: '3:25' },
      { number: 9, title: 'Brain Damage', duration: '3:48' },
      { number: 10, title: 'Eclipse', duration: '2:03' }
    ]
  },
  {
    id: '2',
    artist: 'U2',
    title: 'The Joshua Tree',
    genre: 'Rock',
    year: 1987,
    coverArtUrl: 'https://upload.wikimedia.org/wikipedia/en/6/6b/The_Joshua_Tree.png',
    created_at: new Date(Date.now() - 20000).toISOString(),
    tracklist: [
        { number: 1, title: 'Where the Streets Have No Name', duration: '5:37' },
        { number: 2, title: 'I Still Haven\'t Found What I\'m Looking For', duration: '4:37' },
        { number: 3, title: 'With or Without You', duration: '4:56' },
        { number: 4, title: 'Bullet the Blue Sky', duration: '4:32' },
        { number: 5, title: 'Running to Stand Still', duration: '4:18' },
        { number: 6, title: 'Red Hill Mining Town', duration: '4:52' },
        { number: 7, title: 'In God\'s Country', duration: '2:57' },
        { number: 8, title: 'Trip Through Your Wires', duration: '3:32' },
        { number: 9, title: 'One Tree Hill', duration: '5:23' },
        { number: 10, title: 'Exit', duration: '4:13' },
        { number: 11, title: 'Mothers of the Disappeared', duration: '5:14' }
    ]
  },
  {
    id: '3',
    artist: 'U2',
    title: 'Achtung Baby',
    genre: 'Rock',
    year: 1991,
    coverArtUrl: 'https://upload.wikimedia.org/wikipedia/en/1/17/Achtung_Baby.png',
    created_at: new Date(Date.now() - 30000).toISOString()
  },
  {
    id: '4',
    artist: 'Steely Dan',
    title: 'Aja',
    genre: 'Jazz Rock',
    year: 1977,
    coverArtUrl: 'https://upload.wikimedia.org/wikipedia/en/4/49/Aja_album_cover.jpg',
    created_at: new Date(Date.now() - 40000).toISOString()
  },
  {
    id: '5',
    artist: 'Jean-Michel Jarre',
    title: 'Oxygène',
    genre: 'Electronic',
    year: 1976,
    coverArtUrl: 'https://upload.wikimedia.org/wikipedia/en/7/75/Oxyg%C3%A8ne.png',
    created_at: new Date(Date.now() - 50000).toISOString()
  },
  {
    id: '6',
    artist: 'The Orb',
    title: "The Orb's Adventures Beyond the Ultraworld",
    genre: 'Ambient House',
    year: 1991,
    coverArtUrl: 'https://upload.wikimedia.org/wikipedia/en/2/2e/The_Orb%27s_Adventures_Beyond_the_Ultraworld_cover.jpg',
    created_at: new Date(Date.now() - 60000).toISOString()
  }
];

const AppContent: React.FC = () => {
  const [cds, setCds] = useState<CD[]>(() => {
    const saved = localStorage.getItem('disco_collection');
    // Use initial collection if local storage is empty
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

  const [conflictData, setConflictData] = useState<{ local: CollectionData, cloud: CollectionData } | null>(null);


  // Sync Hooks
  const supabaseSync = useSupabaseSync(setCds, setWantlist, syncMode, syncProvider);
  const simpleSync = useSimpleSync();
  const googleDriveSync = useGoogleDrive();

  // Persist local changes
  useEffect(() => {
    if (syncProvider === 'none' || (syncProvider === 'supabase' && syncMode === 'manual')) {
        localStorage.setItem('disco_collection', JSON.stringify(cds));
        localStorage.setItem('disco_wantlist', JSON.stringify(wantlist));
    }
  }, [cds, wantlist, syncProvider, syncMode]);
  
  useEffect(() => {
      localStorage.setItem('disco_sync_provider', syncProvider);
  }, [syncProvider]);
  
  useEffect(() => {
      localStorage.setItem('disco_sync_mode', syncMode);
  }, [syncMode]);

  // Derived Sync Status
  let currentSyncStatus: SyncStatus = 'idle';
  let currentSyncError: string | null = null;
  
  if (syncProvider === 'supabase') {
      currentSyncStatus = supabaseSync.syncStatus;
      currentSyncError = supabaseSync.error;
  } else if (syncProvider === 'google_drive') { // Placeholder if implemented
       currentSyncStatus = googleDriveSync.syncStatus;
       currentSyncError = googleDriveSync.error;
  }

  const handleManualSync = useCallback(async () => {
    if (syncProvider === 'supabase') {
        await supabaseSync.manualSync();
    }
    // Add other providers here
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
            if (Array.isArray(importedData)) {
               setPendingImport(importedData);
            } else if (importedData.collection && Array.isArray(importedData.collection)) {
               setPendingImport(importedData.collection);
            } else {
              alert("Invalid file format.");
            }
          } catch (error) {
            console.error("Import failed:", error);
            alert("Failed to parse the file.");
          }
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
          // Merge logic: avoid exact ID duplicates, but allow similar content (user can dedup later)
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
    if (!cd.genre || !cd.year || !cd.tracklist) {
        try {
            const details = await getAlbumDetails(cd.artist, cd.title);
            if (details) {
                const updatedCd: CD = {
                    ...cd,
                    genre: cd.genre || details.genre,
                    year: cd.year || details.year,
                    recordLabel: cd.recordLabel || details.recordLabel,
                    tags: [...new Set([...(cd.tags || []), ...(details.tags || [])])],
                    tracklist: cd.tracklist || details.tracklist,
                };
                
                if (syncProvider === 'supabase') {
                    await supabaseSync.updateCD(updatedCd);
                } else {
                     setCds(prev => prev.map(c => c.id === cd.id ? updatedCd : c));
                }
            }
        } catch (e) {
            console.error("Background fetch for details failed", e);
        }
    }
  };

  const handleSaveCD = useCallback(async (cdData: Omit<CD, 'id'> & { id?: string }) => {
    // Check for duplicates if adding new
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
      // Edit existing
      const updatedCd: CD = { 
          ...cdData, 
          id: cdData.id, 
          created_at: cdData.created_at || new Date().toISOString(),
          user_id: (syncProvider === 'supabase' && supabaseSync.user) ? supabaseSync.user.id : undefined
      };
      
      if (syncProvider === 'supabase') {
          await supabaseSync.updateCD(updatedCd);
          savedCd = updatedCd;
      } else {
          setCds(prev => prev.map(cd => cd.id === cdData.id ? updatedCd : cd));
          savedCd = updatedCd;
      }
    } else {
      // Add new
      const newCdBase = {
          ...cdData,
          created_at: new Date().toISOString(),
      };
      
      if (syncProvider === 'supabase') {
         savedCd = await supabaseSync.addCD(newCdBase);
      } else {
         const newCd: CD = { ...newCdBase, id: crypto.randomUUID() };
         setCds(prev => [newCd, ...prev]);
         savedCd = newCd;
      }
    }
    
    if (savedCd) {
        // Trigger background fetch for details (tracklist, etc) if missing
        fetchAndApplyAlbumDetails(savedCd);
    }

    setIsAddModalOpen(false);
    setCdToEdit(null);
    setPrefillData(null);
    setDuplicateCheckResult(null);
  }, [cds, syncProvider, supabaseSync, duplicateCheckResult]);

  const handleDeleteCD = useCallback((id: string) => {
    if (syncProvider === 'supabase') {
        supabaseSync.deleteCD(id);
    } else {
        setCds(prev => prev.filter(cd => cd.id !== id));
    }
  }, [syncProvider, supabaseSync]);
  
  // Wrapper for update to be passed to DetailView
  const handleUpdateCD = useCallback(async (cd: CD) => {
      await handleSaveCD(cd);
  }, [handleSaveCD]);

  // Wantlist Handlers
  const handleSaveWantlistItem = useCallback(async (itemData: Omit<WantlistItem, 'id'> & { id?: string }) => {
      if (itemData.id) {
          // Update
           const updatedItem: WantlistItem = {
              ...itemData,
              id: itemData.id,
              created_at: itemData.created_at || new Date().toISOString(),
              user_id: (syncProvider === 'supabase' && supabaseSync.user) ? supabaseSync.user.id : undefined
          };
          if (syncProvider === 'supabase') {
              await supabaseSync.updateWantlistItem(updatedItem);
          } else {
              setWantlist(prev => prev.map(item => item.id === itemData.id ? updatedItem : item));
          }
      } else {
          // Add
          const newItemBase = { ...itemData, created_at: new Date().toISOString() };
           if (syncProvider === 'supabase') {
              await supabaseSync.addWantlistItem(newItemBase);
          } else {
              const newItem: WantlistItem = { ...newItemBase, id: crypto.randomUUID() };
              setWantlist(prev => [newItem, ...prev]);
          }
      }
      setIsAddWantlistModalOpen(false);
      setWantlistItemToEdit(null);
  }, [syncProvider, supabaseSync]);

  const handleDeleteWantlistItem = useCallback((id: string) => {
       if (syncProvider === 'supabase') {
        supabaseSync.deleteWantlistItem(id);
    } else {
        setWantlist(prev => prev.filter(item => item.id !== id));
    }
  }, [syncProvider, supabaseSync]);

  const handleMoveToCollection = useCallback(async (item: WantlistItem) => {
      // 1. Add to collection
      const cdData: Omit<CD, 'id'> = {
          artist: item.artist,
          title: item.title,
          genre: item.genre,
          year: item.year,
          coverArtUrl: item.coverArtUrl,
          notes: item.notes,
          version: item.version,
          recordLabel: item.recordLabel,
          tags: item.tags,
          tracklist: item.tracklist,
          created_at: new Date().toISOString()
      };
      await handleSaveCD(cdData);
      
      // 2. Remove from wantlist
      handleDeleteWantlistItem(item.id);
  }, [handleSaveCD, handleDeleteWantlistItem]);

  const handleAddToWantlistFromScanner = useCallback(async (item: Omit<WantlistItem, 'id' | 'created_at'>) => {
      const newItemBase = { ...item, created_at: new Date().toISOString() };
      if (syncProvider === 'supabase') {
          await supabaseSync.addWantlistItem(newItemBase);
      } else {
           const newItem: WantlistItem = { ...newItemBase, id: crypto.randomUUID() };
           setWantlist(prev => [newItem, ...prev]);
      }
  }, [syncProvider, supabaseSync]);
  
  const location = useLocation();
  const isOnWantlistPage = location.pathname.startsWith('/wantlist');

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <Header 
        onAddClick={() => {
            if (isOnWantlistPage) {
                setWantlistItemToEdit(null);
                setIsAddWantlistModalOpen(true);
            } else {
                setCdToEdit(null);
                setPrefillData(null);
                setIsAddModalOpen(true);
            }
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
      
      <main className="container mx-auto p-4 md:p-6">
        <Routes>
          <Route path="/" element={
            <ListView 
                cds={cds} 
                wantlist={wantlist}
                onRequestAdd={(artist) => {
                    setPrefillData(artist ? { artist } : null);
                    setIsAddModalOpen(true);
                }}
                onRequestEdit={(cd) => {
                    setCdToEdit(cd);
                    setIsAddModalOpen(true);
                }}
                onAddToWantlist={handleAddToWantlistFromScanner}
            />
          } />
          <Route path="/cd/:id" element={
            <DetailView 
                cds={cds} 
                onDeleteCD={handleDeleteCD} 
                onUpdateCD={handleUpdateCD}
            />
          } />
          <Route path="/artists" element={<ArtistsView cds={cds} />} />
           <Route path="/artist/:artistName" element={
               <ArtistDetailView 
                    cds={cds} 
                    wantlist={wantlist}
                    onAddToWantlist={handleAddToWantlistFromScanner}
                />
            } />
          <Route path="/dashboard" element={<DashboardView cds={cds} />} />
          <Route path="/duplicates" element={<DuplicatesView cds={cds} onDeleteCD={handleDeleteCD} />} />
          <Route path="/wantlist" element={
              <WantlistView 
                wantlist={wantlist} 
                onRequestEdit={(item) => {
                    setWantlistItemToEdit(item);
                    setIsAddWantlistModalOpen(true);
                }}
                onDelete={handleDeleteWantlistItem}
                onMoveToCollection={handleMoveToCollection}
              />
            } 
          />
          <Route path="/wantlist/:id" element={
              <WantlistDetailView 
                wantlist={wantlist} 
                cds={cds}
                onDelete={handleDeleteWantlistItem}
                onMoveToCollection={handleMoveToCollection}
              />
            } 
          />
        </Routes>
      </main>

      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start md:items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="w-full max-w-3xl my-8">
            <AddCDForm 
                onSave={handleSaveCD} 
                onCancel={() => {
                    setIsAddModalOpen(false);
                    setCdToEdit(null);
                    setPrefillData(null);
                }}
                cdToEdit={cdToEdit}
                prefill={prefillData}
            />
          </div>
        </div>
      )}
      
      {isAddWantlistModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start md:items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="w-full max-w-3xl my-8">
                <AddWantlistItemForm
                    onSave={handleSaveWantlistItem}
                    onCancel={() => {
                        setIsAddWantlistModalOpen(false);
                        setWantlistItemToEdit(null);
                    }}
                    itemToEdit={wantlistItemToEdit}
                />
            </div>
        </div>
      )}

      {duplicateCheckResult && (
        <ConfirmDuplicateModal
            isOpen={true}
            onClose={() => setDuplicateCheckResult(null)}
            onConfirm={(version) => {
                handleSaveCD({ ...duplicateCheckResult.newCd, version });
            }}
            newCdData={duplicateCheckResult.newCd}
            existingCd={duplicateCheckResult.existingCd}
        />
      )}

      <ImportConfirmModal 
        isOpen={!!pendingImport}
        onClose={() => setPendingImport(null)}
        onMerge={() => confirmImport('merge')}
        onReplace={() => confirmImport('replace')}
        importCount={pendingImport?.length || 0}
      />
      
      <SyncSettingsModal
        isOpen={isSyncSettingsOpen}
        onClose={() => setIsSyncSettingsOpen(false)}
        currentProvider={syncProvider}
        onProviderChange={setSyncProvider}
        syncMode={syncMode}
        onSyncModeChange={setSyncMode}
      />
      
      <BottomNavBar />

      {/* Mobile Floating Action Button for Add */}
      <button
          onClick={() => {
              if (isOnWantlistPage) {
                  setWantlistItemToEdit(null);
                  setIsAddWantlistModalOpen(true);
              } else {
                  setCdToEdit(null);
                  setPrefillData(null);
                  setIsAddModalOpen(true);
              }
          }}
          className="md:hidden fixed bottom-20 right-4 w-14 h-14 bg-zinc-900/80 backdrop-blur-sm text-white rounded-full shadow-lg flex items-center justify-center z-30 hover:bg-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900 active:scale-95 transition-transform"
          aria-label={isOnWantlistPage ? "Add to Wantlist" : "Add CD"}
      >
          <PlusIcon className="h-6 w-6" />
      </button>
    </div>
  );
};

const App: React.FC = () => {
    return (
        <HashRouter>
            <ScrollToTop />
            <AppContent />
        </HashRouter>
    );
};

export default App;