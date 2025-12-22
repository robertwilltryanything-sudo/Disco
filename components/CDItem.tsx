import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CD } from '../types';
import { MusicNoteIcon } from './icons/MusicNoteIcon';

interface CDItemProps {
  cd: CD;
}

const CDItem: React.FC<CDItemProps> = ({ cd }) => {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const ref = useRef<HTMLAnchorElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { 
          setIsIntersecting(true); 
          observer.unobserve(entry.target); 
      }
    }, { rootMargin: "300px" });
    
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const handleArtistClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigate({ pathname: '/', search: `?q=${encodeURIComponent(cd.artist)}` });
  }, [cd.artist, navigate]);
  
  const details = useMemo(() => [cd.genre, cd.year].filter(Boolean).join(' • '), [cd.genre, cd.year]);

  return (
    <Link 
        ref={ref} 
        to={`/cd/${cd.id}`} 
        className="block group relative bg-white rounded-xl border border-zinc-200 overflow-hidden hover:border-zinc-800"
    >
       <div className="relative aspect-square overflow-hidden bg-zinc-100 flex items-center justify-center">
        {cd.cover_art_url ? (
            isIntersecting ? (
                <img 
                    src={cd.cover_art_url} 
                    alt={`${cd.title} cover`} 
                    className="w-full h-full object-cover" 
                />
            ) : (
                <div className="w-full h-full bg-zinc-200" />
            )
        ) : (
            <MusicNoteIcon className="w-10 h-10 text-zinc-300" />
        )}
      </div>
      <div className="p-4">
        <h3 className="font-bold text-sm text-zinc-900 truncate mb-0.5" title={cd.title}>{cd.title}</h3>
        <button
          onClick={handleArtistClick}
          className="text-left w-full text-xs text-zinc-400 font-bold uppercase tracking-tight truncate hover:text-zinc-900"
        >
          {cd.artist}
        </button>
        {details && <p className="text-[10px] text-zinc-300 font-medium mt-1.5">{details}</p>}
      </div>
    </Link>
  );
};

export default React.memo(CDItem);