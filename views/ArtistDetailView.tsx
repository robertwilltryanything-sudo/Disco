import React, { useState, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CD, WantlistItem, DiscographyAlbum } from '../types';
import { getArtistDiscography } from '../gemini';
import { areStringsSimilar, capitalizeWords } from '../utils';
import { ArrowLeftIcon } from '../components/icons/ArrowLeftIcon';
import { SparklesIcon } from '../components/icons/SparklesIcon';
import { SpinnerIcon } from '../components/icons/SpinnerIcon';
import CDItem from '../components/CDItem';
import MissingAlbumItem from '../components/MissingAlbumItem';

interface ArtistDetailViewProps {
  cds: CD[];
  wantlist: WantlistItem[];
  onAddToWantlist: (item: Omit<WantlistItem, 'id' | 'created_at'>) => Promise<void>;
}

const ArtistDetailView: React.FC<ArtistDetailViewProps> = ({ cds, wantlist, onAddToWantlist }) => {
    const { artistName: encodedArtistName } = useParams<{ artistName: string }>();
    const artistName = decodeURIComponent(encodedArtistName || '');

    const [scanStatus, setScanStatus] = useState<'idle' | 'loading' | 'error' | 'done'>('idle');
    const [missingAlbums, setMissingAlbums] = useState<DiscographyAlbum[]>([]);
    const [ownedInDiscography, setOwnedInDiscography] = useState<DiscographyAlbum[]>([]);
    const [apiError, setApiError] = useState<string | null>(null);

    const userAlbumsByArtist = useMemo(() => {
        return cds
            .filter(cd => areStringsSimilar(cd.artist, artistName))
            .sort((a, b) => (a.year || 0) - (b.year || 0));
    }, [cds, artistName]);

    const handleCompare = useCallback(async () => {
        setScanStatus('loading');
        setMissingAlbums([]);
        setOwnedInDiscography([]);
        setApiError(null);

        try {
            const officialDiscography = await getArtistDiscography(artistName);

            if (!officialDiscography) {
                throw new Error("Could not retrieve discography. The artist may not be found or the API may be unavailable.");
            }

            const missing: DiscographyAlbum[] = [];
            const owned: DiscographyAlbum[] = [];

            officialDiscography.forEach(album => {
                const isOwned = userAlbumsByArtist.some(ownedCd => areStringsSimilar(ownedCd.title, album.title, 0.9));
                if (isOwned) {
                    owned.push(album);
                } else {
                    missing.push(album);
                }
            });
            
            setMissingAlbums(missing.sort((a, b) => (a.year || 0) - (b.year || 0)));
            setOwnedInDiscography(owned.sort((a, b) => (a.year || 0) - (b.year || 0)));
            setScanStatus('done');
        } catch (error) {
            console.error(error);
            setApiError(error instanceof Error ? error.message : "An unknown error occurred.");
            setScanStatus('error');
        }
    }, [artistName, userAlbumsByArtist]);
    
    const handleAddToWantlist = useCallback(async (album: DiscographyAlbum) => {
        await onAddToWantlist({
            artist: artistName,
            title: album.title,
            year: album.year,
        });
    }, [onAddToWantlist, artistName]);

    return (
        <div className="max-w-4xl mx-auto">
            <div className="mb-6 flex justify-between items-center">
                <div>
                    <Link to="/artists" className="inline-flex items-center gap-2 text-sm text-zinc-600 hover:text-zinc-900 font-medium mb-1">
                        <ArrowLeftIcon className="h-4 w-4" />
                        All Artists
                    </Link>
                    <h1 className="text-3xl font-bold text-zinc-800">{capitalizeWords(artistName)}</h1>
                </div>
            </div>

            <div className="bg-white rounded-lg border border-zinc-200 p-6">
                <h2 className="text-xl font-bold text-zinc-800">In Your Collection ({userAlbumsByArtist.length})</h2>
                {userAlbumsByArtist.length > 0 ? (
                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {userAlbumsByArtist.map(cd => (
                            <CDItem key={cd.id} cd={cd} />
                        ))}
                    </div>
                ) : (
                    <p className="mt-2 text-zinc-500">You don't have any albums by this artist yet.</p>
                )}
            </div>
            
            <div className="mt-6 bg-white rounded-lg border border-zinc-200 p-6">
                {scanStatus === 'idle' && (
                     <div className="text-center">
                        <h2 className="text-xl font-bold text-zinc-800">Missing Something?</h2>
                        <p className="mt-2 text-zinc-600 max-w-md mx-auto">Compare your collection against this artist's official studio discography to find out what you're missing.</p>
                        <button
                            onClick={handleCompare}
                            className="mt-4 flex items-center justify-center gap-2 bg-zinc-900 text-white font-bold py-2 px-6 rounded-lg hover:bg-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900"
                        >
                            <SparklesIcon className="w-5 h-5" />
                            Check for Missing Albums
                        </button>
                    </div>
                )}
                {scanStatus === 'loading' && (
                    <div className="text-center py-8">
                        <SpinnerIcon className="h-8 w-8 text-zinc-500 mx-auto" />
                        <p className="text-zinc-600 mt-2">Fetching discography from Gemini...</p>
                    </div>
                )}
                {scanStatus === 'error' && (
                    <div className="text-center">
                         <h2 className="text-xl font-bold text-red-600">Scan Failed</h2>
                         <p className="mt-2 text-zinc-600 max-w-md mx-auto">{apiError}</p>
                         <button
                            onClick={handleCompare}
                            className="mt-4 flex items-center justify-center gap-2 bg-zinc-900 text-white font-bold py-2 px-4 rounded-lg hover:bg-black"
                         >
                             Try Again
                         </button>
                    </div>
                )}
                {scanStatus === 'done' && (
                    <div>
                        <h2 className="text-xl font-bold text-zinc-800 mb-4 text-center">Discography Comparison</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <div>
                                <h3 className="font-bold text-zinc-800 mb-2">Missing From Your Collection ({missingAlbums.length})</h3>
                                {missingAlbums.length > 0 ? (
                                    <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                                        {missingAlbums.map(album => (
                                            <MissingAlbumItem
                                                key={`${album.title}-${album.year}`}
                                                album={album}
                                                artistName={artistName}
                                                wantlist={wantlist}
                                                onAddToWantlist={() => handleAddToWantlist(album)}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-zinc-500 bg-zinc-50 p-3 rounded-md">Nothing is missing. You have them all!</p>
                                )}
                           </div>
                           <div>
                               <h3 className="font-bold text-zinc-800 mb-2">In Your Collection ({ownedInDiscography.length})</h3>
                               {ownedInDiscography.length > 0 ? (
                                <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
                                    {ownedInDiscography.map(album => (
                                        <div key={`${album.title}-${album.year}`} className="bg-green-50 text-green-800 p-3 rounded-md border border-green-200">
                                            <p className="font-semibold">{album.title}</p>
                                            <p className="text-sm">{album.year}</p>
                                        </div>
                                    ))}
                                </div>
                               ) : (
                                <p className="text-sm text-zinc-500 bg-zinc-50 p-3 rounded-md">None of your albums matched the official studio discography.</p>
                               )}
                           </div>
                        </div>
                        <div className="mt-6 text-center">
                            <button
                                onClick={handleCompare}
                                className="text-sm font-semibold text-zinc-600 hover:text-zinc-900"
                            >
                                Run Scan Again
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ArtistDetailView;
