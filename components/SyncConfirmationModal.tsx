import React from 'react';
import { CD, WantlistItem } from '../types';
import { ArrowUpCircleIcon } from './icons/ArrowUpCircleIcon';
import { ArrowDownCircleIcon } from './icons/ArrowDownCircleIcon';
import { ClockIcon } from './icons/ClockIcon';
import { AlbumIcon } from './icons/AlbumIcon';
import { XCircleIcon } from './icons/XCircleIcon';

interface SyncStats {
    count: number;
    lastUpdated: string | null;
}

interface SyncConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    type: 'push' | 'pull';
    localStats: SyncStats;
    cloudStats: SyncStats;
    isProcessing: boolean;
}

const StatCard: React.FC<{ 
    title: string; 
    stats: SyncStats; 
    isTarget: boolean; 
    isReduction: boolean;
    icon: React.ReactNode;
}> = ({ title, stats, isTarget, isReduction, icon }) => (
    <div className={`flex-1 p-5 rounded-xl border-2 transition-all ${
        isTarget 
            ? (isReduction ? 'border-red-200 bg-red-50' : 'border-zinc-900 bg-zinc-50') 
            : 'border-zinc-200 bg-white'
    }`}>
        <div className="flex items-center gap-2 mb-4">
            <div className={`p-2 rounded-lg ${isTarget ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-500'}`}>
                {icon}
            </div>
            <h3 className="font-bold text-zinc-900 uppercase tracking-tight text-sm">{title}</h3>
        </div>
        
        <div className="space-y-3">
            <div>
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Total Items</p>
                <div className="flex items-baseline gap-2">
                    <span className={`text-3xl font-black ${isReduction && isTarget ? 'text-red-600' : 'text-zinc-900'}`}>
                        {stats.count}
                    </span>
                    <AlbumIcon className="w-5 h-5 text-zinc-300" />
                </div>
            </div>
            
            <div>
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Last Modified</p>
                <div className="flex items-center gap-2 text-zinc-600">
                    <ClockIcon className="w-4 h-4" />
                    <span className="text-xs font-medium">
                        {stats.lastUpdated ? new Date(stats.lastUpdated).toLocaleString() : 'Never'}
                    </span>
                </div>
            </div>
        </div>
    </div>
);

const SyncConfirmationModal: React.FC<SyncConfirmationModalProps> = ({ 
    isOpen, onClose, onConfirm, type, localStats, cloudStats, isProcessing 
}) => {
    if (!isOpen) return null;

    const isPush = type === 'push';
    const isReduction = isPush 
        ? localStats.count < cloudStats.count 
        : cloudStats.count < localStats.count;

    const actionLabel = isPush ? 'Push to Cloud' : 'Pull from Cloud';
    const directionIcon = isPush ? <ArrowUpCircleIcon className="w-5 h-5" /> : <ArrowDownCircleIcon className="w-5 h-5" />;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-zinc-200">
                <div className="p-6 border-b border-zinc-100 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-black text-zinc-900 uppercase tracking-tight flex items-center gap-2">
                            {actionLabel}
                        </h2>
                        <p className="text-zinc-500 text-sm font-medium mt-1">Review changes before proceeding</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-900 transition-colors">
                        <XCircleIcon className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6">
                    {isReduction && (
                        <div className="mb-6 p-4 bg-red-100 border border-red-200 rounded-xl flex items-start gap-3">
                            <XCircleIcon className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <h4 className="font-bold text-red-900 text-sm italic">Safety Warning: Item Count Reduction</h4>
                                <p className="text-red-800 text-xs mt-1 leading-relaxed">
                                    The {isPush ? 'incoming cloud version' : 'your local collection'} will have 
                                    <span className="font-black px-1 underline">
                                        {Math.abs(localStats.count - cloudStats.count)} fewer items
                                    </span> 
                                    than the current version. Are you sure you want to lower the amount of items in your collection?
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col md:flex-row gap-4 relative">
                        <StatCard 
                            title="Local Collection" 
                            stats={localStats} 
                            isTarget={!isPush} 
                            isReduction={!isPush && isReduction}
                            icon={<span className="font-black text-xs">LOCAL</span>}
                        />
                        
                        <div className="hidden md:flex items-center justify-center">
                            <div className="w-8 h-8 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-400">
                                {isPush ? <ArrowRightIcon className="w-4 h-4" /> : <ArrowLeftIcon className="w-4 h-4" />}
                            </div>
                        </div>

                        <StatCard 
                            title="Cloud Version" 
                            stats={cloudStats} 
                            isTarget={isPush} 
                            isReduction={isPush && isReduction}
                            icon={<span className="font-black text-xs">CLOUD</span>}
                        />
                    </div>
                </div>

                <div className="p-6 bg-zinc-50 border-t border-zinc-100 flex flex-col sm:flex-row gap-3">
                    <button
                        onClick={onConfirm}
                        disabled={isProcessing}
                        className={`flex-1 py-3 px-6 rounded-xl font-black text-white uppercase tracking-widest shadow-lg transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 ${
                            isReduction ? 'bg-red-600 hover:bg-red-700' : 'bg-zinc-900 hover:bg-black'
                        }`}
                    >
                        {isProcessing ? <SpinnerIcon className="w-5 h-5 animate-spin" /> : directionIcon}
                        <span>{isPush ? 'Overwrite Cloud' : 'Replace Local'}</span>
                    </button>
                    <button
                        onClick={onClose}
                        disabled={isProcessing}
                        className="flex-1 py-3 px-6 rounded-xl font-bold text-zinc-700 bg-white border border-zinc-200 hover:bg-zinc-100 transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

// Helper components for the icons used in the new modal
import { ArrowRightIcon } from './icons/ArrowRightIcon';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import { SpinnerIcon } from './icons/SpinnerIcon';

export default SyncConfirmationModal;