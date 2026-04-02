import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SearchIcon } from './icons/SearchIcon';
import { XIcon } from './icons/XIcon';

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (query: string) => void;
  albumType: string;
}

const SearchOverlay: React.FC<SearchOverlayProps> = ({ isOpen, onClose, onSearch, albumType }) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      // Small delay to ensure the animation has started before focusing
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
      onClose();
    }
  };

  // Close on Escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-white/90 backdrop-blur-xl p-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.98, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.98, opacity: 0, y: 10 }}
            transition={{ type: 'spring', damping: 30, stiffness: 400 }}
            className="w-full max-w-3xl"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <form onSubmit={handleSubmit} className="flex flex-col items-center gap-10">
              <div className="relative w-full group">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder={`Search your ${albumType.toLowerCase()}...`}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full text-3xl md:text-5xl font-bold text-zinc-950 bg-transparent border-b-2 border-zinc-950 pb-4 focus:outline-none placeholder:text-zinc-300 tracking-tight transition-all focus:border-zinc-400"
                />
                <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-4">
                    {query && (
                        <button
                            type="button"
                            onClick={() => setQuery('')}
                            className="p-2 text-zinc-400 hover:text-zinc-600 transition-colors"
                        >
                            <XIcon className="w-6 h-6 md:w-8 md:h-8" />
                        </button>
                    )}
                    <SearchIcon className="w-8 h-8 md:w-10 md:h-10 text-zinc-950 opacity-10 group-focus-within:opacity-100 transition-opacity" />
                </div>
              </div>
              
              <div className="flex flex-col items-center gap-6">
                <button
                    type="submit"
                    className="bg-zinc-950 text-white text-base md:text-lg font-bold py-4 px-12 rounded-xl hover:bg-black transition-all hover:shadow-lg active:scale-95 uppercase tracking-wider"
                >
                    Search {albumType}
                </button>
                <div className="flex items-center gap-2 text-zinc-400 text-[10px] md:text-xs font-bold uppercase tracking-widest">
                    <span>Press Enter to Search</span>
                    <span className="w-1 h-1 rounded-full bg-zinc-300"></span>
                    <span>Esc to Close</span>
                </div>
              </div>
            </form>
          </motion.div>
          
          {/* Close button in corner for accessibility */}
          <button 
            onClick={onClose}
            className="fixed top-8 right-8 p-4 text-zinc-900 hover:rotate-90 transition-transform duration-300"
            aria-label="Close search"
          >
            <XIcon className="w-10 h-10" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SearchOverlay;
