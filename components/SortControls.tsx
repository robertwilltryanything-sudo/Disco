import React, { Dispatch, SetStateAction } from 'react';
import { SortKey, SortOrder } from '../types';
import { ArrowUpIcon } from './icons/ArrowUpIcon';
import { ArrowDownIcon } from './icons/ArrowDownIcon';

interface SortControlsProps {
  sortBy: SortKey;
  setSortBy: (key: SortKey) => void;
  sortOrder: SortOrder;
  setSortOrder: Dispatch<SetStateAction<SortOrder>>;
}

const SortControls: React.FC<SortControlsProps> = ({ sortBy, setSortBy, sortOrder, setSortOrder }) => {
  const toggleSortOrder = () => {
    setSortOrder(prevOrder => (prevOrder === 'asc' ? 'desc' : 'asc'));
  };

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="sort-by" className="text-sm font-medium text-zinc-600 flex-shrink-0">
        Sort by:
      </label>
      <select
        id="sort-by"
        value={sortBy}
        onChange={(e) => setSortBy(e.target.value as SortKey)}
        className="w-full bg-white border border-zinc-300 rounded-lg py-2 px-3 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-800 focus:border-zinc-800 appearance-none text-center"
        style={{ paddingRight: '2rem' }} // Add padding for custom arrow
      >
        <option value="created_at">Added Date</option>
        <option value="artist">Artist</option>
        <option value="title">Title</option>
        <option value="year">Year</option>
        <option value="genre">Genre</option>
        <option value="recordLabel">Record Label</option>
      </select>
      <button
        onClick={toggleSortOrder}
        className="p-2 rounded-lg bg-white border border-zinc-300 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-800"
        aria-label={`Sort in ${sortOrder === 'asc' ? 'descending' : 'ascending'} order`}
      >
        {sortOrder === 'asc' ? <ArrowUpIcon className="h-5 w-5" /> : <ArrowDownIcon className="h-5 w-5" />}
      </button>
    </div>
  );
};

export default React.memo(SortControls);