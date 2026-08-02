import React, { useMemo, useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CD, CollectionMode } from '../types';
import { areStringsSimilar } from '../utils';
import { ArrowLeftIcon } from '../components/icons/ArrowLeftIcon';
import CDItem from '../components/CDItem';
import { getArtistStudioDiscography } from '../gemini';

interface ArtistDetailViewProps {
  cds: CD[];
  collectionMode: CollectionMode;
}

interface DiscographyAlbum {
  title: string;
  year: number;
}

const ArtistDetailView: React.FC<ArtistDetailViewProps> = ({ cds, collectionMode }) => {
    const { artistName: encodedArtistName } = useParams<{ artistName: string }>();
    const artistName = decodeURIComponent(encodedArtistName || '');

    const [fullDiscography, setFullDiscography] = useState<DiscographyAlbum[] | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const userAlbumsByArtist = useMemo(() => {
        return cds
            .filter(cd => areStringsSimilar(cd.artist, artistName))
            .sort((a, b) => (a.year || 0) - (b.year || 0));
    }, [cds, artistName]);

    useEffect(() => {
        setFullDiscography(null);
        setError(null);
        setIsLoading(false);
    }, [artistName]);

    const handleFetchDiscography = async () => {
        if (!artistName || isLoading) return;
        setIsLoading(true);
        setError(null);
        try {
            const disc = await getArtistStudioDiscography(artistName);
            if (disc) {
                setFullDiscography(disc);
            } else {
                setError("To view missing albums, please ensure your Gemini API key is configured.");
            }
        } catch (err: any) {
            setError(err?.message || "Failed to load discography.");
        } finally {
            setIsLoading(false);
        }
    };

    const missingAlbums = useMemo(() => {
        if (!fullDiscography) return [];

        return fullDiscography.filter(discAlbum => {
            // Check if the user already owns this album
            const isOwned = userAlbumsByArtist.some(userAlbum => {
                const clean = (s: string) => s.toLowerCase()
                    .replace(/\(.*?\)/g, '') // remove anything in parentheses (special editions, remasters, etc.)
                    .replace(/\[.*?\]/g, '') // remove anything in brackets
                    .replace(/[^a-z0-9]/g, '') // keep only alphanumeric for robust matching
                    .trim();

                const cleanDisc = clean(discAlbum.title);
                const cleanUser = clean(userAlbum.title);

                // Exact match on cleaned string
                if (cleanDisc === cleanUser) return true;

                // One is a close substring of the other (handles "The Album" vs "Album" or vice versa)
                if (cleanDisc.includes(cleanUser) || cleanUser.includes(cleanDisc)) {
                    if (Math.abs(cleanDisc.length - cleanUser.length) < 8) return true;
                }

                // Fallback to Levenshtein check
                return areStringsSimilar(discAlbum.title, userAlbum.title, 0.8);
            });

            return !isOwned;
        });
    }, [fullDiscography, userAlbumsByArtist]);

    const albumTypePlural = collectionMode === 'vinyl' ? 'Vinyl' : 'CDs';

    return (
        <div className="max-w-4xl mx-auto">
            <div className="mb-6 flex justify-between items-center">
                <div>
                    <Link to="/artists" className="inline-flex items-center gap-2 text-sm text-zinc-600 hover:text-zinc-900 font-medium mb-1">
                        <ArrowLeftIcon className="h-4 w-4" />
                        All Artists
                    </Link>
                    <h1 className="text-3xl font-bold text-zinc-800">{artistName}</h1>
                </div>
            </div>

            <div className="bg-white rounded-lg border border-zinc-200 p-6">
                <h2 className="text-xl font-bold text-zinc-800">In Your {albumTypePlural} ({userAlbumsByArtist.length})</h2>
                {userAlbumsByArtist.length > 0 ? (
                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {userAlbumsByArtist.map(cd => (
                            <CDItem key={cd.id} cd={cd} />
                        ))}
                    </div>
                ) : (
                    <p className="mt-2 text-zinc-500">You don't have any {collectionMode}s by this artist yet.</p>
                )}
            </div>

            {/* Non-intrusive Missing Discography section */}
            <div className="mt-6 bg-zinc-50 rounded-lg border border-zinc-200 p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-bold text-zinc-800">Missing Main Studio Albums</h2>
                        <p className="text-xs text-zinc-500">Studio releases currently missing from your collection (ordered chronologically)</p>
                    </div>
                    {fullDiscography === null && !isLoading && (
                        <button
                            onClick={handleFetchDiscography}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-zinc-900 text-white hover:bg-zinc-800 rounded-md text-sm font-medium transition-colors shrink-0 shadow-xs"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            Find Missing Albums
                        </button>
                    )}
                    {isLoading && (
                        <div className="flex items-center gap-2 text-xs text-zinc-600 bg-white border border-zinc-200 rounded-md px-3 py-1.5 shrink-0">
                            <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-zinc-500 border-t-transparent"></div>
                            <span>Fetching discography...</span>
                        </div>
                    )}
                </div>

                {error && (
                    <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-zinc-100 border border-zinc-200 rounded-md p-3">
                        <p className="text-xs text-zinc-600">{error}</p>
                        <button
                            onClick={handleFetchDiscography}
                            className="text-xs font-semibold text-zinc-800 hover:text-zinc-900 underline shrink-0"
                        >
                            Try Again
                        </button>
                    </div>
                )}

                {!isLoading && !error && fullDiscography !== null && missingAlbums.length === 0 && (
                    <div className="text-center py-4 bg-white border border-dashed border-zinc-200 rounded-md mt-4">
                        <p className="text-zinc-600 text-sm font-medium">🎉 Congratulations! You have all of their main studio albums.</p>
                    </div>
                )}

                {!isLoading && missingAlbums.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                        {missingAlbums.map((album, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-white border border-zinc-150 rounded-md p-2.5 shadow-xs hover:border-zinc-300 transition-colors">
                                <span className="font-medium text-zinc-700 text-sm truncate mr-2" title={album.title}>
                                    {album.title}
                                </span>
                                <span className="text-[10px] font-mono px-2 py-0.5 bg-zinc-100 text-zinc-600 rounded shrink-0">
                                    {album.year}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ArtistDetailView;
