
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { HashRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { CD, SyncProvider, SyncStatus, SyncMode, WantlistItem, CollectionMode } from './types';
import Header from './components/Header';
import ListView from './views/ListView';
import DetailView from './views/DetailView';
import ArtistsView from './views/ArtistsView';
import DashboardView from './views/DashboardView';
import { getAlbumDetails } from './gemini';
import { areStringsSimilar } from './utils';
import BottomNavBar from './components/BottomNavBar';
import SyncSettingsModal from './components/SyncSettingsModal';
import DuplicatesView from './views/DuplicatesView';
import WantlistView from './views/WantlistView';
import WantlistDetailView from './views/WantlistDetailView';
import ArtistDetailView from './views/ArtistDetailView';
import { useGoogleDrive } from './hooks/useGoogleDrive';
import ScrollToTop from './components/ScrollToTop';
import ImportConfirmModal from './components/ImportConfirmModal';
import SyncConflictModal from './components/SyncConflictModal';

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
  const [conflictCloudTime, setConflictCloudTime] = useState<string | null>(null);
  
  const autoSaveTimeoutRef = useRef<number | null>(null);

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
    lastSyncTime: driveLastSyncTime,
    resetSyncStatus: driveResetStatus
  } = useGoogleDrive();

  const [syncProvider, setSyncProvider] = useState<SyncProvider>(() => {
      const saved = localStorage.getItem('disco_sync_provider');
      return (saved === 'google_drive' ? 'google_drive' : 'none');
  });

  // Persist local state
  useEffect(() => {
    localStorage.setItem('disco_collection', JSON.stringify(collection));
    localStorage.setItem('disco_wantlist', JSON.stringify(wantlist));
  }, [collection, wantlist]);

  const handlePullLatest = useCallback(async () => {
    const data = await driveLoadData();
    if (data) {
        setCollection(data.collection || []);
        setWantlist(data.wantlist || []);
    }
    setHasAttemptedInitialLoad(true);
  }, [driveLoadData]);

  const handlePushLatest = useCallback(() => {
    if (driveSignedIn && (driveStatus === 'idle' || driveStatus === 'synced' || driveStatus === 'error')) {
        driveSaveData({ collection, wantlist, lastUpdated: new Date().toISOString() });
    }
  }, [driveSignedIn, driveStatus, driveSaveData, collection, wantlist]);

  // Initial Load Trigger
  useEffect(() => {
      if (syncProvider === 'google_drive' && driveSignedIn && !hasAttemptedInitialLoad) {
          handlePullLatest();
      }
  }, [syncProvider, driveSignedIn, handlePullLatest, hasAttemptedInitialLoad]);

  // Smart Auto-Save
  useEffect(() => {
    if (syncProvider !== 'google_drive' || !driveSignedIn || !hasAttemptedInitialLoad) return;
    
    const currentHash = JSON.stringify({ collection, wantlist });
    if (currentHash === driveLastSyncHash) return;

    if (autoSaveTimeoutRef.current) window.clearTimeout(autoSaveTimeoutRef.current);
    autoSaveTimeoutRef.current = window.setTimeout(() => {
        handlePushLatest();
    }, 2000); // Wait for 2 seconds of inactivity before pushing

    return () => {
        if (autoSaveTimeoutRef.current) window.clearTimeout(autoSaveTimeoutRef.current);
    };
  }, [collection, wantlist, syncProvider, driveSignedIn, driveLastSyncHash, handlePushLatest, hasAttemptedInitialLoad]);

  // Cloud Check on Focus
  useEffect(() => {
    const performCloudCheck = async () => {
        if (syncProvider === 'google_drive' && driveSignedIn && hasAttemptedInitialLoad && driveStatus !== 'saving' && driveStatus !== 'loading') {
            const hasUpdate = await driveCheckUpdate();
            if (hasUpdate) {
                const currentLocalHash = JSON.stringify({ collection, wantlist });
                if (currentLocalHash === driveLastSyncHash) {
                    handlePullLatest();
                } else {
                    // Conflict scenario
                    setConflictCloudTime(new Date().toISOString()); 
                }
            }
        }
    };

    const handleVisibility = () => {
        if (document.visibilityState === 'visible') performCloudCheck();
    };

    window.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);
    const interval = setInterval(performCloudCheck, 60000); // Periodic check every minute

    return () => {
        window.removeEventListener('visibilitychange', handleVisibility);
        window.removeEventListener('focus', handleVisibility);
        clearInterval(interval);
    };
  }, [syncProvider, driveSignedIn, hasAttemptedInitialLoad, driveStatus, driveCheckUpdate, driveLastSyncHash, collection, wantlist, handlePullLatest]);

  const handleResolveConflict = (strategy: 'cloud' | 'local') => {
      setConflictCloudTime(null);
      if (strategy === 'cloud') {
          handlePullLatest();
      } else {
          handlePushLatest();
      }
  };

  const onAddCD = useCallback(async (cdData: Omit<CD, 'id'> & { id?: string }) => {
    const newCD: CD = {
      ...cdData,
      id: cdData.id || generateId(),
      created_at: cdData.created_at || new Date().toISOString(),
      format: collectionMode
    };

    if (cdData.id) {
      setCollection(prev => prev.map(c => c.id === cdData.id ? newCD : c));
    } else {
      setCollection(prev => [newCD, ...prev]);
    }
    navigate('/');
  }, [collectionMode, navigate]);

  const onDeleteCD = useCallback((id: string) => {
    setCollection(prev => prev.filter(c => c.id !== id));
  }, []);

  const onUpdateCD = useCallback(async (updatedCd: CD) => {
    setCollection(prev => prev.map(c => c.id === updatedCd.id ? updatedCd : c));
  }, []);

  const onAddToWantlist = useCallback(async (itemData: Omit<WantlistItem, 'id'> & { id?: string }) => {
    const newItem: WantlistItem = {
        ...itemData,
        id: itemData.id || generateId(),
        created_at: itemData.created_at || new Date().toISOString(),
        format: collectionMode
    };
    if (itemData.id) {
        setWantlist(prev => prev.map(i => i.id === itemData.id ? newItem : i));
    } else {
        setWantlist(prev => [newItem, ...prev]);
    }
    navigate('/wantlist');
  }, [collectionMode, navigate]);

  const onDeleteWantlistItem = useCallback((id: string) => {
      setWantlist(prev => prev.filter(i => i.id !== id));
  }, []);

  const onMoveToCollection = useCallback((item: WantlistItem) => {
      const newCd: CD = { ...item, created_at: new Date().toISOString() };
      setCollection(prev => [newCd, ...prev]);
      setWantlist(prev => prev.filter(i => i.id !== item.id));
      navigate('/');
  }, [navigate]);

  return (
    <div className="min-h-screen bg-zinc-100 flex flex-col pb-16 md:pb-0">
      <ScrollToTop />
      <Header 
        onAddClick={() => navigate(location.pathname === '/wantlist' ? '/wantlist' : '/', { state: { openAdd: true } })} 
        collectionCount={collection.filter(c => (c.format || 'cd') === collectionMode).length}
        onImport={() => {}} 
        onExport={() => {}}
        onOpenSyncSettings={() => setSyncProvider('google_drive')}
        syncStatus={driveStatus}
        syncError={driveError}
        syncProvider={syncProvider}
        syncMode="realtime"
        onManualSync={handlePullLatest}
        onSignOut={driveSignOut}
        collectionMode={collectionMode}
        onToggleMode={() => setCollectionMode(prev => prev === 'cd' ? 'vinyl' : 'cd')}
      />

      <main className="container mx-auto px-4 py-8 flex-grow">
        <Routes>
          <Route path="/" element={
            <ListView 
                cds={collection.filter(c => (c.format || 'cd') === collectionMode)} 
                wantlist={wantlist.filter(w => (w.format || 'cd') === collectionMode)}
                onAddToWantlist={onAddToWantlist}
                onRequestAdd={() => navigate('/', { state: { openAdd: true }})}
                onRequestEdit={(cd) => navigate('/', { state: { editCdId: cd.id }})}
                collectionMode={collectionMode}
            />
          } />
          <Route path="/cd/:id" element={<DetailView cds={collection} onDeleteCD={onDeleteCD} onUpdateCD={onUpdateCD} collectionMode={collectionMode} />} />
          <Route path="/artists" element={<ArtistsView cds={collection} collectionMode={collectionMode} />} />
          <Route path="/artist/:artistName" element={<ArtistDetailView cds={collection} wantlist={wantlist} onAddToWantlist={onAddToWantlist} collectionMode={collectionMode} />} />
          <Route path="/stats" element={<DashboardView cds={collection} collectionMode={collectionMode} />} />
          <Route path="/duplicates" element={<DuplicatesView cds={collection} onDeleteCD={onDeleteCD} collectionMode={collectionMode} />} />
          <Route path="/wantlist" element={<WantlistView wantlist={wantlist.filter(w => (w.format || 'cd') === collectionMode)} onRequestEdit={(i) => navigate('/wantlist', { state: { editWantlistItemId: i.id }})} onDelete={onDeleteWantlistItem} onMoveToCollection={onMoveToCollection} collectionMode={collectionMode} />} />
          <Route path="/wantlist/:id" element={<WantlistDetailView wantlist={wantlist} cds={collection} onDelete={onDeleteWantlistItem} onMoveToCollection={onMoveToCollection} collectionMode={collectionMode} />} />
        </Routes>
      </main>

      <BottomNavBar collectionMode={collectionMode} onToggleMode={() => setCollectionMode(prev => prev === 'cd' ? 'vinyl' : 'cd')} />
      
      {syncProvider === 'google_drive' && !driveSignedIn && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white p-8 rounded-2xl max-w-sm w-full text-center shadow-2xl">
                  <h2 className="text-2xl font-bold text-zinc-900 mb-2">Cloud Sync</h2>
                  <p className="text-zinc-600 mb-6 text-sm">Sign in to back up your collection and access it from any device.</p>
                  <button 
                    onClick={driveSignIn}
                    className="w-full bg-zinc-900 text-white font-bold py-3 rounded-xl hover:bg-black transition-all flex items-center justify-center gap-2"
                  >
                      {driveStatus === 'authenticating' ? 'Signing in...' : 'Sign in with Google'}
                  </button>
              </div>
          </div>
      )}

      <SyncConflictModal 
        isOpen={!!conflictCloudTime} 
        onResolve={handleResolveConflict} 
        lastCloudTime={conflictCloudTime} 
      />
    </div>
  );
};

const App: React.FC = () => (
  <HashRouter>
    <AppContent />
  </HashRouter>
);

export default App;
