import React from 'react';
import { CD } from '../types';
import CDItem from './CDItem';

interface CDListProps {
  cds: CD[];
}

const CDList: React.FC<CDListProps> = ({ cds }) => {
  if (cds.length === 0) {
    return (
      <div className="text-center py-10 px-4 bg-zinc-50 rounded-lg border border-dashed border-zinc-300">
        <p className="text-zinc-600">No CDs found in your collection.</p>
        <p className="text-sm text-zinc-500 mt-1">Try changing your search or adding a new CD!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4 md:gap-6">
      {cds.map(cd => (
        <CDItem key={cd.id} cd={cd} />
      ))}
    </div>
  );
};

export default React.memo(CDList);