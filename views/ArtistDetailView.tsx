import React, { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CD, WantlistItem, CollectionMode } from '../types';
import { areStringsSimilar, capitalizeWords } from '../utils';
import { ArrowLeftIcon } from '../components/icons/ArrowLeftIcon';
import CDItem from '../components/CDItem';
import MissingAlbumScanner from '../components/MissingAlbumScanner';

interface ArtistDetailViewProps {
  cds: CD[];
  wantlist: WantlistItem[];
  onAddToWantlist: (item: Omit<WantlistItem, 'id' | 'created_at'>) => Promise<void>;
  collectionMode: CollectionMode;
}

const ArtistDetailView: React.FC<ArtistDetailViewProps> = ({ cds, wantlist, onAddToWantlist, collectionMode }) => {
    const { artistName: encodedArtistName } = useParams<{ artistName: string }>();
    const artistName = decodeURIComponent(encodedArtistName || '');

    const userAlbumsByArtist = useMemo(() => {
        return cds
            .filter(cd => areStringsSimilar(cd.artist, artistName))
            .sort((a, b) => (a.year || 0) - (b.year || 0));
    }, [cds, artistName]);

    const albumTypePlural = collectionMode === 'vinyl' ? 'Vinyl' : 'CDs';

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
            
            <div className="mt-6">
                <MissingAlbumScanner 
                    artistName={artistName}
                    userAlbumsByArtist={userAlbumsByArtist}
                    wantlist={wantlist}
                    onAddToWantlist={onAddToWantlist}
                />
            </div>
        </div>
    );
};

export default ArtistDetailView;