import React, { useMemo } from 'react';
import { WantlistItem, DiscographyAlbum } from '../types';
import { areStringsSimilar } from '../utils';
import { PlusIcon } from './icons/PlusIcon';
import { CheckIcon } from './icons/CheckIcon';
import { QuestionMarkCircleIcon } from './icons/QuestionMarkCircleIcon';

interface MissingAlbumItemProps {
  album: DiscographyAlbum;
  artistName: string;
  wantlist: WantlistItem[];
  onAddToWantlist: () => void;
}

const MissingAlbumItem: React.FC<MissingAlbumItemProps> = ({ album, artistName, wantlist, onAddToWantlist }) => {
  const isOnWantlist = useMemo(() => {
    return wantlist.some(item =>
      areStringsSimilar(item.artist, artistName) && areStringsSimilar(item.title, album.title, 0.9)
    );
  }, [wantlist, artistName, album.title]);

  return (
    <div className={`flex items-center gap-3 p-3 rounded-md border transition-colors duration-300 ${
        isOnWantlist 
            ? 'bg-green-50 border-green-200' 
            : 'bg-zinc-50 border-zinc-200'
    }`}>
      <div className="flex-shrink-0">
        <QuestionMarkCircleIcon className={`w-8 h-8 transition-colors duration-300 ${isOnWantlist ? 'text-green-400' : 'text-zinc-400'}`} />
      </div>
      <div className="flex-grow">
        <p className={`font-semibold transition-colors duration-300 ${isOnWantlist ? 'text-green-900' : 'text-zinc-800'}`}>{album.title}</p>
        <p className={`text-sm transition-colors duration-300 ${isOnWantlist ? 'text-green-700' : 'text-zinc-600'}`}>{album.year}</p>
      </div>
      <div className="flex-shrink-0">
        {isOnWantlist ? (
          <button
            type="button"
            disabled
            className="flex items-center gap-1.5 text-sm font-semibold py-1.5 px-3 rounded-md bg-green-100 text-green-700"
          >
            <CheckIcon className="w-4 h-4" />
            On Wantlist
          </button>
        ) : (
          <button
            type="button"
            onClick={onAddToWantlist}
            className="flex items-center gap-1.5 text-sm font-semibold py-1.5 px-3 rounded-md bg-white text-zinc-700 border border-zinc-300 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-800"
          >
            <PlusIcon className="w-4 h-4" />
            Add to Wantlist
          </button>
        )}
      </div>
    </div>
  );
};

export default React.memo(MissingAlbumItem);