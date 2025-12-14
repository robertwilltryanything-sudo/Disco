import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CD } from '../types';
import { MusicNoteIcon } from './icons/MusicNoteIcon';
import { capitalizeWords } from '../utils';

interface CDItemProps {
  cd: CD;
}

const CDItem: React.FC<CDItemProps> = ({ cd }) => {
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

  const handleArtistClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (cd.artist) {
        navigate({
            pathname: '/',
            search: `?q=${encodeURIComponent(cd.artist)}`
        });
    }
  }, [cd.artist, navigate]);
  
  const details = useMemo(() => {
    return [cd.genre, cd.year].filter(Boolean).join(' • ');
  }, [cd.genre, cd.year]);

  return (
    <Link ref={ref} to={`/cd/${cd.id}`} className="block group relative bg-white rounded-lg border border-zinc-200 overflow-hidden hover:border-zinc-300">
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
          disabled={!cd.artist}
        >
          {capitalizeWords(cd.artist)}
        </button>
        {details && <p className="text-sm text-zinc-500 mt-1">{details}</p>}
      </div>
    </Link>
  );
};

export default React.memo(CDItem);