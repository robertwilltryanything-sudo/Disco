import React, { useState, useCallback, useEffect } from 'react';
import { WantlistItem } from '../types';
import { ArrowLeftIcon } from '../components/icons/ArrowLeftIcon';
import { Link } from 'react-router-dom';
import { capitalizeWords } from '../utils';
import { PlusIcon } from '../components/icons/PlusIcon';
import { TrashIcon } from '../components/icons/TrashIcon';
import { ArrowUpCircleIcon } from '../components/icons/ArrowUpCircleIcon';
import { findCoverArt } from '../wikipedia';
import { MusicNoteIcon } from '../components/icons/MusicNoteIcon';
import { SpinnerIcon } from '../components/icons/SpinnerIcon';
import { LinkIcon } from '../components/icons/LinkIcon';
import { EditIcon } from '../components/icons/EditIcon';
import { GlobeIcon } from '../components/icons/GlobeIcon';
import CoverArtSelectorModal from '../components/CoverArtSelectorModal';
import { XIcon } from '../components/icons/XIcon';

interface WantlistViewProps {
    wantlist: WantlistItem[];
    onAdd: (item: Omit<WantlistItem, 'id' | 'created_at'>) => Promise<void>;
    onUpdate: (item: WantlistItem) => void;
    onDelete: (id: string) => void;
    onMoveToCollection: (item: WantlistItem) => void;
}

const WantlistItemEditor: React.FC<{
    item: WantlistItem;
    onSave: (updatedItem: WantlistItem) => void;
    onCancel: () => void;
}> = ({ item, onSave, onCancel }) => {
    const [artist, setArtist] = useState(item.artist);
    const [title, setTitle] = useState(item.title);
    const [notes, setNotes] = useState(item.notes || '');
    const [coverArtUrl, setCoverArtUrl] = useState(item.coverArtUrl);
    const [manualUrl, setManualUrl] = useState('');
    const [isFindingArt, setIsFindingArt] = useState(false);
    const [error, setError] = useState('');
    
    const [isSelectorOpen, setIsSelectorOpen] = useState(false);
    const [coverArtOptions, setCoverArtOptions] = useState<string[]>([]);

    const handleSave = () => {
        if (!artist.trim() || !title.trim()) {
            setError('Artist and Title are required.');
            return;
        }
        onSave({
            ...item,
            artist: capitalizeWords(artist.trim()),
            title: capitalizeWords(title.trim()),
            notes: notes.trim(),
            coverArtUrl,
        });
    };
    
    const handleSetArtFromUrl = useCallback(() => {
        if (manualUrl.trim()) {
            const url = manualUrl.trim();
            if (url.startsWith('http') && /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(url)) {
                setCoverArtUrl(url);
                setError('');
            } else {
                setError("Please enter a valid, direct image URL (e.g., ending in .jpg, .png).");
            }
        }
    }, [manualUrl]);

    const handleFindArt = useCallback(async () => {
        if (!artist || !title) {
            setError("Please enter an Artist and Title before searching for art.");
            return;
        }
        setIsFindingArt(true);
        setError('');
        try {
            const imageUrls = await findCoverArt(artist, title);
            if (imageUrls && imageUrls.length > 0) {
                if (imageUrls.length === 1) {
                    setCoverArtUrl(imageUrls[0]);
                } else {
                    setCoverArtOptions(imageUrls);
                    setIsSelectorOpen(true);
                }
            } else {
                setError("Could not find cover art online.");
            }
        } catch (error) {
            console.error("Error finding art online:", error);
            setError("An error occurred while searching for cover art.");
        } finally {
            setIsFindingArt(false);
        }
    }, [artist, title]);
    
    const handleSelectCoverArt = (url: string) => {
        setCoverArtUrl(url);
        setIsSelectorOpen(false);
    };

    const handleRemoveArt = () => setCoverArtUrl(undefined);

    return (
        <>
        <div className="bg-zinc-50 rounded-lg border-2 border-zinc-800 p-4 space-y-4">
            <div className="flex flex-col md:flex-row gap-4 items-start">
                <div className="md:w-1/3 w-1/2 mx-auto md:mx-0 flex flex-col items-center">
                    <div className="relative w-full group">
                        {coverArtUrl ? (
                            <>
                                <img src={coverArtUrl} alt="Album cover preview" className="w-full h-auto aspect-square object-cover rounded-lg" />
                                <button type="button" onClick={handleRemoveArt} className="absolute top-1 right-1 p-2 rounded-full bg-black bg-opacity-40 text-white opacity-0 group-hover:opacity-100 hover:bg-opacity-60 focus:opacity-100" aria-label="Remove cover art">
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            </>
                        ) : (
                            <div className="w-full h-auto aspect-square bg-zinc-200 flex items-center justify-center rounded-lg">
                                <MusicNoteIcon className="w-12 h-12 text-zinc-400" />
                            </div>
                        )}
                    </div>
                    <div className="space-y-2 mt-3 w-full">
                        <div className="flex gap-2">
                            <div className="relative flex-grow">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><LinkIcon className="h-4 w-4 text-zinc-400" /></div>
                                <input type="url" placeholder="Paste URL" value={manualUrl} onChange={(e) => setManualUrl(e.target.value)} className="w-full bg-white border border-zinc-300 rounded-lg py-2 px-3 pl-9 text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-800 text-sm" />
                            </div>
                            <button type="button" onClick={handleSetArtFromUrl} className="flex-shrink-0 bg-white border border-zinc-300 text-zinc-700 font-semibold py-2 px-3 rounded-lg hover:bg-zinc-100 text-sm">Set</button>
                        </div>
                        <button type="button" onClick={handleFindArt} disabled={isFindingArt || !artist || !title} className="w-full flex items-center justify-center gap-2 bg-white border border-zinc-300 text-zinc-700 font-semibold py-2 px-3 rounded-lg hover:bg-zinc-100 text-sm disabled:opacity-50">
                            {isFindingArt ? <SpinnerIcon className="h-4 w-4" /> : <GlobeIcon className="h-4 w-4" />}
                            Find
                        </button>
                    </div>
                </div>
                <div className="flex-1 w-full space-y-3">
                    <input type="text" placeholder="Artist*" value={artist} onChange={(e) => setArtist(e.target.value)} className="w-full bg-white border border-zinc-300 rounded-lg py-2 px-3 text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-800" />
                    <input type="text" placeholder="Title*" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-white border border-zinc-300 rounded-lg py-2 px-3 text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-800" />
                    <textarea placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full bg-white border border-zinc-300 rounded-lg py-2 px-3 text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-800" />
                    {error && <p className="text-red-500 text-sm">{error}</p>}
                </div>
            </div>
            <div className="flex justify-end gap-3">
                <button onClick={onCancel} className="bg-white text-zinc-700 font-medium py-2 px-4 rounded-lg border border-zinc-300 hover:bg-zinc-100">Cancel</button>
                <button onClick={handleSave} className="bg-zinc-900 text-white font-bold py-2 px-4 rounded-lg hover:bg-black">Save Changes</button>
            </div>
        </div>
        <CoverArtSelectorModal isOpen={isSelectorOpen} onClose={() => setIsSelectorOpen(false)} onSelect={handleSelectCoverArt} images={coverArtOptions} />
        </>
    );
};

const AddWantlistItemModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onAdd: (item: Omit<WantlistItem, 'id' | 'created_at'>) => Promise<void>;
}> = ({ isOpen, onClose, onAdd }) => {
    const [artist, setArtist] = useState('');
    const [title, setTitle] = useState('');
    const [notes, setNotes] = useState('');
    const [manualUrl, setManualUrl] = useState('');
    const [formError, setFormError] = useState<string | null>(null);
    const [isAdding, setIsAdding] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!artist.trim() || !title.trim()) {
            setFormError('Artist and Title are required.');
            return;
        }
        setIsAdding(true);
        setFormError(null);

        let finalCoverArtUrl: string | undefined = undefined;
        const trimmedManualUrl = manualUrl.trim();

        if (trimmedManualUrl) {
            if (trimmedManualUrl.startsWith('http') && /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(trimmedManualUrl)) {
                finalCoverArtUrl = trimmedManualUrl;
            } else {
                setFormError("Please enter a valid, direct image URL (e.g., ending in .jpg, .png).");
                setIsAdding(false);
                return;
            }
        } else {
            try {
                const imageUrls = await findCoverArt(artist.trim(), title.trim());
                if (imageUrls && imageUrls.length > 0) {
                    finalCoverArtUrl = imageUrls[0];
                }
            } catch (error) {
                console.error("Failed to fetch cover art for wantlist item:", error);
            }
        }

        await onAdd({
            artist: capitalizeWords(artist.trim()),
            title: capitalizeWords(title.trim()),
            notes: notes.trim(),
            coverArtUrl: finalCoverArtUrl,
        });

        onClose();
    };

    if (!isOpen) {
        return null;
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-start md:items-center justify-center z-40 p-4 overflow-y-auto" role="dialog" aria-modal="true">
            <div className="bg-white rounded-lg border border-zinc-200 w-full max-w-lg relative">
                <button onClick={onClose} className="absolute top-3 right-3 p-2 rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-500 z-10" aria-label="Close form">
                    <XIcon className="w-6 h-6" />
                </button>
                <div className="p-4 bg-zinc-50 rounded-lg">
                    <h2 className="text-xl font-bold text-zinc-900 mb-4">Add to Wantlist</h2>
                    {formError && <p className="text-red-500 text-sm mb-4">{formError}</p>}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input
                                type="text"
                                placeholder="Artist*"
                                value={artist}
                                onChange={(e) => setArtist(e.target.value)}
                                className="w-full bg-white border border-zinc-300 rounded-lg py-2 px-3 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-800"
                            />
                            <input
                                type="text"
                                placeholder="Title*"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full bg-white border border-zinc-300 rounded-lg py-2 px-3 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-800"
                            />
                        </div>
                        <textarea
                            placeholder="Notes (e.g., specific version, vinyl, etc.)"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={2}
                            className="w-full bg-white border border-zinc-300 rounded-lg py-2 px-3 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-800"
                        />
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <LinkIcon className="h-5 w-5 text-zinc-400" />
                            </div>
                            <input
                                type="url"
                                placeholder="Or paste a direct image URL for cover art"
                                value={manualUrl}
                                onChange={(e) => setManualUrl(e.target.value)}
                                className="w-full bg-white border border-zinc-300 rounded-lg py-2 px-3 pl-10 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-800"
                            />
                        </div>
                        <div className="flex justify-end gap-3 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="bg-white text-zinc-700 font-medium py-2 px-4 rounded-lg border border-zinc-300 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-800"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isAdding}
                                className="flex items-center justify-center gap-2 bg-zinc-900 text-white font-bold py-2 px-4 rounded-lg hover:bg-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900 disabled:bg-zinc-500 disabled:cursor-wait"
                            >
                                {isAdding ? (
                                    <>
                                        <SpinnerIcon className="h-5 w-5" />
                                        <span>Adding...</span>
                                    </>
                                ) : (
                                    <>
                                        <PlusIcon className="h-5 w-5" />
                                        Add Item
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};


const WantlistView: React.FC<WantlistViewProps> = ({ wantlist, onAdd, onUpdate, onDelete, onMoveToCollection }) => {
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingItemId, setEditingItemId] = useState<string | null>(null);

    const handleSaveItem = (updatedItem: WantlistItem) => {
        onUpdate(updatedItem);
        setEditingItemId(null);
    };

    return (
        <div className="max-w-4xl mx-auto">
            <div className="mb-6 flex justify-between items-center">
                <h1 className="text-3xl font-bold text-zinc-800">My Wantlist</h1>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="flex items-center justify-center gap-2 bg-zinc-900 text-white font-bold py-2 px-4 rounded-lg hover:bg-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900"
                    >
                        <PlusIcon className="h-5 w-5" />
                        Add Item
                    </button>
                    <Link to="/" className="hidden sm:inline-flex items-center gap-2 text-zinc-600 hover:text-zinc-900 font-medium">
                        <ArrowLeftIcon className="h-5 w-5" />
                        Back to Collection
                    </Link>
                </div>
            </div>

            <div className="space-y-4">
                {wantlist.length === 0 ? (
                     <div className="text-center py-10 px-4 bg-zinc-50 rounded-lg border border-dashed border-zinc-300">
                        <p className="text-zinc-600">Your wantlist is empty.</p>
                        <p className="text-sm text-zinc-500 mt-1">Use the form above to add an album you're looking for!</p>
                    </div>
                ) : (
                    wantlist.map(item => (
                        editingItemId === item.id ? (
                            <WantlistItemEditor 
                                key={item.id}
                                item={item}
                                onSave={handleSaveItem}
                                onCancel={() => setEditingItemId(null)}
                            />
                        ) : (
                            <div key={item.id} className="bg-white rounded-lg border border-zinc-200 p-4 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-4 flex-1 overflow-hidden">
                                    <div className="flex-shrink-0">
                                        {item.coverArtUrl ? (
                                            <img src={item.coverArtUrl} alt={`${item.title} cover`} className="w-16 h-16 object-cover rounded-md" />
                                        ) : (
                                            <div className="w-16 h-16 bg-zinc-200 flex items-center justify-center rounded-md">
                                                <MusicNoteIcon className="w-8 h-8 text-zinc-400" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                        <h3 className="font-bold text-lg text-zinc-900 truncate" title={item.title}>{item.title}</h3>
                                        <p className="text-zinc-700 truncate" title={item.artist}>{item.artist}</p>
                                        {item.notes && <p className="text-sm text-zinc-500 mt-2 italic truncate">"{item.notes}"</p>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <button 
                                        onClick={() => setEditingItemId(item.id)}
                                        className="p-2 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-800"
                                        title="Edit Item"
                                        aria-label={`Edit ${item.title}`}
                                    >
                                        <EditIcon className="w-6 h-6" />
                                    </button>
                                    <button 
                                        onClick={() => onMoveToCollection(item)}
                                        className="p-2 text-zinc-600 hover:text-green-600 hover:bg-green-50 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                                        title="Add to Collection"
                                        aria-label={`Add ${item.title} to collection`}
                                    >
                                        <ArrowUpCircleIcon className="w-6 h-6" />
                                    </button>
                                    <button 
                                        onClick={() => onDelete(item.id)}
                                        className="p-2 text-zinc-600 hover:text-red-600 hover:bg-red-50 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                                        title="Delete from Wantlist"
                                        aria-label={`Delete ${item.title} from wantlist`}
                                    >
                                        <TrashIcon className="w-6 h-6" />
                                    </button>
                                </div>
                            </div>
                        )
                    ))
                )}
            </div>
             <AddWantlistItemModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onAdd={onAdd}
            />
        </div>
    );
};

export default WantlistView;
