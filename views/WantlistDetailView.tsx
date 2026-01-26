import React, { useMemo, useCallback, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { WantlistItem, CD, CollectionMode } from '../types';
import { ArrowLeftIcon } from '../components/icons/ArrowLeftIcon';
import { MusicNoteIcon } from '../components/icons/MusicNoteIcon';
import { EditIcon } from '../components/icons/EditIcon';
import { ArrowRightIcon } from '../components/icons/ArrowRightIcon';
import { GlobeIcon } from '../components/icons/GlobeIcon';
import RecommendedCDItem from '../components/RecommendedCDItem';
import { capitalizeWords } from '../utils';
import { CheckIcon } from '../components/icons/CheckIcon';
import { TrashIcon } from '../components/icons/TrashIcon';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';

interface WantlistDetailViewProps {
  wantlist: WantlistItem[];
  cds: CD[];
  onDelete: (id: string) => void;
  onMoveToCollection: (item: WantlistItem) => void;
  collectionMode: CollectionMode;
}

const WantlistDetailView: React.FC<WantlistDetailViewProps> = ({ wantlist, cds, onDelete, onMoveToCollection, collectionMode }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

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
    return `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`;
  }, [item]);

  const handleEdit = useCallback(() => {
    if (item) {
      navigate('/wantlist', { state: { editWantlistItemId: item.id } });
    }
  }, [navigate, item]);

  const handleMoveToCollection = useCallback(() => {
    if (item) {
      onMoveToCollection(item);
      navigate('/wantlist', { replace: true });
    }
  }, [navigate, item, onMoveToCollection]);
  
  const handleRequestDelete = useCallback(() => {
    setIsDeleteModalOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (item) {
        onDelete(item.id);
        setIsDeleteModalOpen(false);
        navigate('/wantlist', { replace: true });
    }
  }, [item, onDelete, navigate]);

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

  const hasReleaseInfo = item.year || item.genre || item.record_label || item.version || item.condition;

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
      <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
        <div className="md:flex">
            <div className="md:flex-shrink-0">
                {item.cover_art_url ? (
                    <img src={item.cover_art_url} alt={`${item.title} cover`} className="w-full aspect-square object-cover md:w-64 rounded-br-lg" />
                ) : (
                    <div className="w-full aspect-square bg-zinc-200 flex items-center justify-center md:w-64 rounded-br-lg">
                        <MusicNoteIcon className="w-24 h-24 text-zinc-400" />
                    </div>
                )}
            </div>
            <div className="p-6 md:p-8 flex flex-col justify-start relative flex-grow">
              <h1 className="text-3xl md:text-4xl font-extrabold text-zinc-900 tracking-tight">{item.title}</h1>
              <h2 className="text-lg md:text-xl font-semibold text-zinc-700 mt-1">{capitalizeWords(item.artist)}</h2>

              {hasReleaseInfo && (
                  <div className="mt-6 pt-6 border-t border-zinc-200">
                      <h3 className="text-lg font-bold text-zinc-800">Target Info</h3>
                      <div className="mt-2 text-zinc-600 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                        {item.year && <p><span className="font-bold text-zinc-800">Year:</span> {item.year}</p>}
                        {item.genre && <p><span className="font-bold text-zinc-800">Genre:</span> {item.genre}</p>}
                        {item.record_label && <p><span className="font-bold text-zinc-800">Label:</span> {item.record_label}</p>}
                        {item.version && <p><span className="font-bold text-zinc-800">Version:</span> {item.version}</p>}
                        {item.condition && <p><span className="font-bold text-zinc-800">Target Condition:</span> {item.condition}</p>}
                      </div>
                  </div>
              )}

              {(item.attributes && item.attributes.length > 0) && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {item.attributes.map(attr => (
                    <span key={attr} className="bg-zinc-100 text-zinc-600 text-[10px] font-black px-2 py-1 rounded border border-zinc-200 uppercase tracking-tighter">
                      {attr}
                    </span>
                  ))}
                </div>
              )}

              {item.notes && (
                  <div className="mt-6 pt-6 border-t border-zinc-200">
                      <h3 className="text-lg font-bold text-zinc-800">Personal Notes</h3>
                      <p className="mt-2 text-zinc-600 whitespace-pre-wrap">{item.notes}</p>
                  </div>
              )}
              
              {item.tags && item.tags.length > 0 && (
                <div className="mt-6 pt-6 border-t border-zinc-200">
                    <h3 className="text-lg font-bold text-zinc-800">Tags</h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.tags.map(tag => (
                          <span key={tag} className="bg-zinc-200 text-zinc-700 text-sm font-medium px-3 py-1 rounded-full">
                            {capitalizeWords(tag)}
                          </span>
                      ))}
                    </div>
                </div>
              )}

              <div className="mt-6 pt-6 border-t border-zinc-200">
                <a
                  href={wikipediaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-zinc-700 font-semibold py-2 px-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-800"
                  aria-label={`View Wikipedia page for ${item.title}`}
                >
                  <GlobeIcon className="h-5 w-5" />
                  View on Wikipedia
                </a>
              </div>

              <div className="absolute top-4 right-4 flex items-center gap-2">
                <button
                  onClick={handleMoveToCollection}
                  className="p-2 rounded-full bg-green-500 text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  aria-label="Found it! Add to collection."
                  title="Found It!"
                >
                  <CheckIcon className="w-6 h-6" />
                </button>
                <button
                  onClick={handleEdit}
                  className="p-2 rounded-full bg-white/70 text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-800"
                  aria-label={`Edit ${item.title}`}
                  >
                  <EditIcon className="w-6 h-6" />
                </button>
                <button
                  onClick={handleRequestDelete}
                  className="p-2 rounded-full bg-white/70 text-red-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                  aria-label={`Delete ${item.title}`}
                  >
                  <TrashIcon className="w-6 h-6" />
                </button>
              </div>
            </div>
        </div>
        <div className="border-t border-zinc-200 bg-zinc-50 p-4 flex justify-between items-center">
          {previousItem ? (
            <Link
              to={`/wantlist/${previousItem.id}`}
              className="inline-flex items-center gap-2 text-zinc-700 font-semibold py-2 px-3 rounded-lg"
            >
              <ArrowLeftIcon className="h-5 w-5" />
              <span>Previous</span>
            </Link>
          ) : (
            <span className="inline-flex items-center gap-2 text-zinc-400 cursor-not-allowed py-2 px-3">
              <ArrowLeftIcon className="h-5 w-5" />
              <span>Previous</span>
            </span>
          )}

          {nextItem ? (
            <Link
              to={`/wantlist/${nextItem.id}`}
              className="inline-flex items-center gap-2 text-zinc-700 font-semibold py-2 px-3 rounded-lg"
            >
              <span>Next</span>
              <ArrowRightIcon className="h-5 w-5" />
            </Link>
          ) : (
            <span className="inline-flex items-center gap-2 text-zinc-400 cursor-not-allowed py-2 px-3">
              <span>Next</span>
              <ArrowRightIcon className="h-5 w-5" />
            </span>
          )}
        </div>
      </div>

      {recommendations.length > 0 && (
        <div className="mt-8">
          <h3 className="text-2xl font-bold text-zinc-800 mb-4">From Your Collection</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 md:gap-6">
            {recommendations.map(recCd => (
              <RecommendedCDItem key={recCd.id} cd={recCd} />
            ))}
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
