
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CD } from '../types';
import { TrashIcon } from './icons/TrashIcon';
import { MusicNoteIcon } from './icons/MusicNoteIcon';
import { EditIcon } from './icons/EditIcon';
import { capitalizeWords } from '../utils';

interface CDItemProps {
  cd: CD;
  onRequestDelete: (id: string) => void;
  onRequestEdit: (cd: CD) => void;
}

const CDItem: React.FC<CDItemProps> = ({ cd, onRequestDelete, onRequestEdit }) => {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const ref = useRef<HTMLAnchorElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsIntersecting(true);
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "200px" } // Pre-load images 200px before they become visible
    );

    const currentRef = ref.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, []);
  
  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onRequestDelete(cd.id);
  }, [cd.id, onRequestDelete]);
  
  const handleEdit = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onRequestEdit(cd);
  }, [cd, onRequestEdit]);

  const handleArtistClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigate('/', { state: { filterByArtist: cd.artist } });
  }, [cd.artist, navigate]);
  
  const details = useMemo(() => {
    return [cd.genre, cd.year].filter(Boolean).join(' • ');
  }, [cd.genre, cd.year]);

  return (
    <Link ref={ref} to={`/cd/${cd.id}`} className="block group relative bg-white rounded-md border border-zinc-200 overflow-hidden hover:border-zinc-300">
       <div className="relative">
        {isIntersecting ? (
          cd.coverArtUrl ? (
            <img src={cd.coverArtUrl} alt={`${cd.title} cover`} className="w-full h-auto aspect-square object-cover" />
          ) : (
            <div className="w-full h-auto aspect-square bg-zinc-200 flex items-center justify-center">
              <MusicNoteIcon className="w-12 h-12 text-zinc-400" />
            </div>
          )
        ) : (
          <div className="w-full h-auto aspect-square bg-zinc-200" />
        )}
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20" />
      </div>
      <div className="p-3">
        <h3 className="font-bold text-base text-zinc-900 truncate" title={cd.title}>{cd.title}</h3>
        <button
          onClick={handleArtistClick}
          className="text-left w-full text-sm text-zinc-600 truncate hover:text-zinc-900 hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500 rounded-sm"
          title={cd.artist}
        >
          {capitalizeWords(cd.artist)}
        </button>
        {details && <p className="text-sm text-zinc-500 mt-1">{details}</p>}
      </div>
       <div className="absolute top-2 right-2 flex flex-col gap-2">
         <button
            onClick={handleEdit}
            className="p-2 rounded-full bg-black bg-opacity-40 text-white opacity-0 group-hover:opacity-100 hover:bg-opacity-60 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label={`Edit ${cd.title}`}
          >
            <EditIcon className="w-5 h-5" />
          </button>
          <button
            onClick={handleDelete}
            className="p-2 rounded-full bg-black bg-opacity-40 text-white opacity-0 group-hover:opacity-100 hover:bg-opacity-60 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-red-500"
            aria-label={`Delete ${cd.title}`}
          >
            <TrashIcon className="w-5 h-5" />
          </button>
       </div>
    </Link>
  );
};

export default React.memo(CDItem);