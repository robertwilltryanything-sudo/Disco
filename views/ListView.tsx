import React, { useState, useMemo, useEffect, useCallback, useTransition } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { CD, SortKey, SortOrder, CollectionMode } from '../types';
import CDList from '../components/CDList';
import SearchBar from '../components/SearchBar';
import SortControls from '../components/SortControls';
import { PlusIcon } from '../components/icons/PlusIcon';
import FeaturedAlbum from '../components/FeaturedAlbum';
import QuickStats from '../components/CollectionStats';
import { Squares2x2Icon } from '../components/icons/Squares2x2Icon';
import { QueueListIcon } from '../components/icons/QueueListIcon';
import CDTable from '../components/CDTable';
import { getArtistStudioDiscography } from '../gemini';
import { areStringsSimilar } from '../utils';

interface ListViewProps {
  cds: CD[];
  onRequestAdd: (artist?: string) => void;
  onRequestEdit: (cd: CD) => void;
  collectionMode: CollectionMode;
}

const VIEW_MODE_KEY = 'disco_view_mode';

const ListView: React.FC<ListViewProps> = ({ cds, onRequestAdd, onRequestEdit, collectionMode }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlSearchQuery = searchParams.get('q') || '';
  const urlArtistFilter = searchParams.get('artist') || '';
  const urlSortBy = searchParams.get('sort') as SortKey | null;
  const urlSortOrder = searchParams.get('order') as SortOrder | null;

  const [sortBy, setSortBy] = useState<SortKey>(urlSortBy || 'created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>(urlSortOrder || 'desc');
  const [featuredCd, setFeaturedCd] = useState<CD | null>(null);
  const [view, setView] = useState<'grid' | 'list'>(() => {
    const storedView = localStorage.getItem(VIEW_MODE_KEY);
    return storedView === 'list' ? 'list' : 'grid';
  });

  const [fullDiscography, setFullDiscography] = useState<{ title: string; year: number }[] | null>(null);
  const [isLoadingDiscography, setIsLoadingDiscography] = useState(false);
  const [discographyError, setDiscographyError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setFullDiscography(null);
    setDiscographyError(null);

    if (!urlArtistFilter) return;

    async function fetchDiscography() {
      setIsLoadingDiscography(true);
      try {
        const disc = await getArtistStudioDiscography(urlArtistFilter);
        if (isMounted) {
          if (disc) {
            setFullDiscography(disc);
          } else {
            setDiscographyError("To view missing albums, please ensure your Gemini API key is configured.");
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setDiscographyError(err?.message || "Failed to load discography.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingDiscography(false);
        }
      }
    }

    fetchDiscography();

    return () => {
      isMounted = false;
    };
  }, [urlArtistFilter]);

  const userAlbumsByArtist = useMemo(() => {
    if (!urlArtistFilter) return [];
    return cds.filter(cd => areStringsSimilar(cd.artist, urlArtistFilter));
  }, [cds, urlArtistFilter]);

  const missingAlbums = useMemo(() => {
    if (!fullDiscography) return [];

    return fullDiscography.filter(discAlbum => {
      // Check if the user already owns this album
      const isOwned = userAlbumsByArtist.some(userAlbum => {
        const clean = (s: string) => s.toLowerCase()
          .replace(/\(.*?\)/g, '') // remove anything in parentheses (special editions, remasters, etc.)
          .replace(/\[.*?\]/g, '') // remove anything in brackets
          .replace(/[^a-z0-9]/g, '') // keep only alphanumeric for robust matching
          .trim();

        const cleanDisc = clean(discAlbum.title);
        const cleanUser = clean(userAlbum.title);

        // Exact match on cleaned string
        if (cleanDisc === cleanUser) return true;

        // One is a close substring of the other (handles "The Album" vs "Album" or vice versa)
        if (cleanDisc.includes(cleanUser) || cleanUser.includes(cleanDisc)) {
          if (Math.abs(cleanDisc.length - cleanUser.length) < 8) return true;
        }

        // Fallback to Levenshtein check
        return areStringsSimilar(discAlbum.title, userAlbum.title, 0.8);
      });

      return !isOwned;
    });
  }, [fullDiscography, userAlbumsByArtist]);

  const handleSortBy = useCallback((key: SortKey) => {
    setSortBy(key);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('sort', key);
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleSortOrder = useCallback((order: SortOrder | ((prev: SortOrder) => SortOrder)) => {
    setSortOrder(prev => {
      const next = typeof order === 'function' ? order(prev) : order;
      const newParams = new URLSearchParams(searchParams);
      newParams.set('order', next);
      setSearchParams(newParams, { replace: true });
      return next;
    });
  }, [searchParams, setSearchParams]);

  const focusSearchIntent = searchParams.get('focus') === 'search';

  const [, startTransition] = useTransition();

  const handleSearch = useCallback((query: string) => {
    startTransition(() => {
      const newParams = new URLSearchParams(searchParams);
      if (query) {
        newParams.set('q', query);
      } else {
        newParams.delete('q');
      }
      // Clear artist filter when manual search is performed
      newParams.delete('artist');
      newParams.delete('focus');
      setSearchParams(newParams, { replace: true });
    });
  }, [searchParams, setSearchParams]);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setSortBy(urlSortBy || 'created_at');
    setSortOrder(urlSortOrder || 'desc');
  }, [urlSortBy, urlSortOrder]);

  useEffect(() => {
    localStorage.setItem(VIEW_MODE_KEY, view);
  }, [view]);

  useEffect(() => {
    if (focusSearchIntent) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        const input = document.getElementById('search-input');
        if (input) {
            input.focus();
        }
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('focus');
        setSearchParams(newParams, { replace: true });
    }
  }, [focusSearchIntent, searchParams, setSearchParams]);

  useEffect(() => {
    const { editCdId, addAlbumForArtist } = location.state || {};
    let stateWasHandled = false;

    if (editCdId) {
      const cd = cds.find(c => c.id === editCdId);
      if (cd) {
        onRequestEdit(cd);
        stateWasHandled = true;
      }
    } else if (addAlbumForArtist) {
        onRequestAdd(addAlbumForArtist);
        stateWasHandled = true;
    }

    if (stateWasHandled) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, cds, navigate, onRequestEdit, onRequestAdd]);

  useEffect(() => {
    if (cds.length === 0) {
        if (featuredCd !== null) setFeaturedCd(null);
        return;
    }

    const storageKey = `disco_featured_album_${collectionMode}`;
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const isSunday = now.getDay() === 0;

    const storedDataRaw = localStorage.getItem(storageKey);
    let storedData: { cdId: string; date: string } | null = null;
    
    if (storedDataRaw) {
      try {
        storedData = JSON.parse(storedDataRaw);
      } catch (e) {
        localStorage.removeItem(storageKey);
      }
    }
    
    const currentFeaturedInCollection = storedData ? cds.find(cd => cd.id === storedData.cdId) : null;
    
    // Rotation logic:
    // 1. If no featured album exists.
    // 2. If it is Sunday AND we haven't already performed a rotation TODAY.
    // 3. If the currently featured album was deleted from the collection.
    const needsRotation = !storedData || (isSunday && storedData.date !== today) || !currentFeaturedInCollection;

    if (needsRotation) {
        let pool = cds;
        if (storedData && cds.length > 1) {
            pool = cds.filter(cd => cd.id !== storedData?.cdId);
        }
        const randomIndex = Math.floor(Math.random() * pool.length);
        const newSelection = pool[randomIndex];
        
        if (newSelection) {
            localStorage.setItem(storageKey, JSON.stringify({
                cdId: newSelection.id,
                date: today,
            }));
            if (featuredCd?.id !== newSelection.id) {
                setFeaturedCd(newSelection);
            }
        }
    } else if (currentFeaturedInCollection && featuredCd?.id !== currentFeaturedInCollection.id) {
        setFeaturedCd(currentFeaturedInCollection);
    }
  }, [cds, collectionMode, featuredCd?.id]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [urlSearchQuery, urlArtistFilter]);

  const filteredAndSortedCds = useMemo(() => {
    const filtered = [...cds]
      .filter(cd => {
        if (!cd) return false;

        // Priority 1: Exact Artist Filter (from URL param 'artist')
        if (urlArtistFilter) {
            return cd.artist && cd.artist.toLowerCase() === urlArtistFilter.toLowerCase();
        }

        const trimmedQuery = urlSearchQuery.trim();
        const lowerCaseQuery = trimmedQuery.toLowerCase();
        
        if (!lowerCaseQuery) return true;

        // Check for exact artist match prefix: artist:"Artist Name"
        const artistMatch = trimmedQuery.match(/^artist:"(.+)"$/i);
        if (artistMatch) {
            const exactArtist = artistMatch[1].toLowerCase();
            return cd.artist && cd.artist.toLowerCase() === exactArtist;
        }

        const isNumericQuery = !isNaN(Number(lowerCaseQuery)) && lowerCaseQuery.length > 0;
        const isDecadeSearch = isNumericQuery && lowerCaseQuery.length === 4 && lowerCaseQuery.endsWith('0');
        const yearMatches = cd.year != null && (
          isDecadeSearch
            ? (cd.year >= Number(lowerCaseQuery) && cd.year <= Number(lowerCaseQuery) + 9)
            : cd.year.toString().includes(lowerCaseQuery)
        );
        return (
          (cd.artist && cd.artist.toLowerCase().includes(lowerCaseQuery)) ||
          (cd.title && cd.title.toLowerCase().includes(lowerCaseQuery)) ||
          yearMatches ||
          (cd.genre && cd.genre.some(g => g && g.toLowerCase().includes(lowerCaseQuery))) ||
          (cd.record_label && cd.record_label.toLowerCase().includes(lowerCaseQuery)) ||
          (cd.tags && cd.tags.some(tag => tag && tag.toLowerCase().includes(lowerCaseQuery))) ||
          (cd.attributes && cd.attributes.some(attr => attr && attr.toLowerCase().includes(lowerCaseQuery)))
        );
      });
    
    const sorted = [...filtered]
      .sort((a, b) => {
        let valA = a[sortBy];
        let valB = b[sortBy];
        
        if (sortBy === 'artist') {
          valA = a.sort_name || a.artist;
          valB = b.sort_name || b.artist;
        }
        
        if (sortBy === 'genre') {
          valA = Array.isArray(valA) ? valA[0] : valA;
          valB = Array.isArray(valB) ? valB[0] : valB;
        }
        
        if (valA === undefined || valA === null) return 1;
        if (valB === undefined || valB === null) return -1;

        let comparison = 0;
        if (typeof valA === 'string' && typeof valB === 'string') {
          comparison = valA.localeCompare(valB);
        } else if (typeof valA === 'number' && typeof valB === 'number') {
          comparison = valA - valB;
        }

        // Multi-level sorting logic
        if (comparison === 0) {
            // Secondary Sort Keys
            if (sortBy === 'artist') {
                // Artist -> Year -> Title
                comparison = (a.year || 0) - (b.year || 0);
                if (comparison === 0) {
                    comparison = (a.title || '').localeCompare(b.title || '');
                }
            } else if (sortBy === 'genre' || sortBy === 'record_label') {
                // Genre/Label -> Artist -> Year -> Title
                comparison = (a.artist || '').localeCompare(b.artist || '');
                if (comparison === 0) {
                    comparison = (a.year || 0) - (b.year || 0);
                    if (comparison === 0) {
                        comparison = (a.title || '').localeCompare(b.title || '');
                    }
                }
            } else if (sortBy === 'year') {
                // Year -> Artist -> Title
                comparison = (a.artist || '').localeCompare(b.artist || '');
                if (comparison === 0) {
                    comparison = (a.title || '').localeCompare(b.title || '');
                }
            } else if (sortBy === 'created_at') {
                // CreatedAt -> Artist -> Year
                comparison = (a.artist || '').localeCompare(b.artist || '');
            } else {
                // Default fallback
                comparison = (a.artist || '').localeCompare(b.artist || '');
            }
        }

        return sortOrder === 'asc' ? comparison : -comparison;
      });

    return sorted;
  }, [cds, urlSearchQuery, urlArtistFilter, sortBy, sortOrder]);

  const albumType = collectionMode === 'vinyl' ? 'Vinyl' : 'CD';

  return (
    <div>
      {(!urlSearchQuery && !urlArtistFilter) && (
        <div className="lg:flex lg:gap-6 mb-8">
          <div className="lg:w-2/3">
            {featuredCd ? (
              <FeaturedAlbum cd={featuredCd} />
            ) : (
              <div className="bg-white rounded-lg border border-zinc-200 p-6 flex flex-col items-center justify-center h-full text-center min-h-[256px]">
                <h3 className="text-xl font-bold text-zinc-950">Welcome to DiscO!</h3>
                <p className="text-zinc-700 mt-2">Your {collectionMode} collection is empty. Add your first {albumType} to get started.</p>
                <button
                  onClick={() => onRequestAdd()}
                  className="mt-4 flex items-center justify-center gap-2 bg-zinc-900 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900"
                >
                  <PlusIcon className="h-5 w-5" />
                  Add a {albumType}
                </button>
              </div>
            )}
          </div>
          <div className="hidden lg:block lg:w-1/3 mt-6 lg:mt-0">
            <QuickStats cds={cds} collectionMode={collectionMode} />
          </div>
        </div>
      )}
      
      <div className="py-4 mb-6 space-y-4">
        {/* Row 1: Search */}
        <div className="w-full">
          <SearchBar initialQuery={urlSearchQuery} onSearch={handleSearch} albumType={albumType} />
        </div>
        
        {/* Row 2: Sort & View Options */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="w-full sm:w-auto">
            <SortControls sortBy={sortBy} setSortBy={handleSortBy} sortOrder={sortOrder} setSortOrder={handleSortOrder} />
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center gap-1 p-1 bg-zinc-200 rounded-lg">
                <button 
                  onClick={() => setView('grid')} 
                  className={`p-1.5 rounded-md transition-all ${view === 'grid' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-600 hover:text-zinc-800'}`}
                  aria-label="Grid View"
                  title="Grid View"
                >
                    <Squares2x2Icon className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setView('list')}
                  className={`p-1.5 rounded-md transition-all ${view === 'list' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-600 hover:text-zinc-800'}`}
                  aria-label="List View"
                  title="List View"
                >
                    <QueueListIcon className="w-5 h-5" />
                </button>
            </div>
          </div>
        </div>
      </div>
      
      {view === 'grid' ? (
        <CDList cds={filteredAndSortedCds} albumType={albumType} />
      ) : (
        <CDTable cds={filteredAndSortedCds} onRequestEdit={onRequestEdit} albumType={albumType} />
      )}

      {urlArtistFilter && (
        <div className="mt-8 bg-zinc-50 rounded-lg border border-zinc-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-lg font-bold text-zinc-800">Missing Main Studio Albums by {urlArtistFilter}</h2>
              <p className="text-xs text-zinc-500">Studio releases currently missing from your collection (ordered chronologically)</p>
            </div>
            {isLoadingDiscography && (
              <div className="flex items-center gap-1.5 text-xs text-zinc-500 bg-white border border-zinc-200 rounded-full px-2.5 py-1">
                <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-zinc-500 border-t-transparent"></div>
                <span>Fetching discography...</span>
              </div>
            )}
          </div>

          {discographyError && (
            <p className="text-xs text-zinc-500 bg-zinc-100 border border-zinc-200 rounded-md p-3 mt-3">{discographyError}</p>
          )}

          {!isLoadingDiscography && !discographyError && fullDiscography !== null && missingAlbums.length === 0 && (
            <div className="text-center py-4 bg-white border border-dashed border-zinc-200 rounded-md mt-3">
              <p className="text-zinc-600 text-sm font-medium">🎉 Congratulations! You have all of their main studio albums.</p>
            </div>
          )}

          {missingAlbums.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
              {missingAlbums.map((album, idx) => (
                <div key={idx} className="flex items-center justify-between bg-white border border-zinc-150 rounded-md p-2.5 shadow-xs hover:border-zinc-300 transition-colors">
                  <span className="font-medium text-zinc-700 text-sm truncate mr-2" title={album.title}>
                    {album.title}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 bg-zinc-100 text-zinc-600 rounded shrink-0">
                    {album.year}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ListView;