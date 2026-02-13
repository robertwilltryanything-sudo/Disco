import React, { useState, useEffect, useCallback } from 'react';
import { WantlistItem } from '../types';
import { PlusIcon } from './icons/PlusIcon';
import AlbumScanner from './AlbumScanner';
import { getAlbumInfo } from '../gemini';
import { findCoverArt } from '../wikipedia';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { CameraIcon } from './icons/CameraIcon';
import { MusicNoteIcon } from './icons/MusicNoteIcon';
import { LinkIcon } from './icons/LinkIcon';
import { GlobeIcon } from './icons/GlobeIcon';
import { GoogleDriveIcon } from './icons/GoogleDriveIcon';
import CoverArtSelectorModal from './CoverArtSelectorModal';
import { TrashIcon } from './icons/TrashIcon';
import { XIcon } from './icons/XIcon';
import { XCircleIcon } from './icons/XCircleIcon';
import { capitalizeWords } from '../utils';

interface AddWantlistItemFormProps {
  onSave: (item: Omit<WantlistItem, 'id'> & { id?: string }) => Promise<void>;
  itemToEdit: WantlistItem | null;
  onCancel: () => void;
  isVinyl?: boolean;
  driveSignedIn?: boolean;
  onPickFromDrive?: () => Promise<string | null>;
}

const VINYL_MEDIA_CONDITION = ["Hairlines", "Scratched", "Warped"];
const VINYL_COVER_CONDITION = ["Ringwear", "Seemsplit", "Price Sticker", "Water Damage", "Tear Front"];
const VINYL_ATTRIBUTES = ["Gatefold", "180g", "Coloured Vinyl", "Hype Sticker", "Obi Strip", "Insert"];

const CD_MEDIA_CONDITION = ["Scratched", "Hairlines", "Sticky"];
const CD_COVER_CONDITION = ["Cracked Case", "Price Sticker", "Tear Front"];
const CD_ATTRIBUTES = ["Digipak", "Slipcase", "Obi Strip", "Promo"];

