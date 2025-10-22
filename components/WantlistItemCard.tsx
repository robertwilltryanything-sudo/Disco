import React from 'react';
import { Link } from 'react-router-dom';
import { WantlistItem } from '../types';
import { MusicNoteIcon } from './icons/MusicNoteIcon';
import { CheckIcon } from './icons/CheckIcon';
import { EditIcon } from './icons/EditIcon';
import { TrashIcon } from './icons/TrashIcon';
import { capitalizeWords } from '../utils';

interface WantlistItemCardProps {
  item: WantlistItem;
  onRequestEdit: (item: WantlistItem) => void;
  onDelete: (id: string) => void;
  onMoveToCollection: (item: WantlistItem) => void;
}

const WantlistItemCard: React.FC<WantlistItemCardProps> = ({ item, onRequestEdit, onDelete, onMoveToCollection }) => {
  const details = [item.genre, item.year].filter(Boolean).join(' • ');

  const handleActionClick = (e: React.MouseEvent, action: () => void) => {
    e.preventDefault();
    e.stopPropagation();
    action();
  };

  return (
    <Link to={`/wantlist/${item.id}`} className="block group relative bg-white rounded-lg border border-zinc-200 overflow-hidden">
      <div className="relative">
        {item.coverArtUrl ? (
          <img src={item.coverArtUrl} alt={`${item.title} cover`} className="w-full h-auto aspect-square object-cover" />
        ) : (
          <div className="w-full h-auto aspect-square bg-zinc-200 flex items-center justify-center">
            <MusicNoteIcon className="w-12 h-12 text-zinc-400" />
          </div>
        )}
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-colors duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
            <div className="flex items-center gap-2">
                <button
                    onClick={(e) => handleActionClick(e, () => onMoveToCollection(item))}
                    className="p-2 rounded-full bg-green-500 text-white hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    aria-label="Found it!"
                    title="Found It!"
                >
                    <CheckIcon className="w-5 h-5" />
                </button>
                <button 
                    onClick={(e) => handleActionClick(e, () => onRequestEdit(item))}
                    className="p-2 rounded-full bg-zinc-100 text-zinc-800 hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-800"
                    title="Edit Item"
                    aria-label={`Edit ${item.title}`}
                >
                    <EditIcon className="w-5 h-5" />
                </button>
                <button 
                    onClick={(e) => handleActionClick(e, () => onDelete(item.id))}
                    className="p-2 rounded-full bg-zinc-100 text-zinc-800 hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    title="Delete from Wantlist"
                    aria-label={`Delete ${item.title} from wantlist`}
                >
                    <TrashIcon className="w-5 h-5" />
                </button>
            </div>
        </div>
      </div>
      <div className="p-3">
        <h3 className="font-bold text-base text-zinc-900 truncate" title={item.title}>{item.title}</h3>
        <p className="text-sm text-zinc-600 truncate" title={item.artist}>
          {capitalizeWords(item.artist)}
        </p>
        {details && <p className="text-sm text-zinc-500 mt-1">{details}</p>}
      </div>
    </Link>
  );
};

export default React.memo(WantlistItemCard);