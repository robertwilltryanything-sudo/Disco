import React, { useMemo, useCallback, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { WantlistItem, CD, CollectionMode } from '../types';
import { ArrowLeftIcon } from '../components/icons/ArrowLeftIcon';
import { MusicNoteIcon } from '../components/icons/MusicNoteIcon';
import { EditIcon } from '../components/icons/EditIcon';
import { ArrowRightIcon } from '../components/icons/ArrowRightIcon';
import { GlobeIcon } from '../components/icons/GlobeIcon';
import RecommendedCDItem from '../components/RecommendedCDItem';
import { capitalizeWords, getBrandColor } from '../utils';
import { CheckIcon } from '../components/icons/CheckIcon';
import { TrashIcon } from '../components/icons/TrashIcon';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import { SparklesIcon } from '../components/icons/SparklesIcon';
import { SpinnerIcon } from '../components/icons/SpinnerIcon';
import { getAlbumDetails } from '../gemini';

interface WantlistDetailViewProps {
  wantlist: WantlistItem[];
  cds: CD[];
  onDelete: (id: string) => void;
  onUpdate: (item: WantlistItem) => Promise<void>;
  onMoveToCollection: (item: WantlistItem) => void;
  collectionMode: CollectionMode;
}

const VINYL_MEDIA_CONDITION = ["Hairlines", "Scratched", "Warped"];
const VINYL_COVER_CONDITION = ["Ringwear", "Seemsplit", "Price Sticker", "Water Damage", "Tear Front", "Cut Out"];

const CD_MEDIA_CONDITION = ["Scratched", "Hairlines", "Sticky"];
const CD_COVER_CONDITION = ["Cracked Case", "Price Sticker", "Tear Front"];

const WantlistDetailView: React.FC<WantlistDetailViewProps> = ({ wantlist, cds, onDelete, onUpdate, onMoveToCollection, collectionMode }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const { item, previousItem, nextItem } = useMemo(() => {
    const currentIndex = wantlist.findIndex(i => i.id === id);
    if (currentIndex === -1) {
      return { item: null, previousItem: null, nextItem: null };
    }
    const currentItem = wantlist[currentIndex];
    const prev = currentIndex > 0 ? wantlist[currentIndex - 1] : null;
    const next = currentIndex < wantlist.length - 1 ? wantlist[currentIndex + 1] : null;
    return { item: currentItem, previousItem: prev, nextItem: next };
  }, [wantlist, id]);

  const recommendations = useMemo(() => {
    if (!item) return [];
    
    const MAX_RECOMMENDATIONS = 4;
    const recommendedMap = new Map<string, CD>();

    cds.forEach(c => {
      if (c.id !== item.id && c.artist === item.artist) recommendedMap.set(c.id, c);
    });
    if (recommendedMap.size < MAX_RECOMMENDATIONS && item.genre) {
      cds.forEach(c => {
        if (!recommendedMap.has(c.id) && c.id !== item.id && c.genre === item.genre) recommendedMap.set(c.id, c);
      });
    }
    if (recommendedMap.size < MAX_RECOMMENDATIONS && item.tags && item.tags.length > 0) {
      const currentTags = new Set(item.tags);
      cds.forEach(c => {
        if (!recommendedMap.has(c.id) && c.id !== item.id && c.tags?.some(tag => currentTags.has(tag))) recommendedMap.set(c.id, c);
      });
    }
    
    return Array.from(recommendedMap.values()).slice(0, MAX_RECOMMENDATIONS);
  }, [item, cds]);

  const albumType = collectionMode === 'vinyl' ? 'Vinyl' : 'CD';
  
  const wikipediaUrl = useMemo(() => {
    if (!item) return '';
    if (item.wikipedia_url) return item.wikipedia_url;
    return `https://www.google.com/search?q=wikipedia+album+${encodeURIComponent(item.artist)}+${encodeURIComponent(item.title)}`;
  }, [item]);

  const handleEdit = useCallback(() => {
    if (item) {
      navigate('/wantlist', { state: { editWantlistItemId: item.id } });
    }
  }, [navigate, item]);

  const handleUpdateInfo = useCallback(async () => {
    if (!item || isUpdating) return;
    setIsUpdating(true);
    try {
      const details = await getAlbumDetails(item.artist, item.title);
      if (details) {
        const updatedItem: WantlistItem = {
          ...item,
          genre: details.genre || item.genre,
          year: details.year || item.year,
          record_label: details.record_label || item.record_label,
          wikipedia_url: details.wikipedia_url || item.wikipedia_url,
          review: details.review || item.review,
          tags: [...new Set([...(item.tags || []), ...(details.tags || [])])]
        };
        await onUpdate(updatedItem);
      } else {
        alert("No additional info found.");
      }
    } catch (error: any) {
      console.error("Update error:", error);
      alert(error.message || "Failed to update wantlist item.");
    } finally {
      setIsUpdating(false);
    }
  }, [item, isUpdating, onUpdate]);

  const handleMoveToCollection = useCallback(() => {
    if (item) {
      onMoveToCollection(item);
      navigate('/wantlist', { replace: true });
    }
  }, [navigate, item, onMoveToCollection]);
  
  const handleConfirmDelete = useCallback(() => {
    if (item) {
        onDelete(item.id);
        setIsDeleteModalOpen(false);
        navigate('/wantlist', { replace: true });
    }
  }, [item, onDelete, navigate]);

  const { mediaTraits, coverTraits, physicalAttributes } = useMemo(() => {
    if (!item || !item.attributes) return { mediaTraits: [], coverTraits: [], physicalAttributes: [] };
    const mediaList = item.format === 'vinyl' ? VINYL_MEDIA_CONDITION : CD_MEDIA_CONDITION;
    const coverList = item.format === 'vinyl' ? VINYL_COVER_CONDITION : CD_COVER_CONDITION;
    
    const media = item.attributes.filter(a => mediaList.includes(a));
    const cover = item.attributes.filter(a => coverList.includes(a));
    const phys = item.attributes.filter(a => !mediaList.includes(a) && !coverList.includes(a));
    
    return { mediaTraits: media, coverTraits: cover, physicalAttributes: phys };
  }, [item]);

  if (!item) {
    return (
      <div className="text-center p-8">
        <h2 className="text-2xl font-bold text-red-600">{albumType} Wantlist Item Not Found</h2>
        <Link
          to="/wantlist"
          className="mt-6 inline-flex items-center gap-2 bg-zinc-900 text-white font-bold py-2 px-4 rounded-lg"
        >
          <ArrowLeftIcon className="h-5 w-5" />
          Back to Wantlist
        </Link>
      </div>
    );
  }

  const hasReleaseInfo = item.year || item.genre || item.record_label || item.version;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Link
          to="/wantlist"
          className="inline-flex items-center gap-2 text-zinc-600 font-medium"
        >
          <ArrowLeftIcon className="h-5 w-5" />
          Back to {albumType} Wantlist
        </Link>
      </div>
      <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden shadow-sm">
        <div className="md:flex">
            <div className="md:flex-shrink-0">
                {item.cover_art_url ? (
                    <img src={item.cover_art_url} alt={`${item.title} cover`} className="w-full aspect-square object-cover md:w-64" referrerPolicy="no-referrer" />
                ) : (
                    <div className="w-full aspect-square bg-zinc-50 flex items-center justify-center md:w-64">
                        <MusicNoteIcon className="w-24 h-24 text-zinc-200" />
                    </div>
                )}
            </div>
            <div className="p-6 md:p-8 flex flex-col justify-start relative flex-grow">
              <div className="flex justify-between items-start">
                  <div>
                    <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">{item.title}</h1>
                    <h2 className="text-lg font-semibold text-zinc-500 mt-1">{capitalizeWords(item.artist)}</h2>
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={handleUpdateInfo} 
                      disabled={isUpdating}
                      className={`p-2 rounded-full transition-colors ${isUpdating ? 'bg-blue-100 text-blue-600' : 'text-zinc-400 hover:bg-blue-50 hover:text-blue-600'}`}
                      title="Update wantlist info using Gemini"
                    >
                      {isUpdating ? <SpinnerIcon className="w-5 h-5 animate-spin" /> : <SparklesIcon className="w-5 h-5" />}
                    </button>
                    <button onClick={handleEdit} className="p-2 rounded-full text-zinc-400 hover:bg-zinc-100 transition-colors" title="Edit manual details">
                      <EditIcon className="w-5 h-5" />
                    </button>
                    <button onClick={() => setIsDeleteModalOpen(true)} className="p-2 rounded-full text-red-400 hover:bg-red-50 transition-colors" title="Delete from wantlist">
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </div>
              </div>

              {item.review && (
                <div className="mt-6 pt-6 border-t border-zinc-100">
                  <p className="text-zinc-400 font-bold uppercase tracking-wider text-[10px] mb-2 flex items-center gap-1.5">
                    <SparklesIcon className="w-3 h-3" />
                    Album Review
                  </p>
                  <p className="text-zinc-700 text-sm leading-relaxed font-medium italic">
                    "{item.review}"
                  </p>
                </div>
              )}

              {hasReleaseInfo && (
                  <div className="mt-6 pt-6 border-t border-zinc-100">
                      <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Target Info</h3>
                      <div className="mt-2 text-zinc-700 text-sm grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                        {item.year && <p><span className="font-bold text-zinc-400 uppercase tracking-tight mr-1">Year:</span> {item.year}</p>}
                        {item.genre && <p><span className="font-bold text-zinc-400 uppercase tracking-tight mr-1">Genre:</span> {item.genre}</p>}
                        {item.record_label && <p><span className="font-bold text-zinc-400 uppercase tracking-tight mr-1">Label:</span> {item.record_label}</p>}
                        {item.version && <p><span className="font-bold text-zinc-400 uppercase tracking-tight mr-1">Version:</span> {item.version}</p>}
                      </div>
                  </div>
              )}

              {mediaTraits.length > 0 && (
                <div className="mt-6 pt-6 border-t border-zinc-100">
                  <p className="text-zinc-400 font-bold uppercase tracking-wider text-[10px] mb-2">TARGET MEDIA CONDITION</p>
                  <div className="flex flex-wrap gap-2">
                    {mediaTraits.map(attr => (
                      <span key={attr} className={`${getBrandColor(attr)} text-zinc-900 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-tight shadow-sm border border-black/5`}>
                        {attr}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {coverTraits.length > 0 && (
                <div className="mt-6 pt-6 border-t border-zinc-100">
                  <p className="text-zinc-400 font-bold uppercase tracking-wider text-[10px] mb-2">TARGET COVER CONDITION</p>
                  <div className="flex flex-wrap gap-2">
                    {coverTraits.map(attr => (
                      <span key={attr} className={`${getBrandColor(attr)} text-zinc-900 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-tight shadow-sm border border-black/5`}>
                        {attr}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {physicalAttributes.length > 0 && (
                <div className="mt-6 pt-6 border-t border-zinc-100">
                  <p className="text-zinc-400 font-bold uppercase tracking-wider text-[10px] mb-2">PHYSICAL ATTRIBUTES</p>
                  <div className="flex flex-wrap gap-2">
                    {physicalAttributes.map(attr => (
                      <span key={attr} className={`${getBrandColor(attr)} text-zinc-900 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-tight shadow-sm border border-black/5`}>
                        {attr}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {item.notes && <div className="mt-6 pt-6 border-t border-zinc-100"><h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Notes</h3><p className="text-zinc-600 italic">"{item.notes}"</p></div>}

              {item.tags && item.tags.length > 0 && (
                <div className="mt-6 pt-6 border-t border-zinc-100">
                  <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {item.tags.map(tag => (
                      <span
                        key={tag}
                        className="bg-zinc-100 text-zinc-800 text-[11px] font-bold px-3 py-1 rounded-full border border-zinc-200 uppercase tracking-tight"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-8 flex flex-wrap gap-3">
                  <button onClick={handleMoveToCollection} className="inline-flex items-center gap-2 bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 transition-colors">
                      <CheckIcon className="w-5 h-5" />
                      Found it! Add to Collection
                  </button>
                  <a href={wikipediaUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-zinc-100 text-zinc-700 font-semibold py-2 px-3 rounded-lg hover:bg-zinc-200 transition-colors">
                      <GlobeIcon className="w-5 h-5" />
                      Wikipedia
                  </a>
              </div>
            </div>
        </div>
        <div className="bg-zinc-50 px-6 py-4 flex justify-between items-center border-t border-zinc-100">
            {previousItem ? (
                <Link to={`/wantlist/${previousItem.id}`} className="flex items-center gap-2 text-zinc-600 font-bold text-sm hover:text-zinc-900">
                    <ArrowLeftIcon className="w-4 h-4" />
                    Previous
                </Link>
            ) : <div />}
            {nextItem ? (
                <Link to={`/wantlist/${nextItem.id}`} className="flex items-center gap-2 text-zinc-600 font-bold text-sm hover:text-zinc-900">
                    Next
                    <ArrowRightIcon className="w-4 h-4" />
                </Link>
            ) : <div />}
        </div>
      </div>

      {recommendations.length > 0 && (
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-zinc-900 mb-6">Similar in Your Collection</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {recommendations.map(r => <RecommendedCDItem key={r.id} cd={r} />)}
          </div>
        </div>
      )}

      <ConfirmDeleteModal 
        isOpen={isDeleteModalOpen} 
        onClose={() => setIsDeleteModalOpen(false)} 
        onConfirm={handleConfirmDelete} 
        item={item} 
      />
    </div>
  );
};

export default WantlistDetailView;