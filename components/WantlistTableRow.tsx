import React from 'react';
import { WantlistItem } from '../types';
import { MusicNoteIcon } from './icons/MusicNoteIcon';
import { EditIcon } from './icons/EditIcon';
import { TrashIcon } from './icons/TrashIcon';
import { CheckIcon } from './icons/CheckIcon';

interface WantlistTableRowProps {
  item: WantlistItem;
  onRequestEdit: (item: WantlistItem) => void;
  onDelete: (id: string) => void;
  onMoveToCollection: (item: WantlistItem) => void;
}

const WantlistTableRow: React.FC<WantlistTableRowProps> = ({ item, onRequestEdit, onDelete, onMoveToCollection }) => {
  const details = [item.genre, item.year].filter(Boolean).join(' • ');

  return (
    <tr className="border-b border-zinc-200 last:border-b-0">
      <td className="p-2">
        {item.coverArtUrl ? (
          <img src={item.coverArtUrl} alt={`${item.title} cover`} className="w-12 h-12 object-cover rounded-md" />
        ) : (
          <div className="w-12 h-12 bg-zinc-200 flex items-center justify-center rounded-md">
            <MusicNoteIcon className="w-6 h-6 text-zinc-400" />
          </div>
        )}
      </td>
      <td className="p-3">
        <p className="font-bold text-zinc-900" title={item.title}>{item.title}</p>
        <p className="text-sm text-zinc-600" title={item.artist}>{item.artist}</p>
      </td>
      <td className="p-3 text-zinc-600 hidden sm:table-cell">{details}</td>
      <td className="p-3 text-zinc-600 hidden md:table-cell italic truncate" title={item.notes || ''}>
        {item.notes ? `"${item.notes}"` : ''}
      </td>
      <td className="p-3 text-right">
        <div className="flex items-center justify-end gap-1">
            <button
                onClick={() => onMoveToCollection(item)}
                className="flex items-center justify-center gap-1.5 bg-green-100 text-green-800 font-bold py-2 px-3 rounded-lg hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 text-sm"
                aria-label={`Found ${item.title} and adding to collection`}
            >
                <CheckIcon className="w-4 h-4" />
                <span className="hidden lg:inline">Found It!</span>
            </button>
            <button 
                onClick={() => onRequestEdit(item)}
                className="p-2 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-800"
                title="Edit Item"
                aria-label={`Edit ${item.title}`}
            >
                <EditIcon className="w-5 h-5" />
            </button>
            <button 
                onClick={() => onDelete(item.id)}
                className="p-2 text-zinc-600 hover:text-red-600 hover:bg-red-50 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                title="Delete from Wantlist"
                aria-label={`Delete ${item.title} from wantlist`}
            >
                <TrashIcon className="w-5 h-5" />
            </button>
        </div>
      </td>
    </tr>
  );
};

export default React.memo(WantlistTableRow);