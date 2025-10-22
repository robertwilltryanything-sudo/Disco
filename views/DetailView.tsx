import React, { useMemo, useCallback, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { CD } from '../types';
import { ArrowLeftIcon } from '../components/icons/ArrowLeftIcon';
import { MusicNoteIcon } from '../components/icons/MusicNoteIcon';
import { EditIcon } from '../components/icons/EditIcon';
import { ArrowRightIcon } from '../components/icons/ArrowRightIcon';
import { GlobeIcon } from '../components/icons/GlobeIcon';
import RecommendedCDItem from '../components/RecommendedCDItem';
import { capitalizeWords } from '../utils';
import { PlusIcon } from '../components/icons/PlusIcon';
import { TrashIcon } from '../components/icons/TrashIcon';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';

interface DetailViewProps {
  cds: CD[];
  onDeleteCD: (id: string) => void;
}

const DetailView: React.FC<DetailViewProps> = ({ cds, onDeleteCD }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const { cd, previousCd, nextCd } = useMemo(() => {
    const currentIndex = cds.findIndex(c => c.id === id);
    if (currentIndex === -1) {
      return { cd: null, previousCd: null, nextCd: null };
    }
    const currentCd = cds[currentIndex];
    const prev = currentIndex > 0 ? cds[currentIndex - 1] : null;
    const next = currentIndex < cds.length - 1 ? cds[currentIndex + 1] : null;
    return { cd: currentCd, previousCd: prev, nextCd: next };
  }, [cds, id]);

  const recommendations = useMemo(() => {
    if (!cd) return [];
    
    const MAX_RECOMMENDATIONS = 4;
    const recommendedMap = new Map<string, CD>();

    // Priority 1: Same Artist
    cds.forEach(c => {
      if (c.id !== cd.id && c.artist === cd.artist) {
        recommendedMap.set(c.id, c);
      }
    });

    // Priority 2: Same Genre
    if (recommendedMap.size < MAX_RECOMMENDATIONS && cd.genre) {
      cds.forEach(c => {
        if (!recommendedMap.has(c.id) && c.id !== cd.id && c.genre === cd.genre) {
          recommendedMap.set(c.id, c);
        }
      });
    }

    // Priority 3: Shared Tags
    if (recommendedMap.size < MAX_RECOMMENDATIONS && cd.tags && cd.tags.length > 0) {
      const currentTags = new Set(cd.tags);
      cds.forEach(c => {
        if (!recommendedMap.has(c.id) && c.id !== cd.id && c.tags?.some(tag => currentTags.has(tag))) {
            recommendedMap.set(c.id, c);
        }
      });
    }
    
    return Array.from(recommendedMap.values()).slice(0, MAX_RECOMMENDATIONS);
  }, [cd, cds]);

  const wikipediaUrl = useMemo(() => {
    if (!cd) return '';
    return `https://en.wikipedia.org/wiki/${encodeURIComponent(cd.title.replace(/ /g, '_'))}`;
  }, [cd]);

  const handleEdit = useCallback(() => {
    if (cd) {
      navigate('/', { state: { editCdId: cd.id } });
    }
  }, [navigate, cd]);

  const handleAddAnotherByArtist = useCallback(() => {
    if (cd) {
      navigate('/', { state: { addAlbumForArtist: cd.artist } });
    }
  }, [navigate, cd]);
  
  const handleRequestDelete = useCallback(() => {
    setIsDeleteModalOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (cd) {
        onDeleteCD(cd.id);
        setIsDeleteModalOpen(false);
        navigate('/', { replace: true });
    }
  }, [cd, onDeleteCD, navigate]);

  const handleArtistClick = useCallback(() => {
    if (cd) {
      navigate({ pathname: '/', search: `?q=${encodeURIComponent(cd.artist)}` });
    }
  }, [navigate, cd]);

  const handleYearClick = useCallback(() => {
    if (cd?.year) {
      navigate({ pathname: '/', search: `?q=${encodeURIComponent(cd.year)}` });
    }
  }, [navigate, cd]);

  const handleGenreClick = useCallback(() => {
    if (cd?.genre) {
      navigate({ pathname: '/', search: `?q=${encodeURIComponent(cd.genre)}` });
    }
  }, [navigate, cd]);

  const handleRecordLabelClick = useCallback(() => {
    if (cd?.recordLabel) {
      navigate({ pathname: '/', search: `?q=${encodeURIComponent(cd.recordLabel)}` });
    }
  }, [navigate, cd]);

  const handleTagClick = useCallback((tag: string) => {
    navigate({ pathname: '/', search: `?q=${encodeURIComponent(tag)}` });
  }, [navigate]);

  if (!cd) {
    return (
      <div className="text-center p-8">
        <h2 className="text-2xl font-bold text-red-600">CD Not Found</h2>
        <p className="text-zinc-600 mt-2">The CD you are looking for does not exist.</p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-2 bg-zinc-900 text-white font-bold py-2 px-4 rounded-lg hover:bg-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900"
        >
          <ArrowLeftIcon className="h-5 w-5" />
          Back to Collection
        </Link>
      </div>
    );
  }

  const hasReleaseInfo = cd.year || cd.genre || cd.recordLabel || cd.version;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-zinc-600 hover:text-zinc-900 font-medium"
        >
          <ArrowLeftIcon className="h-5 w-5" />
          Back to Collection
        </Link>
      </div>
      <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
        <div className="md:flex">
            <div className="md:flex-shrink-0">
                {cd.coverArtUrl ? (
                    <img src={cd.coverArtUrl} alt={`${cd.title} cover`} className="w-full aspect-square object-cover md:w-64 rounded-br-lg" />
                ) : (
                    <div className="w-full aspect-square bg-zinc-200 flex items-center justify-center md:w-64 rounded-br-lg">
                        <MusicNoteIcon className="w-24 h-24 text-zinc-400" />
                    </div>
                )}
            </div>
            <div className="p-6 md:p-8 flex flex-col justify-start relative flex-grow">
              <h1 className="text-3xl md:text-4xl font-extrabold text-zinc-900 tracking-tight">{cd.title}</h1>
              <h2 className="text-lg md:text-xl font-semibold text-zinc-700 mt-1">
                <button
                    onClick={handleArtistClick}
                    className="text-left w-full hover:text-zinc-900 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-800 rounded-sm p-1 -m-1"
                    aria-label={`View all albums by ${cd.artist}`}
                >
                    {capitalizeWords(cd.artist)}
                </button>
              </h2>

              {hasReleaseInfo && (
                  <div className="mt-6 pt-6 border-t border-zinc-200">
                      <h3 className="text-lg font-bold text-zinc-800">Release Info</h3>
                      <div className="mt-2 text-zinc-600 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                        {cd.year && (
                          <p>
                            <span className="font-bold text-zinc-800">Year:</span>{' '}
                            <button
                                onClick={handleYearClick}
                                className="hover:text-zinc-900 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-800 rounded-sm p-1 -m-1"
                                aria-label={`View all albums from ${cd.year}`}
                            >
                                {cd.year}
                            </button>
                          </p>
                        )}
                        {cd.genre && (
                           <p>
                            <span className="font-bold text-zinc-800">Genre:</span>{' '}
                            <button
                                onClick={handleGenreClick}
                                className="hover:text-zinc-900 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-800 rounded-sm p-1 -m-1"
                                aria-label={`View all albums in the ${cd.genre} genre`}
                            >
                                {cd.genre}
                            </button>
                          </p>
                        )}
                        {cd.recordLabel && (
                          <p>
                            <span className="font-bold text-zinc-800">Label:</span>{' '}
                            <button
                                onClick={handleRecordLabelClick}
                                className="hover:text-zinc-900 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-800 rounded-sm p-1 -m-1"
                                aria-label={`View all albums from ${cd.recordLabel}`}
                            >
                                {cd.recordLabel}
                            </button>
                          </p>
                        )}
                        {cd.version && (
                           <p>
                              <span className="font-bold text-zinc-800">Version:</span>{' '}
                              <span>{cd.version}</span>
                           </p>
                        )}
                      </div>
                  </div>
              )}

              {cd.notes && (
                  <div className="mt-6 pt-6 border-t border-zinc-200">
                      <h3 className="text-lg font-bold text-zinc-800">Personal Notes</h3>
                      <p className="mt-2 text-zinc-600 whitespace-pre-wrap">{cd.notes}</p>
                  </div>
              )}
              
              {cd.tags && cd.tags.length > 0 && (
                <div className="mt-6 pt-6 border-t border-zinc-200">
                    <h3 className="text-lg font-bold text-zinc-800">Tags</h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {cd.tags.map(tag => {
                        const capitalizedTag = capitalizeWords(tag);
                        return (
                          <button
                            key={tag}
                            onClick={() => handleTagClick(tag)}
                            className="bg-zinc-200 text-zinc-700 text-sm font-medium px-3 py-1 rounded-full hover:bg-zinc-300 hover:text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-800"
                            aria-label={`View all albums tagged with ${capitalizedTag}`}
                          >
                            {capitalizedTag}
                          </button>
                        );
                      })}
                    </div>
                </div>
              )}

              <div className="mt-6 pt-6 border-t border-zinc-200">
                <a
                  href={wikipediaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-zinc-700 hover:text-zinc-900 font-semibold py-2 px-3 rounded-lg hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-800"
                  aria-label={`View Wikipedia page for ${cd.title}`}
                >
                  <GlobeIcon className="h-5 w-5" />
                  View on Wikipedia
                </a>
              </div>

              <div className="absolute top-4 right-4 flex gap-2">
                <button
                  onClick={handleAddAnotherByArtist}
                  className="p-2 rounded-full bg-white/70 text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-800"
                  aria-label={`Add another album by ${cd.artist}`}
                >
                  <PlusIcon className="w-6 h-6" />
                </button>
                <button
                  onClick={handleEdit}
                  className="p-2 rounded-full bg-white/70 text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-800"
                  aria-label={`Edit ${cd.title}`}
                >
                  <EditIcon className="w-6 h-6" />
                </button>
                <button
                  onClick={handleRequestDelete}
                  className="p-2 rounded-full bg-white/70 text-red-500 hover:bg-red-50 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                  aria-label={`Delete ${cd.title}`}
                >
                  <TrashIcon className="w-6 h-6" />
                </button>
              </div>
            </div>
        </div>
        <div className="border-t border-zinc-200 bg-zinc-50 p-4 flex justify-between items-center">
          {previousCd ? (
            <Link
              to={`/cd/${previousCd.id}`}
              className="inline-flex items-center gap-2 text-zinc-700 hover:text-zinc-900 font-semibold py-2 px-3 rounded-lg hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-800"
              aria-label={`Previous album: ${previousCd.title}`}
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

          {nextCd ? (
            <Link
              to={`/cd/${nextCd.id}`}
              className="inline-flex items-center gap-2 text-zinc-700 hover:text-zinc-900 font-semibold py-2 px-3 rounded-lg hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-800"
              aria-label={`Next album: ${nextCd.title}`}
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
          <h3 className="text-2xl font-bold text-zinc-800 mb-4">You Might Also Like</h3>
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
        item={cd}
      />
    </div>
  );
};

export default DetailView;