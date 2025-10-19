import React, { useState, useCallback } from 'react';
import { WantlistItem } from '../types';
import { ArrowLeftIcon } from '../components/icons/ArrowLeftIcon';
import { Link } from 'react-router-dom';
import { capitalizeWords } from '../utils';
import { TrashIcon } from '../components/icons/TrashIcon';
import { ArrowUpCircleIcon } from '../components/icons/ArrowUpCircleIcon';
import { findCoverArt } from '../wikipedia';
import { MusicNoteIcon } from '../components/icons/MusicNoteIcon';
import { SpinnerIcon } from '../components/icons/SpinnerIcon';
import { LinkIcon } from '../components/icons/LinkIcon';
import { EditIcon } from '../components/icons/EditIcon';
import { GlobeIcon } from '../components/icons/GlobeIcon';
import CoverArtSelectorModal from '../components/CoverArtSelectorModal';
import AddWantlistItemForm from '../components/AddWantlistItemForm';
import { PlusIcon } from '../components/icons/PlusIcon';

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

const WantlistView: React.FC<WantlistViewProps> = ({ wantlist, onAdd, onUpdate, onDelete, onMoveToCollection }) => {
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [isAddingNewItem, setIsAddingNewItem] = useState(false);

    const handleSaveItem = (updatedItem: WantlistItem) => {
        onUpdate(updatedItem);
        setEditingItemId(null);
    };
    
    const handleAddWantlistItem = async (item: Omit<WantlistItem, 'id' | 'created_at'>) => {
        await onAdd(item);
        setIsAddingNewItem(false); // Hide form after adding
    };

    return (
        <div className="max-w-4xl mx-auto">
            <div className="mb-6 flex justify-between items-center">
                <h1 className="text-3xl font-bold text-zinc-800">My Wantlist</h1>
                {!isAddingNewItem && (
                     <button
                        onClick={() => setIsAddingNewItem(true)}
                        className="flex items-center justify-center gap-2 bg-zinc-900 text-white font-bold py-2 px-3 rounded-lg hover:bg-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900 text-sm"
                    >
                        <PlusIcon className="h-5 w-5" />
                        <span>Add Item</span>
                    </button>
                )}
            </div>

            {isAddingNewItem && (
                <AddWantlistItemForm onAdd={handleAddWantlistItem} onCancel={() => setIsAddingNewItem(false)} />
            )}

            <div className="space-y-4">
                {wantlist.length === 0 && !isAddingNewItem ? (
                     <div className="text-center py-10 px-4 bg-white rounded-lg border border-dashed border-zinc-300">
                        <p className="text-zinc-600">Your wantlist is empty.</p>
                        <p className="text-sm text-zinc-500 mt-1">Click the button above to add an album you're looking for!</p>
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
        </div>
    );
};

export default WantlistView;