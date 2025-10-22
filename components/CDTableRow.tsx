import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CD } from '../types';
import { MusicNoteIcon } from './icons/MusicNoteIcon';
import { EditIcon } from './icons/EditIcon';
import { capitalizeWords } from '../utils';

interface CDTableRowProps {
  cd: CD;
  onRequestEdit: (cd: CD) => void;
}

const CDTableRow: React.FC<CDTableRowProps> = ({ cd, onRequestEdit }) => {
  const navigate = useNavigate();

  const handleRowClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
    // Prevent navigation when clicking on the button inside the row
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }
    navigate(`/cd/${cd.id}`);
  };

  const handleEditClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation(); // Prevent row click from firing
    onRequestEdit(cd);
  };

  return (
    <tr
      className="border-b border-zinc-200 last:border-b-0 hover:bg-zinc-50 cursor-pointer"
      onClick={handleRowClick}
      aria-label={`View details for ${cd.title}`}
    >
      <td className="p-2">
        {cd.coverArtUrl ? (
          <img src={cd.coverArtUrl} alt={`${cd.title} cover`} className="w-12 h-12 object-cover rounded-md" />
        ) : (
          <div className="w-12 h-12 bg-zinc-200 flex items-center justify-center rounded-md">
            <MusicNoteIcon className="w-6 h-6 text-zinc-400" />
          </div>
        )}
      </td>
      <td className="p-3 font-bold text-zinc-900" title={cd.title}>{cd.title}</td>
      <td className="p-3 text-zinc-700" title={cd.artist}>{capitalizeWords(cd.artist)}</td>
      <td className="p-3 text-zinc-600 hidden sm:table-cell">{cd.genre}</td>
      <td className="p-3 text-zinc-600 hidden md:table-cell">{cd.year}</td>
      <td className="p-3 text-right">
        <button
          onClick={handleEditClick}
          className="p-2 text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200 rounded-full"
          aria-label={`Edit ${cd.title}`}
        >
          <EditIcon className="w-5 h-5" />
        </button>
      </td>
    </tr>
  );
};

export default React.memo(CDTableRow);