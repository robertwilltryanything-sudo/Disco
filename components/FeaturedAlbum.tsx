import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CD } from '../types';
import { getAlbumTrivia } from '../gemini';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { MusicNoteIcon } from './icons/MusicNoteIcon';

interface FeaturedAlbumProps {
  cd: CD;
}

const FeaturedAlbum: React.FC<FeaturedAlbumProps> = ({ cd }) => {
    const [trivia, setTrivia] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchTrivia = async () => {
            if (!cd) return;
            setIsLoading(true);
            setError(null);
            setTrivia('');

            const cacheKey = `trivia-cache-${cd.id}`;

            try {
                // Check cache first
                const cachedTrivia = localStorage.getItem(cacheKey);
                if (cachedTrivia) {
                    setTrivia(cachedTrivia);
                    setIsLoading(false);
                    return;
                }

                // If not in cache, fetch from API
                const result = await getAlbumTrivia(cd.artist, cd.title);
                const triviaText = result || "No trivia found for this album.";
                setTrivia(triviaText);
                
                // Store result in cache
                localStorage.setItem(cacheKey, triviaText);

            } catch (err: any) {
                const msg = err.message || String(err);
                if (msg.includes('Quota') || msg.includes('429')) {
                    setError("Trivia paused (API limit).");
                } else {
                    setError("Trivia unavailable.");
                }
            } finally {
                setIsLoading(false);
            }
        };
        fetchTrivia();
    }, [cd.id]);

    const handleArtistClick = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        navigate({
            pathname: '/',
            search: `?q=${encodeURIComponent(cd.artist)}`
        });
    }, [cd.artist, navigate]);

    return (
        <Link
          to={`/cd/${cd.id}`}
          className="block bg-white rounded-lg border border-zinc-200 overflow-hidden flex flex-col md:flex-row shadow-sm hover:shadow-md transition-shadow"
          aria-label={`View details for featured album: ${cd.title} by ${cd.artist}`}
        >
            <div className="md:w-64 flex-shrink-0">
                {cd.cover_art_url ? (
                    <img src={cd.cover_art_url} alt={`${cd.title} cover`} className="w-full object-cover aspect-square" />
                ) : (
                    <div className="w-full bg-zinc-200 flex items-center justify-center aspect-square">
                        <MusicNoteIcon className="w-16 h-16 text-zinc-400" />
                    </div>
                )}
            </div>
            <div className="p-6 flex flex-col justify-center flex-grow">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Featured Album</p>
                <h3 className="text-xl font-bold text-zinc-900 leading-tight">{cd.title}</h3>
                <button
                    onClick={handleArtistClick}
                    className="text-left text-base text-zinc-500 hover:text-zinc-800 transition-colors"
                    title={cd.artist}
                >
                    {cd.artist}
                </button>
                <div className="mt-4 pt-4 border-t border-zinc-100 min-h-[3rem] flex items-center">
                     {isLoading ? (
                        <div className="flex items-center text-zinc-400 text-xs">
                            <SpinnerIcon className="w-3 h-3 animate-spin mr-2" />
                            <span>Discovering trivia...</span>
                        </div>
                    ) : error ? (
                        <p className="text-zinc-400 text-xs italic">{error}</p>
                    ) : (
                        <p className="text-zinc-600 italic text-sm leading-relaxed">"{trivia}"</p>
                    )}
                </div>
            </div>
        </Link>
    );
};

export default React.memo(FeaturedAlbum);
