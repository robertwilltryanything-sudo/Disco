import React, { useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { CD, CollectionMode } from '../types';
import { ArrowLeftIcon } from '../components/icons/ArrowLeftIcon';
import { MusicNoteIcon } from '../components/icons/MusicNoteIcon';
import { EditIcon } from '../components/icons/EditIcon';
import { ArrowRightIcon } from '../components/icons/ArrowRightIcon';
import { GlobeIcon } from '../components/icons/GlobeIcon';
import RecommendedCDItem from '../components/RecommendedCDItem';
import { TrashIcon } from '../components/icons/TrashIcon';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import { SparklesIcon } from '../components/icons/SparklesIcon';
import { SpinnerIcon } from '../components/icons/SpinnerIcon';
import { getBrandColor } from '../utils';
import { getAlbumDetails } from '../gemini';

interface DetailViewProps {
  cds: CD[];
  onDeleteCD: (id: string) => void;
  onUpdateCD: (cd: CD) => Promise<void>;
  collectionMode: CollectionMode;
}

const VINYL_MEDIA_CONDITION = ["Hairlines", "Scratched", "Warped"];
const VINYL_COVER_CONDITION = ["Ringwear", "Seemsplit", "Price Sticker", "Water Damage", "Tear Front", "Cut Out"];

const CD_MEDIA_CONDITION = ["Scratched", "Hairlines", "Sticky"];
const CD_COVER_CONDITION = ["Cracked Case", "Price Sticker", "Tear Front"];

const DetailView: React.FC<DetailViewProps> = ({ cds, onDeleteCD, onUpdateCD, collectionMode }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

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
    return `https://www.google.com/search?q=wikipedia+album+${encodeURIComponent(cd.artist)}+${encodeURIComponent(cd.title)}`;
  }, [cd]);

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
          record_label: details.record_label || cd.record_label,
          wikipedia_url: details.wikipedia_url || cd.wikipedia_url,
          review: details.review || cd.review,
          tags: [...new Set([...(cd.tags || []), ...(details.tags || [])])]
        };
        await onUpdateCD(updatedCd);
      }
    } catch (error) {
      console.error("Failed to update album info:", error);
      alert("Failed to update album info. Please try again later.");
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
      <div className="mb-6"><Link to="/" className="inline-flex items-center gap-2 text-zinc-600 font-medium"><ArrowLeftIcon className="h-5 w-5" />Back to Collection</Link></div>
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-sm">
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
                    <div className="w-full aspect-square bg-zinc-50 flex items-center justify-center"><MusicNoteIcon className="w-24 h-24 text-zinc-200" /></div>
                )}
            </div>
            <div className="p-6 md:p-8 flex flex-col flex-grow">
              <div className="flex justify-between items-start gap-4">
                <div className="flex-grow">
                  <h1 className="text-3xl font-bold text-zinc-900">{cd.title}</h1>
                  <h2 className="text-xl font-semibold text-zinc-500 mt-1 cursor-pointer" onClick={() => navigate({ pathname: '/', search: `?q=${encodeURIComponent(cd.artist)}` })}>{cd.artist}</h2>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={handleUpdateInfo} 
                    disabled={isUpdating}
                    className={`p-2 rounded-full transition-colors ${isUpdating ? 'text-blue-500' : 'text-zinc-400 hover:bg-blue-50 hover:text-blue-600'}`}
                    title="Update album info using Gemini"
                  >
                    {isUpdating ? <SpinnerIcon className="w-5 h-5 animate-spin" /> : <SparklesIcon className="w-5 h-5" />}
                  </button>
                  <button onClick={() => navigate('/', { state: { editCdId: cd.id } })} className="p-2 rounded-full text-zinc-400 hover:bg-zinc-100 transition-colors" title="Edit manual details"><EditIcon className="w-5 h-5" /></button>
                  <button onClick={() => setIsDeleteModalOpen(true)} className="p-2 rounded-full text-red-400 hover:bg-red-50 transition-colors" title="Delete album"><TrashIcon className="w-5 h-5" /></button>
                </div>
              </div>

              <div className="mt-8 grid grid-cols-2 gap-y-4 gap-x-6 text-sm border-t border-zinc-100 pt-6">
                  {cd.year && (
                    <div>
                      <p className="text-zinc-400 font-bold uppercase tracking-wider text-[10px]">Year</p>
                      <button 
                        onClick={() => handleSearchFilter(cd.year)}
                        className="text-zinc-900 font-medium hover:text-zinc-600 transition-colors"
                      >
                        {cd.year}
                      </button>
                    </div>
                  )}
                  {cd.genre && (
                    <div>
                      <p className="text-zinc-400 font-bold uppercase tracking-wider text-[10px]">Genre</p>
                      <button 
                        onClick={() => handleSearchFilter(cd.genre)}
                        className="text-zinc-900 font-medium hover:text-zinc-600 transition-colors"
                      >
                        {cd.genre}
                      </button>
                    </div>
                  )}
                  {cd.record_label && <div><p className="text-zinc-400 font-bold uppercase tracking-wider text-[10px]">Label</p><p className="text-zinc-900 font-medium">{cd.record_label}</p></div>}
                  {cd.version && <div><p className="text-zinc-400 font-bold uppercase tracking-wider text-[10px]">Version</p><p className="text-zinc-900 font-medium">{cd.version}</p></div>}
              </div>

              {cd.review && (
                <div className="mt-6 pt-6 border-t border-zinc-100">
                  <p className="text-zinc-400 font-bold uppercase tracking-wider text-[10px] mb-2 flex items-center gap-1.5">
                    <SparklesIcon className="w-3 h-3" />
                    Album Review
                  </p>
                  <p className="text-zinc-700 text-sm leading-relaxed font-medium italic">
                    "{cd.review}"
                  </p>
                </div>
              )}

              {mediaTraits.length > 0 && (
                <div className="mt-6 pt-6 border-t border-zinc-100">
                  <p className="text-zinc-400 font-bold uppercase tracking-wider text-[10px] mb-2">MEDIA CONDITION</p>
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
                  <p className="text-zinc-400 font-bold uppercase tracking-wider text-[10px] mb-2">COVER CONDITION</p>
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

              {cd.notes && <div className="mt-6 pt-6 border-t border-zinc-100"><h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Notes</h3><p className="text-zinc-600 italic">"{cd.notes}"</p></div>}

              {cd.tags && cd.tags.length > 0 && (
                <div className="mt-6 pt-6 border-t border-zinc-100">
                  <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {cd.tags.map(tag => (
                      <button
                        key={tag}
                        onClick={() => handleSearchFilter(tag)}
                        className="bg-zinc-100 text-zinc-800 text-[11px] font-bold px-3 py-1 rounded-full border border-zinc-200 hover:bg-zinc-200 transition-colors uppercase tracking-tight"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-8 flex flex-wrap gap-3">
                  <a href={wikipediaUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-zinc-100 text-zinc-700 font-semibold py-2 px-3 rounded-lg hover:bg-zinc-200 transition-colors">
                      <GlobeIcon className="w-5 h-5" />
                      Wikipedia
                  </a>
              </div>
            </div>
        </div>
        <div className="bg-zinc-50 px-6 py-4 flex justify-between items-center border-t border-zinc-100">
            {previousCd ? (
                <Link to={`/cd/${previousCd.id}`} className="flex items-center gap-2 text-zinc-600 font-bold text-sm hover:text-zinc-900">
                    <ArrowLeftIcon className="w-4 h-4" />
                    Previous
                </Link>
            ) : <div />}
            {nextCd ? (
                <Link to={`/cd/${nextCd.id}`} className="flex items-center gap-2 text-zinc-600 font-bold text-sm hover:text-zinc-900">
                    Next
                    <ArrowRightIcon className="w-4 h-4" />
                </Link>
            ) : <div />}
        </div>
      </div>

      {recommendations.length > 0 && (
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-zinc-900 mb-6">You Might Also Like</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {recommendations.map(r => <RecommendedCDItem key={r.id} cd={r} />)}
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