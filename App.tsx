import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { HashRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { CD, SyncProvider, SyncStatus, WantlistItem, CollectionMode } from './types';
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
import ShelfView from './views/ShelfView';
import { useGoogleDrive, UnifiedStorage } from './hooks/useGoogleDrive';
import ScrollToTop from './components/ScrollToTop';
import ImportConfirmModal from './components/ImportConfirmModal';
import { SpinnerIcon } from './components/icons/SpinnerIcon';
import { XCircleIcon } from './components/icons/XCircleIcon';
import SyncConfirmationModal from './components/SyncConfirmationModal';
import DriveImagePickerModal from './components/DriveImagePickerModal';
import SearchOverlay from './components/SearchOverlay';
import { AutoSyncBanner } from './components/AutoSyncBanner';

const LOCAL_UPDATED_AT_KEY = 'disco_local_updated_at';

const normalizeData = <T extends CD | WantlistItem>(item: any): T => {
    if (!item) return item;
    const normalized = { ...item };
    if (item.coverArtUrl && !item.cover_art_url) normalized.cover_art_url = item.coverArtUrl;
    if (item.recordLabel && !item.record_label) normalized.record_label = item.recordLabel;
    if (item.allMusicUrl && !item.allmusic_url) normalized.allmusic_url = item.allMusicUrl;
    
    // Fix broken or MoFi URLs for Steely Dan - Aja to standard original album art
    if (normalized.title === 'Aja' && normalized.artist === 'Steely Dan') {
        if (!normalized.cover_art_url || normalized.cover_art_url.includes('Steely_Dan_Aja.png') || normalized.cover_art_url.includes('coverartarchive.org')) {
            normalized.cover_art_url = 'https://upload.wikimedia.org/wikipedia/en/4/49/Aja_album_cover.jpg';
        }
    }

    // Fix broken or fan-art URL for Pink Floyd - The Dark Side of the Moon to official album art
    if ((normalized.title === 'The Dark Side of the Moon' || normalized.title === 'Dark Side of the Moon') && (normalized.artist === 'Pink Floyd' || !normalized.artist)) {
        if (!normalized.cover_art_url || normalized.cover_art_url.includes('Dark_Side_of_the_Moon.png') || normalized.cover_art_url.includes('DarkSideOfTheMoon1973.jpg')) {
            normalized.cover_art_url = 'https://upload.wikimedia.org/wikipedia/commons/3/3b/Dark_Side_of_the_Moon.png';
        }
    }

    // Fix broken URL for Toto - Hydra
    if (normalized.title === 'Hydra' && (normalized.artist === 'Toto' || !normalized.artist)) {
        if (!normalized.cover_art_url || normalized.cover_art_url.includes('Toto-Hydra.JPG')) {
            normalized.cover_art_url = 'https://upload.wikimedia.org/wikipedia/en/1/19/Hydra_%28Toto_album%29_coverart.jpg';
        }
    }

    // Fix broken URL for Mike Oldfield - Tubular Bells
    if (normalized.title === 'Tubular Bells' && (normalized.artist === 'Mike Oldfield' || !normalized.artist)) {
        if (!normalized.cover_art_url || normalized.cover_art_url.includes('Tubular_Bells_album_cover.jpg')) {
            normalized.cover_art_url = 'https://upload.wikimedia.org/wikipedia/en/0/0d/Mike_oldfield_tubular_bells_album_cover.jpg';
        }
    }

    // For Elvis Costello related items, ensure default sort_name is 'Costello, Elvis' if not set
    const artLower = (normalized.artist || '').toLowerCase();
    if ((artLower.includes('elvis costello') || artLower.includes('costello, elvis') || artLower.includes('the costello show') || artLower.includes('the coward brothers')) && !normalized.sort_name) {
        normalized.sort_name = 'Costello, Elvis';
    }

    // For Creedence Clearwater Revival items, ensure default sort_name is 'Creedence Clearwater Revival' (under C)
    if ((artLower.includes('creedence clearwater revival') || artLower === 'ccr') && (!normalized.sort_name || normalized.sort_name.toLowerCase().startsWith('revival'))) {
        normalized.sort_name = 'Creedence Clearwater Revival';
    }

    // For Grateful Dead items, ensure default sort_name is 'Grateful Dead' (under G)
    if (artLower.includes('grateful dead') && (!normalized.sort_name || normalized.sort_name.toLowerCase().startsWith('dead'))) {
        normalized.sort_name = 'Grateful Dead';
    }

    // For Vaya Con Dios items, ensure default sort_name is 'Vaya Con Dios' (under V)
    if (artLower.includes('vaya con dios') && (!normalized.sort_name || normalized.sort_name.toLowerCase().startsWith('dios'))) {
        normalized.sort_name = 'Vaya Con Dios';
    }

    // For Def Leppard items, ensure default sort_name is 'Def Leppard' (under D)
    if (artLower.includes('def leppard') && (!normalized.sort_name || normalized.sort_name.toLowerCase().startsWith('leppard'))) {
        normalized.sort_name = 'Def Leppard';
    }

    // For Depeche Mode items, ensure default sort_name is 'Depeche Mode' (under D)
    if (artLower.includes('depeche mode') && (!normalized.sort_name || normalized.sort_name.toLowerCase().startsWith('mode'))) {
        normalized.sort_name = 'Depeche Mode';
    }

    // For Dinosaur Jr. items, ensure default sort_name is 'Dinosaur Jr.' (under D)
    if ((artLower.includes('dinosaur jr') || artLower.includes('dinosaur junior')) && (!normalized.sort_name || normalized.sort_name.toLowerCase().startsWith('jr'))) {
        normalized.sort_name = 'Dinosaur Jr.';
    }

    // For Tangerine Dream items, ensure default sort_name is 'Tangerine Dream' (under T)
    if (artLower.includes('tangerine dream') && (!normalized.sort_name || normalized.sort_name.toLowerCase().startsWith('dream'))) {
        normalized.sort_name = 'Tangerine Dream';
    }

    // Ensure genre is always an array if it exists
    if (normalized.genre && !Array.isArray(normalized.genre)) {
        normalized.genre = [normalized.genre];
    } else if (!normalized.genre) {
        normalized.genre = [];
    }

    delete normalized.coverArtUrl;
    delete normalized.recordLabel;
    delete normalized.allMusicUrl;
    return normalized as T;
};

const generateId = () => {
    try { return crypto.randomUUID(); }
    catch (e) { return Math.random().toString(36).substring(2) + Date.now().toString(36); }
};

const INITIAL_COLLECTION: CD[] = [
  {
    id: '1',
    artist: 'Pink Floyd',
    title: 'The Dark Side of the Moon',
    genre: ['Progressive Rock'],
    year: 1973,
    cover_art_url: 'https://upload.wikimedia.org/wikipedia/commons/3/3b/Dark_Side_of_the_Moon.png',
    allmusic_url: 'https://www.allmusic.com/album/the-dark-side-of-the-moon-mw0000191307',
    notes: 'Classic.',
    created_at: new Date(Date.now() - 50000).toISOString(),
    format: 'cd'
  },
  {
    id: '2',
    artist: 'Metallica',
    title: 'Master of Puppets',
    genre: ['Thrash Metal'],
    year: 1986,
    cover_art_url: 'https://upload.wikimedia.org/wikipedia/en/b/b2/Metallica_-_Master_of_Puppets_cover.jpg',
    allmusic_url: 'https://www.allmusic.com/album/master-of-puppets-mw0000193165',
    notes: 'Pinnacle of metal.',
    created_at: new Date(Date.now() - 40000).toISOString(),
    format: 'cd'
  },
  {
    id: '3',
    artist: 'Toto',
    title: 'Hydra',
    genre: ['Progressive Rock'],
    year: 1979,
    cover_art_url: 'https://upload.wikimedia.org/wikipedia/en/1/19/Hydra_%28Toto_album%29_coverart.jpg',
    allmusic_url: 'https://www.allmusic.com/album/hydra-mw0000192305',
    notes: 'Underrated masterpiece.',
    created_at: new Date(Date.now() - 30000).toISOString(),
    format: 'vinyl'
  },
  {
    id: '4',
    artist: 'Steely Dan',
    title: 'Aja',
    genre: ['Jazz Fusion'],
    year: 1977,
    cover_art_url: 'https://upload.wikimedia.org/wikipedia/en/4/49/Aja_album_cover.jpg',
    allmusic_url: 'https://www.allmusic.com/album/aja-mw0000191950',
    notes: 'Audiophile dream.',
    created_at: new Date(Date.now() - 20000).toISOString(),
    format: 'cd'
  },
  {
    id: '5',
    artist: 'Mike Oldfield',
    title: 'Tubular Bells',
    genre: ['Progressive Rock'],
    year: 1973,
    cover_art_url: 'https://upload.wikimedia.org/wikipedia/en/0/0d/Mike_oldfield_tubular_bells_album_cover.jpg',
    allmusic_url: 'https://www.allmusic.com/album/tubular-bells-mw0000201416',
    notes: 'Virgin Records first release.',
    created_at: new Date(Date.now() - 10000).toISOString(),
    format: 'vinyl'
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
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Drive Picker States
  const [isDrivePickerOpen, setIsDrivePickerOpen] = useState(false);
  const [onDriveImageSelected, setOnDriveImageSelected] = useState<((url: string) => void) | null>(null);

  // Sync Safety States
  const [isSyncConfirmOpen, setIsSyncConfirmOpen] = useState(false);
  const [syncConfirmType, setSyncConfirmType] = useState<'push' | 'pull'>('push');
  const [pendingCloudData, setPendingCloudData] = useState<UnifiedStorage | null>(null);
  const [isPeekingCloud, setIsPeekingCloud] = useState(false);
  const [autoSyncBanner, setAutoSyncBanner] = useState<{
    type: 'syncing' | 'synced' | 'downloaded' | 'error';
    message: string;
    details?: string;
  } | null>(null);

  const bannerTimeoutRef = useRef<number | null>(null);
  const showBanner = useCallback((type: 'syncing' | 'synced' | 'downloaded' | 'error', message: string, details?: string, duration = 4000) => {
    if (bannerTimeoutRef.current) window.clearTimeout(bannerTimeoutRef.current);
    setAutoSyncBanner({ type, message, details });
    if (duration > 0) {
      bannerTimeoutRef.current = window.setTimeout(() => {
        setAutoSyncBanner(null);
      }, duration);
    }
  }, []);

  const [syncProvider, setSyncProvider] = useState<SyncProvider>(() => {
      const saved = localStorage.getItem('disco_sync_provider');
      return (saved === 'google_drive' ? 'google_drive' : 'none');
  });

  const { 
    isSignedIn: driveSignedIn, 
    signIn: driveSignIn, 
    signOut: driveSignOut, 
    loadData: driveLoadData, 
    saveData: driveSaveData, 
    syncStatus: driveStatus,
    error: driveError,
    lastSyncTime: driveLastSyncTime,
    isApiReady: driveReady,
    resetSyncStatus: driveResetStatus,
    fetchDriveImages: driveFetchImages,
    getRemoteMetadata: driveGetRemoteMetadata
  } = useGoogleDrive();

  // Track latest collection and wantlist in refs for background sync operations
  const collectionRef = useRef(collection);
  collectionRef.current = collection;
  const wantlistRef = useRef(wantlist);
  wantlistRef.current = wantlist;

  const hasCheckedRemoteOnLoginRef = useRef(false);

  // Background auto-upload helper
  const triggerAutoUpload = useCallback(async (updatedCollection: CD[], updatedWantlist: WantlistItem[], actionLabel = 'Changes') => {
    const timestamp = new Date().toISOString();
    localStorage.setItem(LOCAL_UPDATED_AT_KEY, timestamp);

    if (syncProvider !== 'google_drive' || !driveSignedIn) return;

    showBanner('syncing', `Uploading ${actionLabel.toLowerCase()} to Google Drive...`, undefined, 0);
    try {
      await driveSaveData({
        collection: updatedCollection,
        wantlist: updatedWantlist,
        lastUpdated: timestamp
      });
      showBanner('synced', 'Saved to Google Drive', 'Synced just now', 3500);
    } catch (e: any) {
      console.error("Auto upload failed:", e);
      showBanner('error', 'Auto-save failed to upload to Google Drive', 'Saved locally', 5000);
    }
  }, [syncProvider, driveSignedIn, driveSaveData, showBanner]);

  // Check remote Google Drive for newer save on login or page load
  const checkForNewerRemoteSave = useCallback(async () => {
    if (syncProvider !== 'google_drive' || !driveSignedIn) return;
    
    try {
      const metadata = await driveGetRemoteMetadata();
      if (!metadata || !metadata.modifiedTime) return;

      const remoteTime = new Date(metadata.modifiedTime).getTime();
      const localStoredTimeStr = localStorage.getItem(LOCAL_UPDATED_AT_KEY);
      const localTime = localStoredTimeStr ? new Date(localStoredTimeStr).getTime() : 0;

      // If remote modifiedTime is newer than local by more than 2 seconds (to avoid clock drift)
      if (remoteTime > localTime + 2000) {
        showBanner('syncing', 'Found newer backup on Google Drive. Downloading...', undefined, 0);
        const remoteData = await driveLoadData();
        if (remoteData && remoteData.collection) {
          const remoteCol = remoteData.collection.map(normalizeData<CD>);
          const remoteWant = (remoteData.wantlist || []).map(normalizeData<WantlistItem>);
          
          setCollection(remoteCol);
          setWantlist(remoteWant);
          localStorage.setItem(LOCAL_UPDATED_AT_KEY, remoteData.lastUpdated || metadata.modifiedTime);
          
          const totalCount = remoteCol.length + remoteWant.length;
          showBanner('downloaded', 'Updated collection from Google Drive', `${totalCount} items loaded`, 4500);
        }
      }
    } catch (err) {
      console.warn("Auto-check for newer remote save encountered an error:", err);
    }
  }, [syncProvider, driveSignedIn, driveGetRemoteMetadata, driveLoadData, showBanner]);

  // Automatically check on initial load or whenever user signs in
  useEffect(() => {
    if (driveSignedIn && syncProvider === 'google_drive' && !hasCheckedRemoteOnLoginRef.current) {
      hasCheckedRemoteOnLoginRef.current = true;
      checkForNewerRemoteSave();
    }
    if (!driveSignedIn) {
      hasCheckedRemoteOnLoginRef.current = false;
    }
  }, [driveSignedIn, syncProvider, checkForNewerRemoteSave]);

  // Pick Image Trigger
  const initiateDrivePick = useCallback((): Promise<string | null> => {
    return new Promise((resolve) => {
      setOnDriveImageSelected(() => (url: string) => {
        setIsDrivePickerOpen(false);
        resolve(url);
      });
      setIsDrivePickerOpen(true);
    });
  }, []);

  // Updated Sync Initiation: Peek first
  const initiateCloudPull = useCallback(async () => {
    setIsPeekingCloud(true);
    const data = await driveLoadData();
    setIsPeekingCloud(false);
    if (data) {
        setPendingCloudData(data);
        setSyncConfirmType('pull');
        setIsSyncConfirmOpen(true);
    }
  }, [driveLoadData]);

  const initiateCloudPush = useCallback(async () => {
    setIsPeekingCloud(true);
    const data = await driveLoadData(); // Peek at cloud to show comparison
    setIsPeekingCloud(false);
    setPendingCloudData(data || { collection: [], wantlist: [], lastUpdated: '' });
    setSyncConfirmType('push');
    setIsSyncConfirmOpen(true);
  }, [driveLoadData]);

  const handleConfirmSync = useCallback(async () => {
      if (syncConfirmType === 'pull') {
          if (pendingCloudData) {
              setCollection(pendingCloudData.collection || []);
              setWantlist(pendingCloudData.wantlist || []);
          }
      } else {
          await driveSaveData({ 
              collection, 
              wantlist, 
              lastUpdated: new Date().toISOString() 
          });
      }
      setIsSyncConfirmOpen(false);
      setPendingCloudData(null);
  }, [syncConfirmType, pendingCloudData, collection, wantlist, driveSaveData]);

  useEffect(() => {
    const migrateData = () => {
      let changed = false;
      const newCollection = collection.map(cd => {
        let itemChanged = false;
        let newAttributes = cd.attributes;

        if (newAttributes) {
          if (newAttributes.includes('Tear Front')) {
            itemChanged = true;
            newAttributes = newAttributes.map(attr => attr === 'Tear Front' ? 'Surface Tear' : attr);
          }
          if (newAttributes.includes('Seemsplit')) {
            itemChanged = true;
            newAttributes = newAttributes.map(attr => attr === 'Seemsplit' ? 'Unglued' : attr);
          }
        }

        if (itemChanged) {
          changed = true;
          return { ...cd, attributes: newAttributes };
        }
        return cd;
      });

      const newWantlist = wantlist.map(item => {
        let itemChanged = false;
        let newAttributes = item.attributes;

        if (newAttributes) {
          if (newAttributes.includes('Tear Front')) {
            itemChanged = true;
            newAttributes = newAttributes.map(attr => attr === 'Tear Front' ? 'Surface Tear' : attr);
          }
          if (newAttributes.includes('Seemsplit')) {
            itemChanged = true;
            newAttributes = newAttributes.map(attr => attr === 'Seemsplit' ? 'Unglued' : attr);
          }
        }

        if (itemChanged) {
          changed = true;
          return { ...item, attributes: newAttributes };
        }
        return item;
      });

      if (changed) {
        setCollection(newCollection);
        setWantlist(newWantlist);
      }
    };

    migrateData();
  }, []);

  useEffect(() => { localStorage.setItem('disco_mode', collectionMode); }, [collectionMode]);
  useEffect(() => { localStorage.setItem('disco_sync_provider', syncProvider); }, [syncProvider]);

  useEffect(() => {
    localStorage.setItem('disco_collection', JSON.stringify(collection));
    localStorage.setItem('disco_wantlist', JSON.stringify(wantlist));
  }, [collection, wantlist]);

  const handleToggleMode = useCallback(() => { setCollectionMode(prev => prev === 'cd' ? 'vinyl' : 'cd'); }, []);
  
  const currentSyncStatus: SyncStatus = syncProvider === 'google_drive' ? driveStatus : 'idle';
  const currentSyncError: string | null = syncProvider === 'google_drive' ? driveError : null;

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
      let updatedCollection: CD[] = [];
      if (strategy === 'replace') { 
        updatedCollection = pendingImport;
      } else {
        const existingIds = new Set(collection.map(c => c.id));
        const newItems = pendingImport.filter(c => !existingIds.has(c.id));
        updatedCollection = [...collection, ...newItems];
      }
      setCollection(updatedCollection);
      setPendingImport(null);
      triggerAutoUpload(updatedCollection, wantlist, 'Imported items');
  }, [pendingImport, collection, wantlist, triggerAutoUpload]);

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

  const handleGlobalSearch = useCallback((query: string) => {
    navigate(`/?q=${encodeURIComponent(query)}`);
  }, [navigate]);

  const fetchAndApplyAlbumDetails = async (cd: CD) => {
    if (!cd.genre || !cd.year || !cd.allmusic_url) {
        try {
            const details = await getAlbumDetails(cd.artist, cd.title);
            if (details) {
                const normalizedDetails = normalizeData<CD>(details);
                const updatedCd: CD = {
                    ...cd,
                    genre: cd.genre || normalizedDetails.genre,
                    year: cd.year || normalizedDetails.year,
                    record_label: cd.record_label || normalizedDetails.record_label,
                    allmusic_url: cd.allmusic_url || normalizedDetails.allmusic_url,
                    sort_name: cd.sort_name || normalizedDetails.sort_name,
                    tags: [...new Set([...(cd.tags || []), ...(normalizedDetails.tags || [])])],
                };
                // Save locally only without triggering a background cloud upload
                setCollection(prev => prev.map(c => c.id === cd.id ? updatedCd : c));
            }
        } catch (e) { console.error("Detail fetch error:", e); }
    }
  };

  // Passive update from album views (e.g., auto-resolving Wikipedia URL or viewing details)
  // Saves to local state without triggering Google Drive upload
  const handlePassiveUpdateCD = useCallback(async (updatedCd: CD) => {
    setCollection(prev => prev.map(c => c.id === updatedCd.id ? updatedCd : c));
  }, []);

  const handlePassiveUpdateWantlistItem = useCallback(async (updatedItem: WantlistItem) => {
    setWantlist(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i));
  }, []);

  const handleSaveCD = useCallback(async (cdData: Omit<CD, 'id'> & { id?: string }) => {
    if (!cdData.id && !duplicateCheckResult) {
        const potentialDuplicate = currentCollection.find(c => 
            areStringsSimilar(c.artist, cdData.artist) && areStringsSimilar(c.title, cdData.title)
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
    
    let updatedCollection: CD[] = [];
    if (cdData.id) { 
      updatedCollection = collection.map(c => c.id === cdData.id ? finalCd : c);
    } else { 
      updatedCollection = [finalCd, ...collection];
    }
    setCollection(updatedCollection);

    setIsAddModalOpen(false);
    setCdToEdit(null);
    setPrefillData(null);
    setDuplicateCheckResult(null);

    // Immediately trigger background upload to Google Drive
    triggerAutoUpload(updatedCollection, wantlist, cdData.id ? `Updated ${finalCd.title}` : `Added ${finalCd.title}`);

    fetchAndApplyAlbumDetails(finalCd);
    if (cdData.id) navigate(`/cd/${finalCd.id}`);
  }, [collectionMode, duplicateCheckResult, navigate, currentCollection, collection, wantlist, triggerAutoUpload]);

  const handleDeleteCD = useCallback(async (id: string) => { 
    const updated = collection.filter(cd => cd.id !== id);
    setCollection(updated);
    triggerAutoUpload(updated, wantlist, 'Deleted item');
  }, [collection, wantlist, triggerAutoUpload]);
  
  const handleSaveWantlistItem = useCallback(async (itemData: Omit<WantlistItem, 'id'> & { id?: string }) => {
      const tempId = itemData.id || generateId();
      let finalItem: WantlistItem = { 
          ...itemData, 
          id: tempId, 
          created_at: itemData.created_at || new Date().toISOString(),
          format: itemData.format || collectionMode 
      } as WantlistItem;
      
      let updatedWantlist: WantlistItem[] = [];
      if (itemData.id) { 
        updatedWantlist = wantlist.map(i => i.id === itemData.id ? finalItem : i);
      } else { 
        updatedWantlist = [finalItem, ...wantlist];
      }
      setWantlist(updatedWantlist);

      setIsAddWantlistModalOpen(false);
      setWantlistItemToEdit(null);

      // Immediately trigger background upload to Google Drive
      triggerAutoUpload(collection, updatedWantlist, itemData.id ? `Updated ${finalItem.title}` : `Added ${finalItem.title}`);

      if (itemData.id) navigate(`/wantlist/${finalItem.id}`);
  }, [collectionMode, navigate, wantlist, collection, triggerAutoUpload]);

  const handleDeleteWantlistItem = useCallback(async (id: string) => { 
    const updated = wantlist.filter(item => item.id !== id);
    setWantlist(updated);
    triggerAutoUpload(collection, updated, 'Deleted wantlist item');
  }, [wantlist, collection, triggerAutoUpload]);

  const handleMoveToCollection = useCallback(async (item: WantlistItem) => {
      const cdData: Omit<CD, 'id'> = { ...item, created_at: new Date().toISOString() };
      const tempId = generateId();
      const finalCd: CD = { ...cdData, id: tempId, format: cdData.format || collectionMode } as CD;
      const updatedCollection = [finalCd, ...collection];
      const updatedWantlist = wantlist.filter(i => i.id !== item.id);
      
      setCollection(updatedCollection);
      setWantlist(updatedWantlist);
      triggerAutoUpload(updatedCollection, updatedWantlist, `Moved ${item.title} to collection`);
      fetchAndApplyAlbumDetails(finalCd);
  }, [collectionMode, collection, wantlist, triggerAutoUpload]);

  const location = useLocation();
  const isOnWantlistPage = location.pathname.startsWith('/wantlist');
  const isGoogleDriveSelectedButLoggedOut = syncProvider === 'google_drive' && !driveSignedIn;

  return (
    <div className="min-h-screen pb-20 md:pb-0 font-sans selection:bg-zinc-200 overflow-x-hidden w-full">
      <Header 
        onAddClick={() => {
            if (isOnWantlistPage) { setIsAddWantlistModalOpen(true); setWantlistItemToEdit(null); } 
            else { setIsAddModalOpen(true); setCdToEdit(null); setPrefillData(null); }
        }} 
        collectionCount={currentCollection.length} 
        onImport={handleImport}
        onExport={handleExport}
        onOpenSyncSettings={() => setIsSyncSettingsOpen(true)}
        syncStatus={isPeekingCloud ? 'loading' : currentSyncStatus}
        syncError={currentSyncError}
        syncProvider={syncProvider}
        onCloudPush={initiateCloudPush}
        onCloudPull={initiateCloudPull}
        onSignOut={driveSignOut}
        onSignIn={driveSignIn}
        isSignedIn={driveSignedIn}
        isOnWantlistPage={isOnWantlistPage}
        collectionMode={collectionMode}
        onToggleMode={handleToggleMode}
        lastSyncTime={driveLastSyncTime}
        onSearchClick={() => setIsSearchOpen(true)}
      />
      <main className="container mx-auto p-4 md:p-6 max-w-full overflow-x-hidden">
        {isGoogleDriveSelectedButLoggedOut && (
             <div className="p-8 bg-white rounded-lg border border-zinc-200 max-w-md mx-auto my-8 text-center shadow-xl">
                <h2 className="text-xl font-bold text-zinc-950">Google Drive Sync</h2>
                <p className="text-zinc-700 mt-2">Sign in to your Google account to enable manual Load/Save between devices.</p>
                {driveError && (
                    <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex flex-col gap-3 shadow-inner">
                        <div className="flex items-start gap-2">
                            <XCircleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                            <p className="font-medium">{driveError}</p>
                        </div>
                        <div className="flex gap-4 ml-7">
                            <button 
                                onClick={() => {
                                    driveResetStatus();
                                    // Small delay to let reset happen before re-trying if they want
                                }} 
                                className="text-xs font-bold underline hover:text-red-800"
                            >
                                Reset & Re-initialize
                            </button>
                            {driveReady && (
                                <button 
                                    onClick={driveSignIn} 
                                    className="text-xs font-bold underline hover:text-red-800"
                                >
                                    Try Sign-in Again
                                </button>
                            )}
                        </div>
                    </div>
                )}
                {!driveReady ? (
                    <div className="mt-6 flex flex-col items-center gap-4">
                        <div className="flex items-center gap-3 text-zinc-500">
                            <SpinnerIcon className="w-6 h-6 animate-spin" />
                            <span className="font-medium">Connecting to Google Services...</span>
                        </div>
                        <div className="w-full bg-zinc-100 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-zinc-900 h-full animate-pulse w-2/3"></div>
                        </div>
                        <p className="text-xs text-zinc-500 max-w-[280px]">
                            This usually takes a few seconds. If it's taking too long, try refreshing the page or clicking reset below.
                        </p>
                        {driveError && (
                            <button 
                                onClick={driveResetStatus} 
                                className="w-full bg-zinc-900 text-white font-bold py-3 px-6 rounded-lg hover:bg-black transition-all"
                            >
                                Retry Initialization
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        <button onClick={driveSignIn} disabled={driveStatus === 'authenticating'} className="mt-6 w-full bg-zinc-900 text-white font-bold py-3 px-6 rounded-lg hover:bg-black transition-all transform active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50">
                            {driveStatus === 'authenticating' && <SpinnerIcon className="w-5 h-5" />}
                            {driveStatus === 'authenticating' ? 'Signing in...' : 'Sign in with Google'}
                        </button>
                    </div>
                )}
             </div>
        )}
        <Routes>
          <Route path="/" element={<ListView cds={currentCollection} onRequestAdd={(artist) => { setPrefillData(artist ? { artist } : null); setIsAddModalOpen(true); }} onRequestEdit={(cd) => { setCdToEdit(cd); setIsAddModalOpen(true); }} collectionMode={collectionMode} />} />
          <Route path="/cd/:id" element={<DetailView cds={currentCollection} onDeleteCD={handleDeleteCD} onUpdateCD={handlePassiveUpdateCD} collectionMode={collectionMode} />} />
          <Route path="/artists" element={<ArtistsView cds={currentCollection} collectionMode={collectionMode} />} />
          <Route path="/artist/:artistName" element={<ArtistDetailView cds={currentCollection} collectionMode={collectionMode} />} />
          <Route path="/stats" element={<DashboardView cds={currentCollection} collectionMode={collectionMode} />} />
          <Route path="/shelf" element={<ShelfView cds={currentCollection} collectionMode={collectionMode} />} />
          <Route path="/duplicates" element={<DuplicatesView cds={currentCollection} onDeleteCD={handleDeleteCD} collectionMode={collectionMode} />} />
          <Route path="/wantlist" element={<WantlistView wantlist={currentWantlist} onRequestEdit={(item) => { setWantlistItemToEdit(item); setIsAddWantlistModalOpen(true); }} onDelete={handleDeleteWantlistItem} onMoveToCollection={handleMoveToCollection} collectionMode={collectionMode} />} />
          <Route path="/wantlist/:id" element={<WantlistDetailView wantlist={currentWantlist} cds={currentCollection} onDelete={handleDeleteWantlistItem} onUpdate={handlePassiveUpdateWantlistItem} onMoveToCollection={handleMoveToCollection} collectionMode={collectionMode} />} />
        </Routes>
      </main>
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="w-full max-w-3xl my-8 shadow-2xl">
            <AddCDForm 
              onSave={handleSaveCD} 
              onCancel={() => { setIsAddModalOpen(false); setCdToEdit(null); setPrefillData(null); }} 
              cdToEdit={cdToEdit} 
              prefill={prefillData} 
              isVinyl={collectionMode === 'vinyl'} 
              driveSignedIn={driveSignedIn}
              onPickFromDrive={initiateDrivePick}
            />
          </div>
        </div>
      )}
      {isAddWantlistModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto">
            <div className="w-full max-w-3xl my-8 shadow-2xl">
                <AddWantlistItemForm 
                  onSave={handleSaveWantlistItem} 
                  onCancel={() => { setIsAddWantlistModalOpen(false); setWantlistItemToEdit(null); }} 
                  itemToEdit={wantlistItemToEdit} 
                  isVinyl={collectionMode === 'vinyl'} 
                  driveSignedIn={driveSignedIn}
                  onPickFromDrive={initiateDrivePick}
                />
            </div>
        </div>
      )}
      {duplicateCheckResult && <ConfirmDuplicateModal isOpen={true} onClose={() => setDuplicateCheckResult(null)} onConfirm={(version) => handleSaveCD({ ...duplicateCheckResult.newCd, version })} newCdData={duplicateCheckResult.newCd} existingCd={duplicateCheckResult.existingCd} />}
      <ImportConfirmModal isOpen={!!pendingImport} onClose={() => setPendingImport(null)} onMerge={() => confirmImport('merge')} onReplace={() => confirmImport('replace')} importCount={pendingImport?.length || 0} />
      <SyncSettingsModal 
        isOpen={isSyncSettingsOpen} 
        onClose={() => setIsSyncSettingsOpen(false)} 
        currentProvider={syncProvider} 
        onProviderChange={setSyncProvider} 
        syncMode="manual" 
        onSyncModeChange={() => {}} 
        isSignedIn={driveSignedIn}
        onSignIn={driveSignIn}
      />
      <SyncConfirmationModal 
        isOpen={isSyncConfirmOpen}
        onClose={() => setIsSyncConfirmOpen(false)}
        onConfirm={handleConfirmSync}
        type={syncConfirmType}
        isProcessing={driveStatus === 'saving' || driveStatus === 'loading'}
        localStats={{
            count: collection.length + wantlist.length,
            lastUpdated: new Date().toISOString()
        }}
        cloudStats={{
            count: (pendingCloudData?.collection?.length || 0) + (pendingCloudData?.wantlist?.length || 0),
            lastUpdated: pendingCloudData?.lastUpdated || null
        }}
      />
      
      <DriveImagePickerModal 
        isOpen={isDrivePickerOpen}
        onClose={() => {
            setIsDrivePickerOpen(false);
            if (onDriveImageSelected) setOnDriveImageSelected(null);
        }}
        onSelect={(url) => {
            if (onDriveImageSelected) onDriveImageSelected(url);
        }}
        fetchImages={driveFetchImages}
      />

      <SearchOverlay 
        isOpen={isSearchOpen} 
        onClose={() => setIsSearchOpen(false)} 
        onSearch={handleGlobalSearch} 
        albumType={collectionMode === 'vinyl' ? 'Vinyl' : 'CD'}
      />

      <BottomNavBar collectionMode={collectionMode} onToggleMode={handleToggleMode} onSearchClick={() => setIsSearchOpen(true)} />
      <button onClick={() => { if (isOnWantlistPage) { setWantlistItemToEdit(null); setIsAddWantlistModalOpen(true); } else { setCdToEdit(null); setPrefillData(null); setIsAddModalOpen(true); } }} className="md:hidden fixed bottom-20 right-4 w-14 h-14 bg-zinc-900 text-white rounded-full shadow-xl flex items-center justify-center z-30"><PlusIcon className="h-6 w-6" /></button>

      {/* Non-intrusive auto-sync toast indicator */}
      <AutoSyncBanner 
        notification={autoSyncBanner} 
        onDismiss={() => setAutoSyncBanner(null)} 
      />
    </div>
  );
};

const App: React.FC = () => (<HashRouter><ScrollToTop /><AppContent /></HashRouter>);
export default App;