
import React from 'react';
import { Link } from 'react-router-dom';
import { CD } from '../types';
import { MusicNoteIcon } from './icons/MusicNoteIcon';

interface RecommendedCDItemProps {
  cd: CD;
}

const RecommendedCDItem: React.FC<RecommendedCDItemProps> = ({ cd }) => {
  return (
    <Link 
      to={`/cd/${cd.id}`} 
      className="block group"
      aria-label={`View details for ${cd.title} by ${cd.artist}`}
    >
      <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden hover:border-zinc-300">
        <div className="relative">
          {cd.coverArtUrl ? (
            <img src={cd.coverArtUrl} alt={`${cd.title} cover`} className="w-full h-auto aspect-square object-cover" />
          ) : (
            <div className="w-full h-auto aspect-square bg-zinc-200 flex items-center justify-center">
              <MusicNoteIcon className="w-10 h-10 text-zinc-400" />
            </div>
          )}
        </div>
        <div className="p-3">
          <h3 className="font-bold text-sm text-zinc-900 truncate" title={cd.title}>{cd.title}</h3>
          <p className="text-xs text-zinc-600 truncate" title={cd.artist}>{cd.artist}</p>
        </div>
      </div>
    </Link>
  );
};

export default React.memo(RecommendedCDItem);