const AddWantlistItemForm: React.FC<AddWantlistItemFormProps> = ({ onSave, itemToEdit, onCancel, isVinyl, driveSignedIn, onPickFromDrive }) => {
  const [artist, setArtist] = useState('');
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('');
  const [year, setYear] = useState<number | ''>('');
  const [version, setVersion] = useState('');
  const [record_label, setRecordLabel] = useState('');
  const [attributes, setAttributes] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [currentTag, setCurrentTag] = useState('');
  const [cover_art_url, setCoverArtUrl] = useState<string | undefined>('');
  const [manualUrl, setManualUrl] = useState('');
  const [notes, setNotes] = useState('');
  
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formErrorTitle, setFormErrorTitle] = useState('Error Saving to Wantlist');
  
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [coverArtOptions, setCoverArtOptions] = useState<string[]>([]);
  const [isSubmittingWithArtSelection, setIsSubmittingWithArtSelection] = useState(false);

  useEffect(() => {
    if (itemToEdit) {
      setArtist(itemToEdit.artist);
      setTitle(itemToEdit.title);
      setGenre(itemToEdit.genre || '');
      setYear(itemToEdit.year || '');
      setVersion(itemToEdit.version || '');
      setRecordLabel(itemToEdit.record_label || '');
      setAttributes(itemToEdit.attributes || []);
      setTags(itemToEdit.tags || []);
      setCoverArtUrl(itemToEdit.cover_art_url);
      setNotes(itemToEdit.notes || '');
    }
  }, [itemToEdit]);

  const toggleAttribute = (attr: string) => {
    setAttributes(prev => 
      prev.includes(attr) ? prev.filter(a => a !== attr) : [...prev, attr]
    );
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!artist || !title) {
        setFormErrorTitle("Form Error");
        setFormError("Artist and Title are required.");
        return;
    }

    setIsProcessing(true);
    setFormError(null);

    try {
        const itemData: Omit<WantlistItem, 'id'> & { id?: string } = {
            id: itemToEdit?.id, artist, title, genre,
            year: year ? Number(year) : undefined,
            version, record_label, tags, cover_art_url, notes,
            attributes,
            created_at: itemToEdit?.created_at,
        };

        if (!itemData.cover_art_url && !itemToEdit) {
            setFormErrorTitle("Search Error");
            setProcessingStatus('Searching for cover art...');
            const imageUrls = await findCoverArt(artist, title);

            if (imageUrls && imageUrls.length > 0) {
                if (imageUrls.length === 1) {
                    itemData.cover_art_url = imageUrls[0];
                    setFormErrorTitle("Error Saving to Wantlist");
                    setProcessingStatus('Saving item...');
                    await onSave(itemData);
                } else {
                    setCoverArtOptions(imageUrls);
                    setIsSubmittingWithArtSelection(true);
                    setIsSelectorOpen(true);
                    return; 
                }
            } else {
                setFormErrorTitle("Error Saving to Wantlist");
                setProcessingStatus('Saving item...');
                await onSave(itemData);
            }
        } else {
            setFormErrorTitle("Error Saving to Wantlist");
            setProcessingStatus(itemToEdit ? 'Saving changes...' : 'Saving item...');
            await onSave(itemData);
        }
    } catch (error: any) {
        console.error("Error during save process:", error);
        const errorMsg = error.details || error.message || "An unexpected error occurred.";
        setFormError(errorMsg);
    } finally {
        setIsProcessing(false);
    }
  }, [artist, title, genre, year, version, cover_art_url, notes, itemToEdit, onSave, record_label, tags, attributes]);
  
  const handleScan = useCallback(async (imageBase64: string) => {
      setIsScannerOpen(false);
      setIsProcessing(true);
      setProcessingStatus('Analyzing album cover...');
      setFormError(null);
      setFormErrorTitle("Scan Error");
      try {
          const albumInfo = await getAlbumInfo(imageBase64);
          if (albumInfo) {
            setArtist(albumInfo.artist || '');
            setTitle(albumInfo.title || '');
            setGenre(albumInfo.genre || '');
            setYear(albumInfo.year || '');
            setVersion(albumInfo.version || '');
            setRecordLabel(albumInfo.record_label || '');
            setTags(albumInfo.tags || []);
            setCoverArtUrl(albumInfo.cover_art_url);
          }
      } catch (error: any) {
          console.error("Error getting album info:", error);
          setFormError(error.message || "An error occurred.");
      } finally {
          setIsProcessing(false);
      }
  }, []);

  const handleSetArtFromUrl = useCallback(() => {
    if (manualUrl.trim()) {
      const url = manualUrl.trim();
      if (url.startsWith('http') && /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(url)) {
        setCoverArtUrl(url);
        setFormError(null);
      } else {
        setFormErrorTitle("Invalid URL");
        setFormError("Please enter a valid image URL.");
      }
    }
  }, [manualUrl]);

  const handleFindArt = useCallback(async () => {
    if (!artist || !title) {
      setFormErrorTitle("Search Error");
      setFormError("Please enter Artist and Title.");
      return;
    }
    setIsProcessing(true);
    setProcessingStatus('Searching for cover art...');
    setFormError(null);
    setFormErrorTitle("Search Error");
    try {
      const imageUrls = await findCoverArt(artist, title);
      if (imageUrls && imageUrls.length > 0) {
        if (imageUrls.length === 1) setCoverArtUrl(imageUrls[0]);
        else {
          setCoverArtOptions(imageUrls);
          setIsSelectorOpen(true);
        }
      } else {
        setFormErrorTitle("Not Found");
        setFormError("No cover art found online.");
      }
    } catch (error: any) {
      setFormError(error.message || "An error occurred.");
    } finally {
      setIsProcessing(false);
    }
  }, [artist, title]);

  const handlePickFromDrive = useCallback(async () => {
    if (!driveSignedIn || !onPickFromDrive) {
        setFormErrorTitle("Drive Connection Required");
        setFormError("Please sign in to Google Drive from the main menu (Top Right) to browse your files.");
        return;
    }
    const url = await onPickFromDrive();
    if (url) setCoverArtUrl(url);
  }, [onPickFromDrive, driveSignedIn]);

  const handleSelectCoverArt = useCallback(async (url: string) => {
    setCoverArtUrl(url);
    setIsSelectorOpen(false);
    setCoverArtOptions([]);
    
    if (isSubmittingWithArtSelection) {
      try {
        setFormErrorTitle("Error Saving to Wantlist");
        setProcessingStatus('Saving item...');
        await onSave({
          id: itemToEdit?.id, artist, title, genre,
          year: year ? Number(year) : undefined, version, record_label, tags,
          attributes,
          cover_art_url: url, notes,
          created_at: itemToEdit?.created_at,
        });
      } catch (error: any) {
        setFormError(error.message || "An error occurred.");
      } finally {
        setIsProcessing(false);
        setIsSubmittingWithArtSelection(false);
      }
    }
  }, [isSubmittingWithArtSelection, onSave, itemToEdit, artist, title, genre, year, version, notes, record_label, tags, attributes]);

  const handleCloseSelector = useCallback(async () => {
    setIsSelectorOpen(false);
    setCoverArtOptions([]);
    if (isSubmittingWithArtSelection) {
      try {
          setFormErrorTitle("Error Saving to Wantlist");
          setProcessingStatus('Saving item...');
          await onSave({
            id: itemToEdit?.id, artist, title, genre,
            year: year ? Number(year) : undefined, version, record_label, tags,
            attributes,
            cover_art_url: undefined, notes,
            created_at: itemToEdit?.created_at,
          });
      } catch (error: any) {
        setFormError(error.message || "An error occurred.");
      } finally {
        setIsProcessing(false);
        setIsSubmittingWithArtSelection(false);
      }
    } else {
      setIsProcessing(false);
    }
  }, [isSubmittingWithArtSelection, onSave, itemToEdit, artist, title, genre, year, version, notes, record_label, tags, attributes]);
  
  const handleRemoveArt = () => {
    setCoverArtUrl(undefined);
  };

  const handleAddTag = useCallback(() => {
    const newTag = currentTag.trim().toLowerCase();
    if (newTag && !tags.includes(newTag)) {
      setTags([...tags, newTag]);
    }
    setCurrentTag('');
  }, [currentTag, tags]);

  const handleRemoveTag = useCallback((tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  }, [tags]);

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const albumType = isVinyl ? 'Vinyl' : 'CD';
  const mediaCondList = isVinyl ? VINYL_MEDIA_CONDITION : CD_MEDIA_CONDITION;
  const coverCondList = isVinyl ? VINYL_COVER_CONDITION : CD_COVER_CONDITION;
  const attrList = isVinyl ? VINYL_ATTRIBUTES : CD_ATTRIBUTES;

  return (
    <>
      <form onSubmit={handleSubmit} className="relative p-4 bg-zinc-50 rounded-lg space-y-4">
        <button
            type="button"
            onClick={onCancel}
            className="absolute top-4 right-4 p-2 rounded-full text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-500 z-10"
            aria-label="Close form"
        >
            <XIcon className="h-6 w-6" />
        </button>

        <h2 className="text-xl font-bold text-zinc-900 pr-10">{itemToEdit ? `Edit ${albumType} Wantlist Item` : `Add ${albumType} to Wantlist`}</h2>
        
        {isProcessing && !isSelectorOpen && (
            <div className="flex items-center justify-center p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <SpinnerIcon className="h-6 w-6 mr-3 text-blue-600" />
                <p className="text-blue-700">{processingStatus}</p>
            </div>
        )}
        {formError && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg whitespace-pre-wrap shadow-sm">
                <p className="font-bold mb-1 flex items-center gap-2">
                    <XCircleIcon className="h-4 w-4" />
                    {formErrorTitle}
                </p>
                <p className="text-sm opacity-90">{formError}</p>
            </div>
        )}
        
        <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="md:w-1/3 w-1/2 mx-auto md:mx-0 flex flex-col items-center">
                <div className="relative w-full group">
                  {cover_art_url ? (
                      <>
                        <img 
                          src={cover_art_url} 
                          alt="Album cover preview" 
                          className="w-full h-auto aspect-square object-cover rounded-lg" 
                          referrerPolicy="no-referrer"
                        />
                        <button
                            type="button"
                            onClick={handleRemoveArt}
                            className="absolute top-2 right-2 p-2 rounded-full bg-black bg-opacity-40 text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                            aria-label="Remove cover art"
                        >
                            <TrashIcon className="w-5 h-5" />
                        </button>
                      </>
                  ) : (
                      <div className="w-full h-auto aspect-square bg-zinc-200 flex items-center justify-center rounded-lg">
                          <MusicNoteIcon className="w-16 h-16 text-zinc-400" />
                      </div>
                  )}
                </div>
                
                <div className="space-y-2 mt-3 w-full">
                    <div className="flex gap-2">
                        <div className="relative flex-grow">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <LinkIcon className="h-4 w-4 text-zinc-400" />
                            </div>
                            <input
                                type="url"
                                placeholder="Paste image URL"
                                value={manualUrl}
                                onChange={(e) => setManualUrl(e.target.value)}
                                className="w-full bg-white border border-zinc-300 rounded-lg py-2 px-3 pl-9 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-800 focus:border-zinc-800 text-sm"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={handleSetArtFromUrl}
                            className="flex-shrink-0 bg-white border border-zinc-300 text-zinc-700 font-semibold py-2 px-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-800 text-sm"
                        >
                            Set
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={handleFindArt}
                            className="w-full flex items-center justify-center gap-2 bg-white border border-zinc-300 text-zinc-700 font-semibold py-2 px-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-800 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={!artist || !title}
                        >
                            <GlobeIcon className="h-4 w-4" />
                            Find Art
                        </button>
                        <button
                            type="button"
                            onClick={handlePickFromDrive}
                            className="w-full flex items-center justify-center gap-2 bg-white border border-zinc-300 text-zinc-700 font-semibold py-2 px-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-800 text-sm"
                        >
                            <GoogleDriveIcon className="h-4 w-4" />
                            Drive
                        </button>
                    </div>
                    
                    {!itemToEdit && (
                        <button
                            type="button"
                            onClick={() => setIsScannerOpen(true)}
                            disabled={isProcessing}
                            className="w-full flex items-center justify-center gap-3 bg-blue-600 text-white font-bold py-2 px-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 text-sm"
                        >
                            <CameraIcon className="h-4 w-4" />
                            Scan Album
                        </button>
                    )}
                </div>
            </div>
            <div className="flex-1 w-full space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Artist*"
                  value={artist}
                  onChange={(e) => setArtist(e.target.value)}
                  required
                  className="w-full bg-white border border-zinc-300 rounded-lg py-2 px-3 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-800 focus:border-zinc-800"
                />
                <input
                  type="text"
                  placeholder="Title*"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full bg-white border border-zinc-300 rounded-lg py-2 px-3 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-800 focus:border-zinc-800"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder={isVinyl ? "Edition Preference (e.g. 180g)" : "Version Preference (e.g. Remaster)"}
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  className="w-full bg-white border border-zinc-300 rounded-lg py-2 px-3 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-800 focus:border-zinc-800"
                />
                <input
                  type="text"
                  placeholder="Desired Record Label"
                  value={record_label}
                  onChange={(e) => setRecordLabel(e.target.value)}
                  className="w-full bg-white border border-zinc-300 rounded-lg py-2 px-3 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-800 focus:border-zinc-800"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 bg-white border border-zinc-200 rounded-lg">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">TARGET MEDIA CONDITION</p>
                  <div className="space-y-2">
                    {mediaCondList.map(attr => (
                      <label key={attr} className="flex items-center gap-2 cursor-pointer group">
                        <input 
                          type="checkbox" 
                          checked={attributes.includes(attr)}
                          onChange={() => toggleAttribute(attr)}
                          className="w-4 h-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-800"
                        />
                        <span className="text-xs text-zinc-600 group-hover:text-zinc-900 transition-colors font-medium">{attr}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="p-3 bg-white border border-zinc-200 rounded-lg">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">TARGET COVER CONDITION</p>
                  <div className="space-y-2">
                    {coverCondList.map(attr => (
                      <label key={attr} className="flex items-center gap-2 cursor-pointer group">
                        <input 
                          type="checkbox" 
                          checked={attributes.includes(attr)}
                          onChange={() => toggleAttribute(attr)}
                          className="w-4 h-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-800"
                        />
                        <span className="text-xs text-zinc-600 group-hover:text-zinc-900 transition-colors font-medium">{attr}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-3 bg-white border border-zinc-200 rounded-lg">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">PHYSICAL ATTRIBUTES</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {attrList.map(attr => (
                    <label key={attr} className="flex items-center gap-2 cursor-pointer group">
                      <input 
                        type="checkbox" 
                        checked={attributes.includes(attr)}
                        onChange={() => toggleAttribute(attr)}
                        className="w-4 h-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-800"
                      />
                      <span className="text-xs text-zinc-600 group-hover:text-zinc-900 transition-colors font-medium">{attr}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Genre"
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  className="w-full bg-white border border-zinc-300 rounded-lg py-2 px-3 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-800 focus:border-zinc-800"
                />
                <input
                  type="number"
                  placeholder="Year"
                  value={year}
                  onChange={(e) => setYear(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                  className="w-full bg-white border border-zinc-300 rounded-lg py-2 px-3 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-800 focus:border-zinc-800"
                />
              </div>

              <div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add a custom tag..."
                    value={currentTag}
                    onChange={(e) => setCurrentTag(e.target.value)}
                    onKeyDown={handleTagInputKeyDown}
                    className="flex-grow w-full bg-white border border-zinc-300 rounded-lg py-2 px-3 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-800 focus:border-zinc-800"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="flex-shrink-0 bg-white border border-zinc-300 text-zinc-700 font-semibold py-2 px-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-800"
                  >
                    Add
                  </button>
                </div>
                {tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {tags.map(tag => (
                      <div key={tag} className="flex items-center bg-zinc-200 text-zinc-800 text-sm font-medium pl-3 pr-2 py-1 rounded-full">
                        <span>{capitalizeWords(tag)}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="ml-2 rounded-full focus:outline-none focus:ring-1 focus:ring-zinc-500"
                          aria-label={`Remove tag ${tag}`}
                        >
                          <XIcon className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <textarea
                placeholder="Personal notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full bg-white border border-zinc-300 rounded-lg py-2 px-3 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-800 focus:border-zinc-800"
              />
            </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-zinc-200">
            <button
              type="submit"
              disabled={isProcessing}
              className="flex-1 flex items-center justify-center gap-2 bg-zinc-900 text-white font-bold py-3 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900 disabled:bg-zinc-500 disabled:cursor-wait"
            >
              {isProcessing ? (
                <>
                  <SpinnerIcon className="h-5 w-5" />
                  <span>{processingStatus}</span>
                </>
              ) : (
                <>
                  <PlusIcon className="h-5 w-5" />
                  <span>{itemToEdit ? 'Save Changes' : `Add ${albumType} to Wantlist`}</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-white text-zinc-700 font-medium py-3 px-4 rounded-lg border border-zinc-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-500 focus:ring-zinc-800"
            >
              Cancel
            </button>
        </div>
      </form>
      <AlbumScanner 
        isOpen={isScannerOpen} 
        onClose={() => setIsScannerOpen(false)} 
        onCapture={handleScan}
      />
      <CoverArtSelectorModal
        isOpen={isSelectorOpen}
        onClose={handleCloseSelector}
        onSelect={handleSelectCoverArt}
        images={coverArtOptions}
      />
    </>
  );
};

export default React.memo(AddWantlistItemForm);