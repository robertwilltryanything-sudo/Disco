import React from 'react';
import { CD, WantlistItem } from '../types';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  item: (CD | WantlistItem) | null;
}

const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({ isOpen, onClose, onConfirm, item }) => {
  if (!isOpen || !item) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
    >
      <div className="bg-white rounded-lg border border-zinc-200 p-6 m-4 max-w-sm w-full">
        <h2 id="delete-dialog-title" className="text-xl font-bold text-red-600">Confirm Deletion</h2>
        <p className="mt-2 text-zinc-600">
          Are you sure you want to permanently delete <strong className="font-semibold text-zinc-800">"{item.title}"</strong> by <strong className="font-semibold text-zinc-800">{item.artist}</strong>?
        </p>
        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="py-2 px-4 rounded-lg bg-white text-zinc-700 font-medium border border-zinc-300 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white focus:ring-zinc-800"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="py-2 px-4 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white focus:ring-red-500"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(ConfirmDeleteModal);