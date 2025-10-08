

import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CD } from '../types';
import { getAlbumTrivia } from '../gemini';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { MusicNoteIcon } from './icons/MusicNoteIcon';
import { capitalizeWords } from '../utils';

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

            } catch (err) {
                console.error("Failed to fetch trivia", err);
                const errorMessage = (err as any)?.toString() ?? '';
                if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
                    setError("Trivia is unavailable due to high demand. Please check back later.");
                } else {
                    setError("Could not load trivia at this time.");
                }
            } finally {
                setIsLoading(false);
            }
        };
        fetchTrivia();
    }, [cd]); // Re-fetch if the featured CD changes

    const handleArtistClick = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        navigate('/', { state: { filterByArtist: cd.artist } });
    }, [cd.artist, navigate]);

    return (
        <Link
          to={`/cd/${cd.id}`}
          className="block group bg-white rounded-md border border-zinc-200 overflow-hidden hover:border-zinc-300 flex flex-col md:flex-row"
          aria-label={`View details for featured album: ${cd.title} by ${cd.artist}`}
        >
            <div className="md:w-64 md:flex-shrink-0">
                {cd.coverArtUrl ? (
                    <img src={cd.coverArtUrl} alt={`${cd.title} cover`} className="w-full object-cover aspect-square" />
                ) : (
                    <div className="w-full bg-zinc-200 flex items-center justify-center aspect-square">
                        <MusicNoteIcon className="w-24 h-24 text-zinc-400" />
                    </div>
                )}
            </div>
            <div className="p-4 md:p-6 flex flex-col justify-start flex-grow">
                <p className="text-sm font-bold uppercase tracking-wider text-zinc-500 mb-2">Featured Album</p>
                <h3 className="text-2xl font-bold text-zinc-900">{cd.title}</h3>
                <button
                    onClick={handleArtistClick}
                    className="text-left text-lg text-zinc-600 hover:text-zinc-900 hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500 rounded-sm"
                    title={cd.artist}
                >
                    {capitalizeWords(cd.artist)}
                </button>
                <div className="mt-4 pt-4 border-t border-zinc-200">
                     {isLoading ? (
                        <div className="flex items-center text-zinc-500">
                            <SpinnerIcon className="w-4 h-4 mr-2" />
                            <span>Loading trivia...</span>
                        </div>
                    ) : error ? (
                        <p className="text-red-600 text-sm">{error}</p>
                    ) : (
                        <p className="text-zinc-700 italic text-sm">"{trivia}"</p>
                    )}
                </div>
            </div>
        </Link>
    );
};

export default React.memo(FeaturedAlbum);