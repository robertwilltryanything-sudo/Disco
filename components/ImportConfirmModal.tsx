

import React from 'react';

interface ImportConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMerge: () => void;
  onReplace: () => void;
  importCount: number;
}

const ImportConfirmModal: React.FC<ImportConfirmModalProps> = ({ isOpen, onClose, onMerge, onReplace, importCount }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-dialog-title"
    >
      <div className="bg-white rounded-lg border border-zinc-200 p-6 m-4 max-w-md w-full">
        <h2 id="import-dialog-title" className="text-xl font-bold text-zinc-800">Confirm Import</h2>
        <p className="mt-2 text-zinc-600">
          You are about to import <strong className="font-semibold text-zinc-900">{importCount}</strong> album(s).
        </p>
        <p className="mt-4 text-zinc-600">
          Would you like to <strong className="font-semibold text-zinc-900">merge</strong> this with your current collection or <strong className="font-semibold text-zinc-900">replace</strong> it entirely?
        </p>

        <div className="mt-6 flex flex-col sm:flex-row-reverse gap-3">
          <button
            onClick={onReplace}
            className="w-full sm:w-auto py-2 px-4 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            title="Deletes your current collection and replaces it with the imported data."
          >
            Replace
          </button>
           <button
            onClick={onMerge}
            className="w-full sm:w-auto py-2 px-4 rounded-lg bg-zinc-900 text-white font-bold hover:bg-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900"
            title="Adds the imported albums to your current collection."
          >
            Merge
          </button>
          <button
            onClick={onClose}
            className="w-full sm:w-auto sm:mr-auto py-2 px-4 rounded-lg bg-white text-zinc-700 font-medium border border-zinc-300 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-800"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(ImportConfirmModal);