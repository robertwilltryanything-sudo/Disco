import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CD } from '../types';
import { getAlbumTrivia } from '../gemini';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { MusicNoteIcon } from './icons/MusicNoteIcon';
import { sanitizeImageUrl } from '../utils';

interface FeaturedAlbumProps {
  cd: CD;
}

const FeaturedAlbum: React.FC<FeaturedAlbumProps> = ({ cd }) => {
    const [trivia, setTrivia] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();
    const safeCoverUrl = useMemo(() => sanitizeImageUrl(cd.cover_art_url), [cd.cover_art_url]);

    useEffect(() => {
        let isCancelled = false;
        const fetchTrivia = async () => {
            if (!cd) return;
            setIsLoading(true);
            setError(null);
            setTrivia('');

            const cacheKey = `trivia-cache-${cd.id}`;

            try {
                const cachedTrivia = localStorage.getItem(cacheKey);
                if (cachedTrivia) {
                    if (!isCancelled) {
                        setTrivia(cachedTrivia);
                        setIsLoading(false);
                    }
                    return;
                }

                const result = await getAlbumTrivia(cd.artist, cd.title);
                if (isCancelled) return;

                if (result) {
                    setTrivia(result);
                    try {
                        localStorage.setItem(cacheKey, result);
                    } catch {
                        // Ignore quota errors on trivia cache
                    }
                } else {
                    setTrivia("No trivia found for this album.");
                }
            } catch (err: any) {
                if (isCancelled) return;
                const msg = err.message || String(err);
                if (msg.includes('Quota') || msg.includes('429')) {
                    setError("Trivia paused (API limit).");
                } else {
                    setError("Trivia unavailable.");
                }
            } finally {
                if (!isCancelled) {
                    setIsLoading(false);
                }
            }
        };
        fetchTrivia();
        return () => {
            isCancelled = true;
        };
    }, [cd]);

    const handleCardClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).closest('a, button')) return;
        navigate(`/cd/${cd.id}`);
    }, [cd.id, navigate]);

    const handleArtistClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        navigate({
            pathname: '/',
            search: `?artist=${encodeURIComponent(cd.artist)}&sort=year&order=asc`
        });
    }, [cd.artist, navigate]);

    return (
        <div
          onClick={handleCardClick}
          className="block bg-white rounded-lg border border-zinc-200 overflow-hidden flex flex-col md:flex-row shadow-sm hover:shadow-md transition-shadow cursor-pointer"
        >
            <Link
              to={`/cd/${cd.id}`}
              className="md:w-64 flex-shrink-0 block"
              aria-label={`View details for featured album: ${cd.title} by ${cd.artist}`}
            >
                {safeCoverUrl ? (
                    <img 
                        src={safeCoverUrl} 
                        alt={`${cd.title} cover`} 
                        className="w-full object-cover aspect-square" 
                        referrerPolicy="no-referrer"
                    />
                ) : (
                    <div className="w-full bg-zinc-200 flex items-center justify-center aspect-square">
                        <MusicNoteIcon className="w-16 h-16 text-zinc-400" />
                    </div>
                )}
            </Link>
            <div className="p-6 flex flex-col justify-center flex-grow">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Featured Album</p>
                <Link to={`/cd/${cd.id}`} className="text-xl font-bold text-zinc-950 leading-tight hover:underline">
                    {cd.title}
                </Link>
                <button
                    type="button"
                    onClick={handleArtistClick}
                    className="text-left text-base text-zinc-600 hover:text-zinc-950 hover:underline transition-colors self-start"
                    title={cd.artist}
                >
                    {cd.artist}
                </button>
                <div className="mt-4 pt-4 border-t border-zinc-100 min-h-[3rem] flex items-center">
                     {isLoading ? (
                        <div className="flex items-center text-zinc-500 text-xs">
                            <SpinnerIcon className="w-3 h-3 animate-spin mr-2" />
                            <span>Discovering trivia...</span>
                        </div>
                    ) : error ? (
                        <p className="text-zinc-500 text-xs italic">{error}</p>
                    ) : (
                        <p className="text-zinc-700 italic text-sm leading-relaxed">"{trivia}"</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default React.memo(FeaturedAlbum);