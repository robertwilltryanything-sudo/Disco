import React from 'react';
import { useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const details = [item.genre, item.year].filter(Boolean).join(' • ');

  const handleRowClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
    // Prevent navigation when clicking on a button inside the row
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }
    navigate(`/wantlist/${item.id}`);
  };

  return (
    <tr
      className="border-b border-zinc-200 last:border-b-0 hover:bg-zinc-50 cursor-pointer"
      onClick={handleRowClick}
      aria-label={`View details for ${item.title}`}
    >
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
      <td className="p-3 text-right">
        <div className="flex items-center justify-end gap-2">
            <button
                onClick={() => onMoveToCollection(item)}
                className="p-2 text-green-600 hover:text-green-800 hover:bg-green-100 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                title="Found It!"
                aria-label={`Found ${item.title} and adding to collection`}
            >
                <CheckIcon className="w-5 h-5" />
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
      <td className="p-3 text-zinc-600 hidden sm:table-cell">{details}</td>
      <td className="p-3 text-zinc-600 hidden md:table-cell italic truncate" title={item.notes || ''}>
        {item.notes ? `"${item.notes}"` : ''}
      </td>
    </tr>
  );
};

export default React.memo(WantlistTableRow);