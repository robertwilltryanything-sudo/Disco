import React from 'react';
import { WantlistItem } from '../types';
import WantlistTableRow from './WantlistTableRow';

interface WantlistTableProps {
  wantlist: WantlistItem[];
  onRequestEdit: (item: WantlistItem) => void;
  onDelete: (id: string) => void;
  onMoveToCollection: (item: WantlistItem) => void;
}

const WantlistTable: React.FC<WantlistTableProps> = ({ wantlist, ...props }) => {
  if (wantlist.length === 0) {
    return (
      <div className="text-center py-10 px-4 bg-white rounded-lg border border-dashed border-zinc-300">
        <p className="text-zinc-600">Your wantlist is empty.</p>
        <p className="text-sm text-zinc-500 mt-1">Click the add button to add an album you're looking for!</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-zinc-200 overflow-x-auto">
      <table className="w-full min-w-[600px] text-left">
        <thead className="bg-zinc-50/75 border-b border-zinc-200 text-sm font-semibold text-zinc-600 uppercase tracking-wider">
          <tr>
            <th className="p-3 w-16" aria-label="Cover Art"></th>
            <th className="p-3">Album</th>
            <th className="p-3 w-40 text-right" aria-label="Actions">Actions</th>
            <th className="p-3 hidden sm:table-cell">Details</th>
            <th className="p-3 hidden md:table-cell">Notes</th>
          </tr>
        </thead>
        <tbody>
          {wantlist.map(item => (
            <WantlistTableRow key={item.id} item={item} {...props} />
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default React.memo(WantlistTable);