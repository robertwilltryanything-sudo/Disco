
import React from 'react';
import { SearchIcon } from './icons/SearchIcon';
import { XIcon } from './icons/XIcon';

interface SearchBarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ searchQuery, setSearchQuery }) => {
  return (
    <div className="relative h-full">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <SearchIcon className="h-5 w-5 text-zinc-400" />
      </div>
      <input
        type="text"
        placeholder="Search by artist or title..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full h-full bg-white border border-zinc-300 rounded-md py-2 pl-10 pr-10 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-800 focus:border-zinc-800"
      />
      {searchQuery && (
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
          <button
            onClick={() => setSearchQuery('')}
            className="p-1 rounded-full text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-400"
            aria-label="Clear search"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
};

export default React.memo(SearchBar);
