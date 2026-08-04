import React, { useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { CD, CollectionMode } from '../types';
import { ArrowLeftIcon } from '../components/icons/ArrowLeftIcon';
import { MusicNoteIcon } from '../components/icons/MusicNoteIcon';
import { EditIcon } from '../components/icons/EditIcon';
import { ArrowRightIcon } from '../components/icons/ArrowRightIcon';
import { WikipediaIcon } from '../components/icons/WikipediaIcon';
import RecommendedCDItem from '../components/RecommendedCDItem';
import { TrashIcon } from '../components/icons/TrashIcon';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import { SparklesIcon } from '../components/icons/SparklesIcon';
import { SpinnerIcon } from '../components/icons/SpinnerIcon';
import { getBrandColor } from '../utils';
import { getAlbumDetails } from '../gemini';
import { searchWikipediaForArticle } from '../wikipedia';
import { PlexIcon } from '../components/icons/PlexIcon';
import { openInPlexamp, getPlexWebSearchUrl, getPlexConfig, searchPlexLibrary } from '../plex';

interface DetailViewProps {
  cds: CD[];
  onDeleteCD: (id: string) => void;
  onUpdateCD: (cd: CD) => Promise<void>;
  collectionMode: CollectionMode;
}

const VINYL_MEDIA_CONDITION = ["Hairlines", "Scratches", "Warped", "Snap, Crackle & Pop"];
const VINYL_COVER_CONDITION = ["Ringwear", "Unglued", "Price Sticker", "Water Damage", "Surface Tear", "Cut Out"];

const CD_MEDIA_CONDITION = ["Scratches", "Hairlines", "Sticky"];
const CD_COVER_CONDITION = ["Replace Case", "Price Sticker", "Surface Tear", "Water damage"];

const DetailView: React.FC<DetailViewProps> = ({ cds, onDeleteCD, onUpdateCD, collectionMode }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [plexampNotice, setPlexampNotice] = useState<string | null>(null);
  const [isPlexModalOpen, setIsPlexModalOpen] = useState(false);
  const [plexInputUrl, setPlexInputUrl] = useState('');
  const [isDetectingPlex, setIsDetectingPlex] = useState(false);

  const handleOpenPlexModal = () => {
    setPlexInputUrl(cd?.plex_url || '');
    setIsPlexModalOpen(true);
  };

  const handleSavePlexUrl = async () => {
    if (!cd) return;
    await onUpdateCD({ ...cd, plex_url: plexInputUrl.trim() });
    setIsPlexModalOpen(false);
    setPlexampNotice('Plex direct link saved successfully!');
    setTimeout(() => setPlexampNotice(null), 4000);
  };

  const handleAutoDetectPlex = async () => {
    if (!cd) return;
    setIsDetectingPlex(true);
    setPlexampNotice('Searching Plex Media Server for album...');
    const result = await searchPlexLibrary(cd.artist, cd.title);
    setIsDetectingPlex(false);
    if (result && (result.hostedWebUrl || result.webUrl)) {
      const urlToUse = result.hostedWebUrl || result.webUrl;
      setPlexInputUrl(urlToUse);
      await onUpdateCD({ ...cd, plex_url: urlToUse });
      setPlexampNotice(`Found exact match on Plex Media Server! Direct album link saved.`);
      setTimeout(() => setPlexampNotice(null), 5000);
      setIsPlexModalOpen(false);
    } else {
      setPlexampNotice('Could not find item on connected Plex Server. Ensure Server Host & Token are configured in Plex Settings.');
      setTimeout(() => setPlexampNotice(null), 6000);
    }
  };

  const handlePlexampLaunch = async () => {
    if (!cd) return;
    if (cd.plex_url) {
      window.open(cd.plex_url, '_blank');
      return;
    }
    const { query, copied } = await openInPlexamp(cd.artist, cd.title);
    if (copied) {
      setPlexampNotice(`Copied "${query}" to clipboard & opened Plexamp! Press Ctrl+V (Cmd+V) in Plexamp search.`);
    } else {
      setPlexampNotice(`Opening Plexamp for "${query}"`);
    }
    setTimeout(() => setPlexampNotice(null), 8000);
  };

  const { cd, previousCd, nextCd } = useMemo(() => {
    const currentIndex = cds.findIndex(c => c.id === id);
    if (currentIndex === -1) return { cd: null, previousCd: null, nextCd: null };
    return { cd: cds[currentIndex], previousCd: cds[currentIndex - 1] || null, nextCd: cds[currentIndex + 1] || null };
  }, [cds, id]);

  const recommendations = useMemo(() => {
    if (!cd) return [];
    const MAX = 4;
    const recs = cds.filter(c => c.id !== cd.id && (c.artist === cd.artist || c.genre === cd.genre));
    return recs.slice(0, MAX);
  }, [cd, cds]);

  const albumType = collectionMode === 'vinyl' ? 'Vinyl' : 'CD';
  
  const wikipediaUrl = useMemo(() => {
    if (!cd) return '';
    if (cd.wikipedia_url) return cd.wikipedia_url;
    // Using Special:Search with go=Go attempts to redirect directly to the article if a match is found
    return `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(cd.artist)}+${encodeURIComponent(cd.title)}+album&go=Go`;
  }, [cd]);

  // Auto-resolve missing Wikipedia URL
  React.useEffect(() => {
    if (cd && !cd.wikipedia_url) {
      const resolveWiki = async () => {
        try {
          const title = await searchWikipediaForArticle(cd.artist, cd.title);
          if (title) {
            const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`;
            onUpdateCD({ ...cd, wikipedia_url: url });
          }
        } catch (e) {
          console.warn("Failed to auto-resolve Wikipedia URL", e);
        }
      };
      resolveWiki();
    }
  }, [cd?.id, cd?.wikipedia_url]);

  const handleSearchFilter = (value: string | number | undefined) => {
    if (value) {
      navigate({ pathname: '/', search: `?q=${encodeURIComponent(value.toString())}` });
    }
  };

  const handleUpdateInfo = useCallback(async () => {
    if (!cd || isUpdating) return;
    setIsUpdating(true);
    try {
      const details = await getAlbumDetails(cd.artist, cd.title);
      if (details) {
        const updatedCd: CD = {
          ...cd,
          genre: details.genre || cd.genre,
          year: details.year || cd.year,
          record_label: cd.record_label || details.record_label,
          producer: details.producer || cd.producer,
          wikipedia_url: details.wikipedia_url || cd.wikipedia_url,
          review: details.review || cd.review,
          tags: [...new Set([...(cd.tags || []), ...(details.tags || [])])]
        };
        await onUpdateCD(updatedCd);
      } else {
        alert("Gemini couldn't find any additional info for this album.");
      }
    } catch (error: any) {
      console.error("Update error:", error);
      alert(error.message || "Failed to connect to the AI service. Please check your internet and try again.");
    } finally {
      setIsUpdating(false);
    }
  }, [cd, isUpdating, onUpdateCD]);

  const { mediaTraits, coverTraits, physicalAttributes } = useMemo(() => {
    if (!cd || !cd.attributes) return { mediaTraits: [], coverTraits: [], physicalAttributes: [] };
    const mediaList = cd.format === 'vinyl' ? VINYL_MEDIA_CONDITION : CD_MEDIA_CONDITION;
    const coverList = cd.format === 'vinyl' ? VINYL_COVER_CONDITION : CD_COVER_CONDITION;
    
    const media = cd.attributes.filter(a => mediaList.includes(a));
    const cover = cd.attributes.filter(a => coverList.includes(a));
    const phys = cd.attributes.filter(a => !mediaList.includes(a) && !coverList.includes(a));
    
    return { mediaTraits: media, coverTraits: cover, physicalAttributes: phys };
  }, [cd]);

  if (!cd) return <div className="text-center p-8"><h2 className="text-2xl font-bold text-red-600">{albumType} Not Found</h2><Link to="/" className="mt-6 inline-flex items-center gap-2 bg-zinc-900 text-white font-bold py-2 px-4 rounded-lg"> <ArrowLeftIcon className="h-5 w-5" />Back to Collection</Link></div>;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6"><Link to="/" className="inline-flex items-center gap-2 text-zinc-700 font-medium"><ArrowLeftIcon className="h-5 w-5" />Back to Collection</Link></div>
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-sm relative group/card">
        <div className="md:flex">
            <div className="md:flex-shrink-0 md:w-80">
                {cd.cover_art_url ? (
                    <img 
                      src={cd.cover_art_url} 
                      alt={`${cd.title} cover`} 
                      className="w-full aspect-square object-cover" 
                      referrerPolicy="no-referrer"
                    />
                ) : (
                    <div className="w-full aspect-square bg-zinc-50 flex items-center justify-center"><MusicNoteIcon className="w-24 h-24 text-zinc-300" /></div>
                )}
            </div>
            <div className="p-6 md:p-8 flex flex-col flex-grow min-h-0">
              <div className="flex flex-col mb-6">
                  <h1 className="text-xl font-bold text-zinc-950 leading-tight">{cd.title}</h1>
                  <h2 
                    className="text-base text-zinc-600 hover:text-zinc-950 transition-colors mt-1 cursor-pointer" 
                    onClick={() => navigate({ pathname: '/', search: `?artist=${encodeURIComponent(cd.artist)}&sort=year&order=asc` })}
                  >
                    {cd.artist}
                  </h2>
              </div>

              <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm border-t border-zinc-100 pt-6">
                  {cd.year && (
                    <div>
                      <p className="text-zinc-500 font-bold uppercase tracking-wider text-[10px]">Year</p>
                      <button 
                        onClick={() => handleSearchFilter(cd.year)}
                        className="text-zinc-950 font-medium hover:text-zinc-700 transition-colors"
                      >
                        {cd.year}
                      </button>
                    </div>
                  )}
                  {cd.genre && cd.genre.length > 0 && (
                    <div>
                      <p className="text-zinc-500 font-bold uppercase tracking-wider text-[10px]">Genre</p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {cd.genre.map((g, idx) => (
                          <button 
                            key={idx}
                            onClick={() => handleSearchFilter(g)}
                            className={`${getBrandColor(g)} text-zinc-950 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-tight shadow-sm border border-black/5 hover:opacity-80 transition-opacity`}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {cd.record_label && <div><p className="text-zinc-500 font-bold uppercase tracking-wider text-[10px]">Label</p><p className="text-zinc-950 font-medium">{cd.record_label}</p></div>}
                  {cd.country && <div><p className="text-zinc-500 font-bold uppercase tracking-wider text-[10px]">Country</p><p className="text-zinc-950 font-medium">{cd.country}</p></div>}
                  {cd.producer && <div><p className="text-zinc-500 font-bold uppercase tracking-wider text-[10px]">Producer</p><p className="text-zinc-950 font-medium">{cd.producer}</p></div>}
                  {cd.version && <div><p className="text-zinc-500 font-bold uppercase tracking-wider text-[10px]">Version</p><p className="text-zinc-950 font-medium">{cd.version}</p></div>}
              </div>

              {cd.review && (
                <div className="mt-6 pt-6 border-t border-zinc-100">
                  <p className="text-zinc-500 font-bold uppercase tracking-wider text-[10px] mb-2 flex items-center gap-1.5">
                    <SparklesIcon className="w-3 h-3" />
                    Album Review
                  </p>
                  <p className="text-zinc-800 text-sm leading-relaxed font-medium italic">
                    "{cd.review}"
                  </p>
                </div>
              )}

              {mediaTraits.length > 0 && (
                <div className="mt-6 pt-6 border-t border-zinc-100">
                  <p className="text-zinc-500 font-bold uppercase tracking-wider text-[10px] mb-2">MEDIA CONDITION</p>
                  <div className="flex flex-wrap gap-2">
                    {mediaTraits.map(attr => (
                      <button 
                        key={attr} 
                        onClick={() => handleSearchFilter(attr)}
                        className={`${getBrandColor(attr)} text-zinc-900 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-tight shadow-sm border border-black/5 hover:opacity-80 transition-opacity cursor-pointer`}
                      >
                        {attr}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {coverTraits.length > 0 && (
                <div className="mt-6 pt-6 border-t border-zinc-100">
                  <p className="text-zinc-500 font-bold uppercase tracking-wider text-[10px] mb-2">COVER CONDITION</p>
                  <div className="flex flex-wrap gap-2">
                    {coverTraits.map(attr => (
                      <button 
                        key={attr} 
                        onClick={() => handleSearchFilter(attr)}
                        className={`${getBrandColor(attr)} text-zinc-900 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-tight shadow-sm border border-black/5 hover:opacity-80 transition-opacity cursor-pointer`}
                      >
                        {attr}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {physicalAttributes.length > 0 && (
                <div className="mt-6 pt-6 border-t border-zinc-100">
                  <p className="text-zinc-500 font-bold uppercase tracking-wider text-[10px] mb-2">PHYSICAL ATTRIBUTES</p>
                  <div className="flex flex-wrap gap-2">
                    {physicalAttributes.map(attr => (
                      <button 
                        key={attr} 
                        onClick={() => handleSearchFilter(attr)}
                        className={`${getBrandColor(attr)} text-zinc-900 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-tight shadow-sm border border-black/5 hover:opacity-80 transition-opacity cursor-pointer`}
                      >
                        {attr}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {cd.notes && <div className="mt-6 pt-6 border-t border-zinc-100"><h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Notes</h3><p className="text-zinc-700 italic">"{cd.notes}"</p></div>}

              {cd.tags && cd.tags.length > 0 && (
                <div className="mt-6 pt-6 border-t border-zinc-100">
                  <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {cd.tags.map(tag => (
                      <button
                        key={tag}
                        onClick={() => handleSearchFilter(tag)}
                        className={`${getBrandColor(tag)} text-zinc-950 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-tight shadow-sm border border-black/5 hover:opacity-80 transition-opacity`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Bottom Actions Row - Aligned Straight */}
              <div className="mt-auto pt-8 flex flex-col gap-2 border-t border-zinc-50">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {(() => {
                    const plexConfig = getPlexConfig();
                    const plexWebUrl = getPlexWebSearchUrl(cd.artist, cd.title, plexConfig.serverHost, cd.plex_url);
                    return (
                      <div className="flex flex-wrap items-center gap-2">
                        <a 
                          href={plexWebUrl} 
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2 px-3.5 rounded-lg transition-colors text-sm shadow-xs"
                          title={cd.plex_url ? `Open exact Plex item link` : `Search ${cd.title} by ${cd.artist} on Plex Web`}
                        >
                          <PlexIcon className="w-5 h-5" />
                          <span>{cd.plex_url ? 'Open in Plex' : 'Search Plex Web'}</span>
                        </a>

                        <button 
                          onClick={handlePlexampLaunch}
                          className="inline-flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-950 text-white font-semibold py-2 px-3 rounded-lg transition-colors text-sm shadow-xs cursor-pointer"
                          title={`Launch Plexamp App & Copy Query`}
                        >
                          <PlexIcon className="w-4 h-4 text-amber-400" />
                          <span>Plexamp App</span>
                        </button>

                        <button
                          onClick={handleOpenPlexModal}
                          className="inline-flex items-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold py-2 px-2.5 rounded-lg transition-colors text-xs border border-amber-200 cursor-pointer"
                          title="Set or auto-detect direct Plex album URL"
                        >
                          <span>{cd.plex_url ? '⚙️ Edit Plex Link' : '🔗 Link Plex Album'}</span>
                        </button>

                        <a 
                          href={wikipediaUrl} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="inline-flex items-center gap-2 bg-zinc-100 text-zinc-800 font-semibold py-2 px-3 rounded-lg hover:bg-zinc-200 transition-colors text-sm ml-1"
                        >
                            <WikipediaIcon className="w-5 h-5" />
                            Wikipedia
                        </a>
                      </div>
                    );
                  })()}

                  <div className="flex items-center gap-1">
                    <button 
                      onClick={handleUpdateInfo} 
                      disabled={isUpdating}
                      className={`p-2 rounded-full transition-all transform hover:scale-110 active:scale-95 ${
                        isUpdating 
                          ? 'bg-zinc-100 text-blue-500 animate-pulse' 
                          : 'text-zinc-500 hover:bg-zinc-100 hover:text-blue-500'
                      }`}
                      title="Update album info using Wikipedia & Gemini"
                    >
                      {isUpdating ? <SpinnerIcon className="w-5 h-5 animate-spin" /> : <SparklesIcon className="w-5 h-5" />}
                    </button>
                    <button 
                      onClick={() => navigate('/', { state: { editCdId: cd.id } })} 
                      className="p-2 rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950 transition-all transform hover:scale-110 active:scale-95" 
                      title="Edit manual details"
                    >
                      <EditIcon className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => setIsDeleteModalOpen(true)} 
                      className="p-2 rounded-full text-zinc-500 hover:bg-red-50 hover:text-red-500 transition-all transform hover:scale-110 active:scale-95" 
                      title="Delete album"
                    >
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                {plexampNotice && (
                  <div className="text-xs font-medium text-amber-900 bg-amber-50 border border-amber-200/80 rounded-md px-3 py-1.5 flex items-center gap-2 animate-in fade-in">
                    <span>📋</span>
                    <span>{plexampNotice}</span>
                  </div>
                )}
              </div>
            </div>
        </div>
        <div className="bg-zinc-50 px-6 py-4 flex justify-between items-center border-t border-zinc-100">
            {previousCd ? (
                <Link to={`/cd/${previousCd.id}`} className="flex items-center gap-2 text-zinc-700 font-bold text-sm hover:text-zinc-950">
                    <ArrowLeftIcon className="w-4 h-4" />
                    Previous
                </Link>
            ) : <div />}
            {nextCd ? (
                <Link to={`/cd/${nextCd.id}`} className="flex items-center gap-2 text-zinc-700 font-bold text-sm hover:text-zinc-950">
                    Next
                    <ArrowRightIcon className="w-4 h-4" />
                </Link>
            ) : <div />}
        </div>
      </div>

      {recommendations.length > 0 && (
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-zinc-950 mb-6">You Might Also Like</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {recommendations.map(r => <RecommendedCDItem key={r.id} cd={r} />)}
          </div>
        </div>
      )}

      {isPlexModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-zinc-200 relative">
            <button 
              onClick={() => setIsPlexModalOpen(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              ✕
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-amber-500/10 text-amber-600 rounded-lg">
                <PlexIcon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-900">Direct Plex Album Link</h3>
                <p className="text-xs text-zinc-500">{cd.artist} – {cd.title}</p>
              </div>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                  Plex / Plexamp Direct URL
                </label>
                <input
                  type="text"
                  placeholder="https://listen.plex.tv/album/... or https://app.plex.tv/desktop..."
                  value={plexInputUrl}
                  onChange={(e) => setPlexInputUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  Paste the direct share link from Plexamp ('Share' → 'Copy Link') or your Plex Media Server album details page.
                </p>
              </div>

              <div className="bg-amber-50 border border-amber-200/80 rounded-lg p-3 text-xs text-amber-950 space-y-2">
                <p className="font-bold">Auto-Detect from local Plex Media Server:</p>
                <p className="text-[11px]">
                  If your local Plex Media Server host URL is set in Plex Settings, click below to query your server for this exact album's metadata rating key.
                </p>
                <button
                  type="button"
                  onClick={handleAutoDetectPlex}
                  disabled={isDetectingPlex}
                  className="w-full py-2 px-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg font-bold text-xs transition-colors shadow-xs"
                >
                  {isDetectingPlex ? 'Searching Plex Library...' : '🔍 Auto-Detect Match on Plex Server'}
                </button>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2 pt-4 border-t border-zinc-100">
              <button
                onClick={() => setIsPlexModalOpen(false)}
                className="px-3.5 py-1.5 border border-zinc-300 rounded-lg text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePlexUrl}
                className="px-4 py-1.5 bg-zinc-900 hover:bg-black text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
              >
                Save Link
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDeleteModal 
        isOpen={isDeleteModalOpen} 
        onClose={() => setIsDeleteModalOpen(false)} 
        onConfirm={() => { onDeleteCD(cd.id); navigate('/'); }} 
        item={cd} 
      />
    </div>
  );
};

export default DetailView;