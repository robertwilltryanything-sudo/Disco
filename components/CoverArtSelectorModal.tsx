import React from 'react';

interface CoverArtSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (imageUrl: string) => void;
  onSkip?: () => void;
  images: string[];
  isSubmitting?: boolean;
}

const CoverArtSelectorModal: React.FC<CoverArtSelectorModalProps> = ({ isOpen, onClose, onSelect, onSkip, images, isSubmitting }) => {
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
      <div className="bg-white rounded-lg border border-zinc-200 p-6 m-4 max-w-2xl w-full shadow-2xl">
        <h2 id="select-art-dialog-title" className="text-xl font-bold text-zinc-800">Choose Cover Art</h2>
        <p className="mt-1 text-zinc-600">
          Multiple options were found. Please select the correct one.
        </p>
        <div className="mt-4 max-h-[60vh] overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-1">
          {images.map((url, index) => (
            <button
              key={index}
              onClick={() => handleSelect(url)}
              className="block bg-white rounded-lg border border-zinc-200 overflow-hidden focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-800 hover:border-zinc-400 transition-colors"
              aria-label={`Select cover art option ${index + 1}`}
            >
              <img src={url} alt={`Cover art option ${index + 1}`} className="w-full h-auto aspect-square object-cover" />
            </button>
          ))}
        </div>
        <div className="mt-6 flex flex-col sm:flex-row justify-end gap-3">
          {onSkip && (
            <button
              onClick={onSkip}
              className="py-2 px-4 rounded-lg bg-zinc-100 text-zinc-700 font-medium border border-zinc-200 hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-800 transition-colors"
            >
              {isSubmitting ? "No match - Save without artwork" : "No match - Clear artwork"}
            </button>
          )}
          <button
            onClick={onClose}
            className="py-2 px-4 rounded-lg bg-white text-zinc-500 font-medium border border-zinc-300 hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-800 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default CoverArtSelectorModal;