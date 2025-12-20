import React, { useState, useCallback } from 'react';
import { CD, WantlistItem, DiscographyAlbum } from '../types';
import { getArtistDiscography } from '../gemini';
import { areStringsSimilar } from '../utils';
import { SparklesIcon } from './icons/SparklesIcon';
import { SpinnerIcon } from './icons/SpinnerIcon';
import MissingAlbumItem from './MissingAlbumItem';

interface MissingAlbumScannerProps {
  artistName: string;
  userAlbumsByArtist: CD[];
  wantlist: WantlistItem[];
  onAddToWantlist: (item: Omit<WantlistItem, 'id' | 'created_at'>) => Promise<void>;
}

const MissingAlbumScanner: React.FC<MissingAlbumScannerProps> = ({ artistName, userAlbumsByArtist, wantlist, onAddToWantlist }) => {
    const [scanStatus, setScanStatus] = useState<'idle' | 'loading' | 'error' | 'done'>('idle');
    const [missingAlbums, setMissingAlbums] = useState<DiscographyAlbum[]>([]);
    const [ownedInDiscography, setOwnedInDiscography] = useState<DiscographyAlbum[]>([]);
    const [apiError, setApiError] = useState<string | null>(null);

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


    if (scanStatus === 'idle') {
         return (
             <div className="bg-white rounded-lg border border-zinc-200 p-6 text-center">
                <h2 className="text-xl font-bold text-zinc-800">Missing Something?</h2>
                <p className="mt-2 text-zinc-600 max-w-md mx-auto">Compare your collection against {artistName}'s official studio discography to find out what you're missing.</p>
                <button
                    type="button"
                    onClick={handleCompare}
                    className="mt-4 flex items-center justify-center gap-2 bg-zinc-900 text-white font-bold py-2 px-6 rounded-lg hover:bg-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900 mx-auto"
                >
                    <SparklesIcon className="w-5 h-5" />
                    Check for Missing Albums
                </button>
            </div>
         );
    }
    
    if (scanStatus === 'loading') {
        return (
            <div className="bg-white rounded-lg border border-zinc-200 p-6 text-center py-8">
                <SpinnerIcon className="h-8 w-8 text-zinc-500 mx-auto" />
                <p className="text-zinc-600 mt-2">Fetching discography from Gemini...</p>
            </div>
        );
    }

    if (scanStatus === 'error') {
         return (
            <div className="bg-white rounded-lg border border-zinc-200 p-6 text-center">
                 <h2 className="text-xl font-bold text-red-600">Scan Failed</h2>
                 <p className="mt-2 text-zinc-600 max-w-md mx-auto">{apiError}</p>
                 <button
                    type="button"
                    onClick={handleCompare}
                    className="mt-4 flex items-center justify-center gap-2 bg-zinc-900 text-white font-bold py-2 px-4 rounded-lg hover:bg-black mx-auto"
                 >
                     Try Again
                 </button>
            </div>
        );
    }
    
    if (scanStatus === 'done') {
        return (
            <div className="bg-white rounded-lg border border-zinc-200 p-6">
                <h2 className="text-xl font-bold text-zinc-800 mb-4 text-center">Discography Comparison for {artistName}</h2>
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
                        type="button"
                        onClick={handleCompare}
                        className="text-sm font-semibold text-zinc-600 hover:text-zinc-900"
                    >
                        Run Scan Again
                    </button>
                </div>
            </div>
        );
    }

    return null;
}

export default MissingAlbumScanner;