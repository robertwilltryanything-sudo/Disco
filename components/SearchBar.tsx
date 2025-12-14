import React, { useState, useEffect, useCallback } from 'react';
import { SearchIcon } from './icons/SearchIcon';
import { XIcon } from './icons/XIcon';

interface SearchBarProps {
  initialQuery: string;
  onSearch: (query: string) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ initialQuery, onSearch }) => {
  const [value, setValue] = useState(initialQuery);

  // Sync internal state if the initialQuery prop changes (e.g., from URL)
  useEffect(() => {
    setValue(initialQuery);
  }, [initialQuery]);

  const handleClear = useCallback(() => {
    setValue('');
    onSearch('');
  }, [onSearch]);
  
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    onSearch(value);
  }, [onSearch, value]);

  return (
    <form onSubmit={handleSubmit} className="relative w-full">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <SearchIcon className="h-5 w-5 text-zinc-400" />
      </div>
      <input
        type="search"
        placeholder="Search your collection... (Press Enter)"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full bg-white border border-zinc-300 rounded-lg py-2 px-4 pl-10 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-800 focus:border-zinc-800"
        aria-label="Search collection"
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute inset-y-0 right-0 pr-3 flex items-center"
          aria-label="Clear search"
        >
          <XIcon className="h-5 w-5 text-zinc-400 hover:text-zinc-600" />
        </button>
      )}
    </form>
  );
};

export default React.memo(SearchBar);