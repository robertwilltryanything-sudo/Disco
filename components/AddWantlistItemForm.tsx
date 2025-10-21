import React, { useState } from 'react';
import { WantlistItem } from '../types';
import { capitalizeWords } from '../utils';
import { findCoverArt } from '../wikipedia';
import { PlusIcon } from './icons/PlusIcon';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { LinkIcon } from './icons/LinkIcon';

interface AddWantlistItemFormProps {
    onAdd: (item: Omit<WantlistItem, 'id' | 'created_at'>) => Promise<void>;
    onCancel: () => void;
}

const AddWantlistItemForm: React.FC<AddWantlistItemFormProps> = ({ onAdd, onCancel }) => {
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
            title: title.trim(),
            notes: notes.trim(),
            coverArtUrl: finalCoverArtUrl,
        });
    };

    return (
        <div className="p-4 bg-zinc-50 rounded-lg border border-zinc-200">
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
                <div className="flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
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
    );
};

export default AddWantlistItemForm;
