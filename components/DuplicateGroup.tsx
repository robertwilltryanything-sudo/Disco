import React from 'react';
import { CD } from '../types';
import { MusicNoteIcon } from './icons/MusicNoteIcon';
import { TrashIcon } from './icons/TrashIcon';

interface DuplicateGroupProps {
  group: CD[];
  onRequestDelete: (cd: CD) => void;
}

const DuplicateGroup: React.FC<DuplicateGroupProps> = ({ group, onRequestDelete }) => {
  if (group.length < 2) return null;

  return (
    <div className="bg-zinc-50 rounded-lg border border-zinc-200">
      <div className="p-4 border-b border-zinc-200">
        <h3 className="font-bold text-zinc-800">
            {group[0].artist} - {group[0].title}
        </h3>
        <p className="text-sm text-zinc-500">{group.length} similar items found</p>
      </div>
      <div className="p-4 space-y-3">
        {group.map(cd => (
          <div key={cd.id} className="flex items-center gap-4 p-3 border border-zinc-200 rounded-lg bg-white">
            <div className="flex-shrink-0">
                {cd.coverArtUrl ? (
                    <img src={cd.coverArtUrl} alt={`${cd.title} cover`} className="w-16 h-16 object-cover rounded-md" />
                ) : (
                    <div className="w-16 h-16 bg-zinc-200 flex items-center justify-center rounded-md">
                        <MusicNoteIcon className="w-8 h-8 text-zinc-400" />
                    </div>
                )}
            </div>
            <div className="flex-grow">
              <p className="font-semibold text-zinc-900">{cd.title} {cd.version && <span className="text-sm font-normal text-zinc-600">({cd.version})</span>}</p>
              <p className="text-sm text-zinc-600">{cd.artist}</p>
              <div className="text-xs text-zinc-500 mt-1 space-x-2">
                {cd.year && <span>{cd.year}</span>}
                {cd.genre && <span>• {cd.genre}</span>}
                {cd.recordLabel && <span>• {cd.recordLabel}</span>}
              </div>
            </div>
            <button 
                onClick={() => onRequestDelete(cd)}
                className="p-2 text-red-500 hover:bg-red-50 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                aria-label={`Delete ${cd.title}`}
            >
                <TrashIcon className="w-5 h-5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DuplicateGroup;