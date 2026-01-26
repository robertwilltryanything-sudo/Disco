import React, { useMemo, useCallback, useState } from 'react';
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
import { getAlbumDetails } from '../gemini';

interface DetailViewProps {
  cds: CD[];
  onDeleteCD: (id: string) => void;
  onUpdateCD: (cd: CD) => Promise<void>;
  collectionMode: CollectionMode;
}

const DetailView: React.FC<DetailViewProps> = ({ cds, onDeleteCD, onUpdateCD, collectionMode }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

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
  const wikipediaUrl = useMemo(() => cd ? `https://en.wikipedia.org/wiki/${encodeURIComponent(cd.title.replace(/ /g, '_'))}` : '', [cd]);

  const handleRefreshData = useCallback(async () => {
      if (!cd) return;
      setIsRefreshing(true);
      try {
          const details = await getAlbumDetails(cd.artist, cd.title);
          if (details) {
              const updatedCd: CD = {
                  ...cd,
                  genre: cd.genre || details.genre,
                  record_label: cd.record_label || details.record_label,
                  year: cd.year || details.year,
                  tags: [...new Set([...(cd.tags || []), ...(details.tags || [])])],
              };
              await onUpdateCD(updatedCd);
          }
      } catch (error) { alert("Could not fetch new details."); }
      finally { setIsRefreshing(false); }
  }, [cd, onUpdateCD]);

  const handleSearchFilter = (value: string | number | undefined) => {
    if (value) {
      navigate({ pathname: '/', search: `?q=${encodeURIComponent(value.toString())}` });
    }
  };

  if (!cd) return <div className="text-center p-8"><h2 className="text-2xl font-bold text-red-600">{albumType} Not Found</h2><Link to="/" className="mt-6 inline-flex items-center gap-2 bg-zinc-900 text-white font-bold py-2 px-4 rounded-lg"> <ArrowLeftIcon className="h-5 w-5" />Back to Collection</Link></div>;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6"><Link to="/" className="inline-flex items-center gap-2 text-zinc-600 font-medium"><ArrowLeftIcon className="h-5 w-5" />Back to Collection</Link></div>
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-sm">
        <div className="md:flex">
            <div className="md:flex-shrink-0 md:w-80">
                {cd.cover_art_url ? (
                    <img src={cd.cover_art_url} alt={`${cd.title} cover`} className="w-full aspect-square object-cover" />
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
                <div className="flex items-center gap-2">
                  <button onClick={() => navigate('/', { state: { editCdId: cd.id } })} className="p-2 rounded-full text-zinc-400 hover:bg-zinc-100 transition-colors"><EditIcon className="w-5 h-5" /></button>
                  <button onClick={() => setIsDeleteModalOpen(true)} className="p-2 rounded-full text-red-400 hover:bg-red-50 transition-colors"><TrashIcon className="w-5 h-5" /></button>
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
                  {cd.condition && <div><p className="text-zinc-400 font-bold uppercase tracking-wider text-[10px]">Condition</p><p className="text-zinc-900 font-bold italic">{cd.condition}</p></div>}
              </div>

              {(cd.attributes && cd.attributes.length > 0) && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {cd.attributes.map(attr => (
                    <span key={attr} className="bg-zinc-900 text-white text-[10px] font-black px-2 py-1 rounded uppercase tracking-tighter">
                      {attr}
                    </span>
                  ))}
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
                  <a href={wikipediaUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-zinc-100 text-zinc-700 font-bold py-2 px-4 rounded-lg text-sm hover:bg-zinc-200 transition-colors"><GlobeIcon className="h-4 w-4" />Wikipedia</a>
                  <button onClick={handleRefreshData} disabled={isRefreshing} className="inline-flex items-center gap-2 bg-blue-50 text-blue-600 font-bold py-2 px-4 rounded-lg disabled:opacity-50 text-sm hover:bg-blue-100 transition-colors"><SparklesIcon className="w-4 h-4" />Update Info</button>
              </div>
            </div>
        </div>
        <div className="bg-zinc-50/50 p-4 border-t border-zinc-100 flex justify-between">
          <Link to={previousCd ? `/cd/${previousCd.id}` : '#'} className={`flex items-center gap-2 font-bold text-xs ${previousCd ? 'text-zinc-600 hover:text-zinc-900' : 'text-zinc-300 pointer-events-none'}`}><ArrowLeftIcon className="h-3 w-3" /> Previous</Link>
          <Link to={nextCd ? `/cd/${nextCd.id}` : '#'} className={`flex items-center gap-2 font-bold text-xs ${nextCd ? 'text-zinc-600 hover:text-zinc-900' : 'text-zinc-300 pointer-events-none'}`}>Next <ArrowRightIcon className="h-3 w-3" /></Link>
        </div>
      </div>

      {recommendations.length > 0 && <div className="mt-10"><h3 className="text-lg font-bold text-zinc-900 mb-6">Related from Collection</h3><div className="grid grid-cols-2 sm:grid-cols-4 gap-6">{recommendations.map(rec => <RecommendedCDItem key={rec.id} cd={rec} />)}</div></div>}
      <ConfirmDeleteModal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} onConfirm={() => { onDeleteCD(cd.id); navigate('/', { replace: true }); }} item={cd} />
    </div>
  );
};

export default DetailView;
