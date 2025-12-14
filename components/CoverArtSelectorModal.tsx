import React from 'react';

interface CoverArtSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (imageUrl: string) => void;
  images: string[];
}

const CoverArtSelectorModal: React.FC<CoverArtSelectorModalProps> = ({ isOpen, onClose, onSelect, images }) => {
  if (!isOpen) {
    return null;
  }

  const handleSelect = (url: string) => {
    onSelect(url);
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="select-art-dialog-title"
    >
      <div className="bg-white rounded-lg border border-zinc-200 p-6 m-4 max-w-2xl w-full">
        <h2 id="select-art-dialog-title" className="text-xl font-bold text-zinc-800">Choose Cover Art</h2>
        <p className="mt-1 text-zinc-600">
          Multiple options were found. Please select one.
        </p>
        <div className="mt-4 max-h-[60vh] overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-1">
          {images.map((url, index) => (
            <button
              key={index}
              onClick={() => handleSelect(url)}
              className="block group bg-white rounded-lg border border-zinc-200 overflow-hidden hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-800"
              aria-label={`Select cover art option ${index + 1}`}
            >
              <img src={url} alt={`Cover art option ${index + 1}`} className="w-full h-auto aspect-square object-cover" />
            </button>
          ))}
        </div>
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="py-2 px-4 rounded-lg bg-white text-zinc-700 font-medium border border-zinc-300 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white focus:ring-zinc-800"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default CoverArtSelectorModal;