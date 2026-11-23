import React, { useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { WantlistItem } from '../types';
import { MusicNoteIcon } from './icons/MusicNoteIcon';
import { CheckIcon } from './icons/CheckIcon';
import { EditIcon } from './icons/EditIcon';
import { TrashIcon } from './icons/TrashIcon';
import { sanitizeImageUrl } from '../utils';

interface WantlistItemCardProps {
  item: WantlistItem;
  onRequestEdit: (item: WantlistItem) => void;
  onDelete: (id: string) => void;
  onMoveToCollection: (item: WantlistItem) => void;
}

const WantlistItemCard: React.FC<WantlistItemCardProps> = ({ item, onRequestEdit, onDelete, onMoveToCollection }) => {
  const navigate = useNavigate();
  const safeCoverUrl = useMemo(() => sanitizeImageUrl(item.cover_art_url), [item.cover_art_url]);
  const details = useMemo(
    () => [Array.isArray(item.genre) ? item.genre.join(', ') : item.genre, item.year].filter(Boolean).join(' • '),
    [item.genre, item.year]
  );

  const handleCardClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('a, button')) return;
    navigate(`/wantlist/${item.id}`);
  }, [item.id, navigate]);

  const handleActionClick = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
  };

  return (
    <div
      onClick={handleCardClick}
      className="block relative bg-white rounded-lg border border-zinc-200 overflow-hidden cursor-pointer"
    >
      <div className="relative">
        {safeCoverUrl ? (
          <img 
            src={safeCoverUrl} 
            alt={`${item.title} cover`} 
            className="w-full h-auto aspect-square object-cover" 
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-auto aspect-square bg-zinc-200 flex items-center justify-center rounded-md">
            <MusicNoteIcon className="w-12 h-12 text-zinc-400" />
          </div>
        )}
        {/* Overlay permanently visible with fixed opacity */}
        <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center">
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={(e) => handleActionClick(e, () => onMoveToCollection(item))}
                    className="p-2 rounded-full bg-green-500 text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    aria-label="Found it!"
                    title="Found It!"
                >
                    <CheckIcon className="w-5 h-5" />
                </button>
                <button 
                    type="button"
                    onClick={(e) => handleActionClick(e, () => onRequestEdit(item))}
                    className="p-2 rounded-full bg-zinc-100 text-zinc-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-800"
                    title="Edit Item"
                    aria-label={`Edit ${item.title}`}
                >
                    <EditIcon className="w-5 h-5" />
                </button>
                <button 
                    type="button"
                    onClick={(e) => handleActionClick(e, () => onDelete(item.id))}
                    className="p-2 rounded-full bg-zinc-100 text-zinc-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                    title="Delete from Wantlist"
                    aria-label={`Delete ${item.title} from wantlist`}
                >
                    <TrashIcon className="w-5 h-5" />
                </button>
            </div>
        </div>
      </div>
      <div className="p-3">
        <Link to={`/wantlist/${item.id}`} className="block font-bold text-base text-zinc-900 truncate hover:underline" title={item.title}>
          {item.title}
        </Link>
        <button 
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            navigate({ pathname: '/', search: `?artist=${encodeURIComponent(item.artist)}&sort=year&order=asc` });
          }}
          className="text-sm text-zinc-600 truncate hover:underline text-left block w-full" 
          title={item.artist}
        >
          {item.artist}
        </button>
        {details && <p className="text-sm text-zinc-500 mt-1">{details}</p>}
      </div>
    </div>
  );
};

export default React.memo(WantlistItemCard);