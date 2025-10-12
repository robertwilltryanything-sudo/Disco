import React, { useState, useEffect } from 'react';
import { CD } from '../types';
import { capitalizeWords } from '../utils';
import { MusicNoteIcon } from './icons/MusicNoteIcon';

interface ConfirmDuplicateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (version: string) => void;
  newCdData: Omit<CD, 'id'>;
  existingCd: CD;
}

const ConfirmDuplicateModal: React.FC<ConfirmDuplicateModalProps> = ({ isOpen, onClose, onConfirm, newCdData, existingCd }) => {
  const [version, setVersion] = useState('');

  useEffect(() => {
    if (isOpen) {
      // Pre-populate with version from form, allowing user to override.
      setVersion(newCdData.version || '');
    }
  }, [isOpen, newCdData.version]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="duplicate-dialog-title"
    >
      <div className="bg-white rounded-lg border border-zinc-200 p-6 m-4 max-w-md w-full">
        <h2 id="duplicate-dialog-title" className="text-xl font-bold text-zinc-800">Potential Duplicate</h2>
        <p className="mt-2 text-zinc-600">
          This entry looks very similar to one already in your collection.
        </p>

        <div className="mt-4 p-4 bg-zinc-50 border border-zinc-200 rounded-lg flex items-center gap-4">
            <div className="flex-shrink-0">
                {existingCd.coverArtUrl ? (
                    <img src={existingCd.coverArtUrl} alt={`${existingCd.title} cover`} className="w-16 h-16 object-cover rounded-lg" />
                ) : (
                    <div className="w-16 h-16 bg-zinc-200 flex items-center justify-center rounded-lg">
                        <MusicNoteIcon className="w-8 h-8 text-zinc-400" />
                    </div>
                )}
            </div>
            <div>
                <p className="font-bold text-zinc-900">{existingCd.title}</p>
                <p className="text-zinc-700">{capitalizeWords(existingCd.artist)}</p>
                {existingCd.year && <p className="text-sm text-zinc-500">{existingCd.year}</p>}
            </div>
        </div>

        <div className="mt-4">
          <label htmlFor="version-input" className="block text-sm font-medium text-zinc-700">
            If this is a different version, please specify it below.
          </label>
          <input
            id="version-input"
            type="text"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="e.g., SACD, Remaster, Bonus DVD"
            className="mt-1 w-full bg-white border border-zinc-300 rounded-lg py-2 px-3 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-800 focus:border-zinc-800"
          />
        </div>

        <p className="mt-4 text-zinc-600">
          Are you sure you want to add this as a new entry?
        </p>

        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="py-2 px-4 rounded-lg bg-white text-zinc-700 font-medium border border-zinc-300 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white focus:ring-zinc-800"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(version)}
            className="py-2 px-4 rounded-lg bg-zinc-900 text-white font-bold hover:bg-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white focus:ring-zinc-900"
          >
            Add Anyway
          </button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(ConfirmDuplicateModal);