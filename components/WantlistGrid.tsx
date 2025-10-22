import React from 'react';
import { WantlistItem } from '../types';
import WantlistItemCard from './WantlistItemCard';

interface WantlistGridProps {
  wantlist: WantlistItem[];
  onRequestEdit: (item: WantlistItem) => void;
  onDelete: (id: string) => void;
  onMoveToCollection: (item: WantlistItem) => void;
}

const WantlistGrid: React.FC<WantlistGridProps> = ({ wantlist, ...props }) => {
  if (wantlist.length === 0) {
    return (
      <div className="text-center py-10 px-4 bg-white rounded-lg border border-dashed border-zinc-300">
        <p className="text-zinc-600">Your wantlist is empty.</p>
        <p className="text-sm text-zinc-500 mt-1">Click the add button to add an album you're looking for!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
      {wantlist.map(item => (
        <WantlistItemCard key={item.id} item={item} {...props} />
      ))}
    </div>
  );
};

export default React.memo(WantlistGrid);