
import React, { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CD } from '../types';
import { ArrowLeftIcon } from '../components/icons/ArrowLeftIcon';
import { areStringsSimilar } from '../utils';
import { SparklesIcon } from '../components/icons/SparklesIcon';
import { SpinnerIcon } from '../components/icons/SpinnerIcon';
import DuplicateGroup from '../components/DuplicateGroup';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';

interface DuplicatesViewProps {
  cds: CD[];
  onDeleteCD: (id: string) => void;
}

const DuplicatesView: React.FC<DuplicatesViewProps> = ({ cds, onDeleteCD }) => {
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'done'>('idle');
  const [duplicateGroups, setDuplicateGroups] = useState<CD[][]>([]);
  const [cdToDelete, setCdToDelete] = useState<CD | null>(null);

  const runScan = useCallback(() => {
    const checkedIds = new Set<string>();
    const groups: CD[][] = [];
    
    for (let i = 0; i < cds.length; i++) {
        const cd1 = cds[i];
        if (checkedIds.has(cd1.id)) continue;

        const currentGroup: CD[] = [cd1];

        for (let j = i + 1; j < cds.length; j++) {
            const cd2 = cds[j];
            if (checkedIds.has(cd2.id)) continue;

            const artistSimilar = areStringsSimilar(cd1.artist, cd2.artist, 0.85);
            const titleSimilar = areStringsSimilar(cd1.title, cd2.title, 0.85);

            if (artistSimilar && titleSimilar) {
                currentGroup.push(cd2);
            }
        }

        if (currentGroup.length > 1) {
            groups.push(currentGroup);
            currentGroup.forEach(cd => checkedIds.add(cd.id));
        }
    }
    setDuplicateGroups(groups);
  }, [cds]);

  const handleScan = useCallback(() => {
    setScanStatus('scanning');
    
    // Use a timeout to allow the UI to update to the "scanning" state before the blocking loop starts
    setTimeout(() => {
        runScan();
        setScanStatus('done');
    }, 50); // Small delay
  }, [runScan]);

  // Re-run the scan whenever the underlying CD collection changes, if a scan has already been performed.
  // This keeps the duplicate list in sync after deletions.
  useEffect(() => {
    if (scanStatus === 'done') {
      runScan();
    }
  }, [cds, scanStatus, runScan]);

  const handleRequestDelete = useCallback((cd: CD) => {
    setCdToDelete(cd);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (cdToDelete) {
      onDeleteCD(cdToDelete.id);
      setCdToDelete(null);
    }
  }, [cdToDelete, onDeleteCD]);

  const renderContent = () => {
    if (scanStatus === 'scanning') {
      return (
        <div className="text-center py-10 px-4">
          <SpinnerIcon className="h-8 w-8 text-zinc-500 mx-auto" />
          <p className="text-zinc-600 mt-2">Scanning your collection for duplicates...</p>
        </div>
      );
    }

    if (scanStatus === 'done') {
      if (duplicateGroups.length === 0) {
        return (
          <div className="text-center py-10 px-4 bg-green-50 rounded-lg border border-dashed border-green-300">
            <p className="text-green-800 font-semibold">No duplicates found!</p>
            <p className="text-sm text-green-700 mt-1">Your collection looks clean.</p>
          </div>
        );
      }
      return (
        <div className="space-y-6">
            <p className="text-zinc-600">Found <span className="font-bold text-zinc-800">{duplicateGroups.length}</span> potential duplicate group(s).</p>
            {duplicateGroups.map((group) => (
                <DuplicateGroup 
                    key={group.map(cd => cd.id).join('-')} 
                    group={group} 
                    onRequestDelete={handleRequestDelete}
                />
            ))}
        </div>
      );
    }
    
    // Initial 'idle' state
    return (
       <div className="text-center py-10 px-4 bg-zinc-50 rounded-lg border border-dashed border-zinc-300">
            <p className="text-zinc-600">This tool helps you find and merge similar entries in your collection.</p>
            <p className="text-sm text-zinc-500 mt-1">Click the button below to start the scan.</p>
        </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-zinc-800">Find Duplicates</h1>
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-zinc-600 hover:text-zinc-900 font-medium"
        >
          <ArrowLeftIcon className="h-5 w-5" />
          Back to Collection
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-zinc-200 p-6">
        <div className="flex justify-center mb-6">
            <button
                onClick={handleScan}
                disabled={scanStatus === 'scanning'}
                className="flex items-center justify-center gap-2 bg-zinc-900 text-white font-bold py-2 px-6 rounded-lg hover:bg-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900 disabled:bg-zinc-500"
            >
                {scanStatus === 'scanning' ? (
                    <>
                        <SpinnerIcon className="w-5 h-5" />
                        Scanning...
                    </>
                ) : (
                    <>
                        <SparklesIcon className="w-5 h-5" />
                        {scanStatus === 'done' ? 'Scan Again' : 'Scan for Duplicates'}
                    </>
                )}
            </button>
        </div>
        
        {renderContent()}

      </div>
      <ConfirmDeleteModal
        isOpen={!!cdToDelete}
        onClose={() => setCdToDelete(null)}
        onConfirm={handleConfirmDelete}
        cd={cdToDelete}
      />
    </div>
  );
};

export default DuplicatesView;
