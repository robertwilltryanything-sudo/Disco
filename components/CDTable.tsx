import React from 'react';
import { CD } from '../types';
import CDTableRow from './CDTableRow';

interface CDTableProps {
  cds: CD[];
  onRequestEdit: (cd: CD) => void;
}

const CDTable: React.FC<CDTableProps> = ({ cds, onRequestEdit }) => {
  if (cds.length === 0) {
    return (
      <div className="text-center py-10 px-4 bg-zinc-50 rounded-lg border border-dashed border-zinc-300">
        <p className="text-zinc-600">No CDs found in your collection.</p>
        <p className="text-sm text-zinc-500 mt-1">Try changing your search or adding a new CD!</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-zinc-200 overflow-x-auto">
      <table className="w-full min-w-[600px] text-left">
        <thead className="bg-zinc-50/75 border-b border-zinc-200 text-sm font-semibold text-zinc-600 uppercase tracking-wider">
          <tr>
            <th className="p-3 w-16" aria-label="Cover Art"></th>
            <th className="p-3">Title</th>
            <th className="p-3">Artist</th>
            <th className="p-3 hidden sm:table-cell">Genre</th>
            <th className="p-3 hidden md:table-cell">Year</th>
            <th className="p-3 w-20" aria-label="Actions"></th>
          </tr>
        </thead>
        <tbody>
          {cds.map(cd => (
            <CDTableRow key={cd.id} cd={cd} onRequestEdit={onRequestEdit} />
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default React.memo(CDTable);