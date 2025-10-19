


import React, { useState, useEffect, useCallback } from 'react';
import { CD } from '../types';
import { PlusIcon } from './icons/PlusIcon';
import AlbumScanner from './AlbumScanner';
import { getAlbumInfo } from '../gemini';
import { findCoverArt } from '../wikipedia';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { CameraIcon } from './icons/CameraIcon';
import { MusicNoteIcon } from './icons/MusicNoteIcon';
import { LinkIcon } from './icons/LinkIcon';
import { GlobeIcon } from './icons/GlobeIcon';
import CoverArtSelectorModal from './CoverArtSelectorModal';
import { TrashIcon } from './icons/TrashIcon';
import { XIcon } from './icons/XIcon';
import { capitalizeWords } from '../utils';

interface AddCDFormProps {
  onSave: (cd: Omit<CD, 'id'> & { id?: string }) => Promise<void>;
  cdToEdit: CD | null;
  onCancel: () => void;
  prefillData: { artist?: string, title?: string } | null;
}

const AddCDForm: React.FC<AddCDFormProps> = ({ onSave, cdToEdit, onCancel, prefillData }) => {
  const [artist, setArtist] = useState('');
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('');
  const [year, setYear] = useState<number | ''>('');
  const [version, setVersion] = useState('');
  const [recordLabel, setRecordLabel] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [currentTag, setCurrentTag] = useState('');
  const [coverArtUrl, setCoverArtUrl] = useState<string | undefined>('');
  const [manualUrl, setManualUrl] = useState('');
  const [notes, setNotes] = useState('');
  
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [coverArtOptions, setCoverArtOptions] = useState<string[]>([]);
  const [isSubmittingWithArtSelection, setIsSubmittingWithArtSelection] = useState(false);

  const resetForm = useCallback(() => {
    setArtist('');
    setTitle('');
    setGenre('');
    setYear('');
    setVersion('');
    setRecordLabel('');
    setTags([]);
    setCurrentTag('');
    setCoverArtUrl(undefined);
    setManualUrl('');
    setNotes('');
    setFormError(null);
  }, []);
  
  useEffect(() => {
    if (cdToEdit) {
      setArtist(cdToEdit.artist);
      setTitle(cdToEdit.title);
      setGenre(cdToEdit.genre || '');
      setYear(cdToEdit.year || '');
      setVersion(cdToEdit.version || '');
      setRecordLabel(cdToEdit.recordLabel || '');
      setTags(cdToEdit.tags || []);
      setCoverArtUrl(cdToEdit.coverArtUrl);
      setNotes(cdToEdit.notes || '');
    } else {
      resetForm();
      if (prefillData) {
        setArtist(prefillData.artist || '');
        setTitle(prefillData.title || '');
      }
    }
  }, [cdToEdit, prefillData, resetForm]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!artist || !title) {
        setFormError("Artist and Title are required.");
        return;
    }

    setIsProcessing(true);
    setFormError(null);

    try {
        const cdData: Omit<CD, 'id'> & { id?: string } = {
            id: cdToEdit?.id, artist, title, genre,
            year: year ? Number(year) : undefined,
            version, recordLabel, tags, coverArtUrl, notes,
            created_at: cdToEdit?.created_at,
        };

        // If it's a new CD without cover art, try to find it.
        if (!cdData.coverArtUrl && !cdToEdit) {
            setProcessingStatus('Searching for cover art...');
            const imageUrls = await findCoverArt(artist, title);

            if (imageUrls && imageUrls.length > 0) {
                if (imageUrls.length === 1) {
                    cdData.coverArtUrl = imageUrls[0];
                    setProcessingStatus('Saving CD...');
                    await onSave(cdData);
                } else {
                    setCoverArtOptions(imageUrls);
                    setIsSubmittingWithArtSelection(true);
                    setIsSelectorOpen(true);
                    // The processing state is held until art is selected.
                    return; 
                }
            } else {
                setProcessingStatus('Saving CD...');
                await onSave(cdData); // No art found, save without it.
            }
        } else {
            // Art exists or we're editing, just save.
            setProcessingStatus(cdToEdit ? 'Saving changes...' : 'Saving CD...');
            await onSave(cdData);
        }
    } catch (error) {
        console.error("Error during save process:", error);
        setFormError("An error occurred while saving. Please try again.");
        setIsProcessing(false); // Reset on error so user can try again
    }
  }, [artist, title, genre, year, version, coverArtUrl, notes, cdToEdit, onSave, recordLabel, tags]);
  
  const handlePopulateFromData = (data: Partial<Omit<CD, 'id'>> | null) => {
      if (data) {
        setArtist(data.artist || '');
        setTitle(data.title || '');
        setGenre(data.genre || '');
        setYear(data.year || '');
        setVersion(data.version || '');
        setRecordLabel(data.recordLabel || '');
        setTags(data.tags || []);
        setCoverArtUrl(data.coverArtUrl);
      } else {
        setFormError("Could not extract album information.");
      }
  };

  const handleScan = useCallback(async (imageBase64: string) => {
      setIsScannerOpen(false);
      setIsProcessing(true);
      setProcessingStatus('Analyzing album cover...');
      setFormError(null);
      try {
          const albumInfo = await getAlbumInfo(imageBase64);
          handlePopulateFromData(albumInfo);
      } catch (error) {
          console.error("Error getting album info:", error);
          setFormError("An error occurred while scanning the album cover.");
      } finally {
          setIsProcessing(false);
      }
  }, []);

  const handleSetArtFromUrl = useCallback(() => {
    if (manualUrl.trim()) {
      const url = manualUrl.trim();
      // A basic check for http/https and common image extensions, allowing for query params
      if (url.startsWith('http') && /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(url)) {
        setCoverArtUrl(url);
        setFormError(null);
      } else {
        setFormError("Please enter a valid, direct image URL (e.g., ending in .jpg, .png).");
      }
    }
  }, [manualUrl]);

  const handleFindArt = useCallback(async () => {
    if (!artist || !title) {
      setFormError("Please enter an Artist and Title before searching for art.");
      return;
    }
    setIsProcessing(true);
    setProcessingStatus('Searching for cover art...');
    setFormError(null);
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
        setFormError("Could not find cover art online.");
      }
    } catch (error) {
      console.error("Error finding art online:", error);
      setFormError("An error occurred while searching for cover art.");
    } finally {
      setIsProcessing(false);
    }
  }, [artist, title]);

  const handleSelectCoverArt = useCallback(async (url: string) => {
    setCoverArtUrl(url);
    setIsSelectorOpen(false);
    setCoverArtOptions([]);
    
    if (isSubmittingWithArtSelection) {
      try {
        setProcessingStatus('Saving CD...');
        await onSave({
          id: cdToEdit?.id, artist, title, genre,
          year: year ? Number(year) : undefined, version, recordLabel, tags,
          coverArtUrl: url, notes,
          created_at: cdToEdit?.created_at,
        });
      } catch (error) {
        console.error("Error saving after art selection:", error);
        setFormError("An error occurred while saving. Please try again.");
        setIsProcessing(false);
      } finally {
        setIsSubmittingWithArtSelection(false);
      }
    }
  }, [isSubmittingWithArtSelection, onSave, cdToEdit, artist, title, genre, year, version, notes, recordLabel, tags]);

  const handleCloseSelector = useCallback(async () => {
    setIsSelectorOpen(false);
    setCoverArtOptions([]);

    if (isSubmittingWithArtSelection) {
      // User canceled selection during submit, so save without art.
      try {
          setProcessingStatus('Saving CD...');
          await onSave({
            id: cdToEdit?.id, artist, title, genre,
            year: year ? Number(year) : undefined, version, recordLabel, tags,
            coverArtUrl: undefined, notes,
            created_at: cdToEdit?.created_at,
          });
      } catch (error) {
        console.error("Error saving after closing art selector:", error);
        setFormError("An error occurred while saving. Please try again.");
        setIsProcessing(false);
      } finally {
        setIsSubmittingWithArtSelection(false);
      }
    } else {
      setIsProcessing(false);
    }
  }, [isSubmittingWithArtSelection, onSave, cdToEdit, artist, title, genre, year, version, notes, recordLabel, tags]);
  
  const handleRemoveArt = () => {
    setCoverArtUrl(undefined);
  };

  const handleAddTag = useCallback(() => {
    const newTag = currentTag.trim();
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

  return (
    <>
      <form onSubmit={handleSubmit} className="p-4 bg-zinc-50 rounded-lg space-y-4">
        <h2 className="text-xl font-bold text-zinc-900">{cdToEdit ? 'Edit CD' : 'Add New CD'}</h2>
        
        {isProcessing && !isSelectorOpen && (
            <div className="flex items-center justify-center p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <SpinnerIcon className="h-6 w-6 mr-3 text-blue-600" />
                <p className="text-blue-700">{processingStatus}</p>
            </div>
        )}
        {formError && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
                {formError}
            </div>
        )}
        
        <div className="flex flex-col md:flex-row gap-4 items-start">
            <div className="md:w-1/3 w-1/2 mx-auto md:mx-0 flex flex-col items-center">
                <div className="relative w-full group">
                  {coverArtUrl ? (
                      <>
                        <img src={coverArtUrl} alt="Album cover preview" className="w-full h-auto aspect-square object-cover rounded-lg" />
                        <button
                            type="button"
                            onClick={handleRemoveArt}
                            className="absolute top-2 right-2 p-2 rounded-full bg-black bg-opacity-40 text-white opacity-0 group-hover:opacity-100 hover:bg-opacity-60 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-red-500"
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
                            className="flex-shrink-0 bg-white border border-zinc-300 text-zinc-700 font-semibold py-2 px-3 rounded-lg hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-800 text-sm"
                        >
                            Set
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={handleFindArt}
                        className="w-full flex items-center justify-center gap-2 bg-white border border-zinc-300 text-zinc-700 font-semibold py-2 px-3 rounded-lg hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-800 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!artist || !title}
                    >
                        <GlobeIcon className="h-4 w-4" />
                        Find Art
                    </button>
                </div>
            </div>
            <div className="flex-1 w-full space-y-3">
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
              <input
                type="text"
                placeholder="Version (e.g., Remaster, Deluxe Edition)"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                className="w-full bg-white border border-zinc-300 rounded-lg py-2 px-3 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-800 focus:border-zinc-800"
              />
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
              <input
                type="text"
                placeholder="Record Label"
                value={recordLabel}
                onChange={(e) => setRecordLabel(e.target.value)}
                className="w-full bg-white border border-zinc-300 rounded-lg py-2 px-3 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-800 focus:border-zinc-800"
              />
              <div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add a tag..."
                    value={currentTag}
                    onChange={(e) => setCurrentTag(e.target.value)}
                    onKeyDown={handleTagInputKeyDown}
                    className="flex-grow w-full bg-white border border-zinc-300 rounded-lg py-2 px-3 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-800 focus:border-zinc-800"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="flex-shrink-0 bg-white border border-zinc-300 text-zinc-700 font-semibold py-2 px-3 rounded-lg hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-800"
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
                          className="ml-2 rounded-full hover:bg-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-500"
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
                placeholder="Personal notes (e.g., 'Signed copy', 'Gift from...')"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full bg-white border border-zinc-300 rounded-lg py-2 px-3 text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-800 focus:border-zinc-800"
              />
            </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="submit"
              disabled={isProcessing}
              className="flex-1 flex items-center justify-center gap-2 bg-zinc-900 text-white font-bold py-2 px-4 rounded-lg hover:bg-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900 disabled:bg-zinc-500 disabled:cursor-wait"
            >
              {isProcessing ? (
                <>
                  <SpinnerIcon className="h-5 w-5" />
                  <span>{processingStatus}</span>
                </>
              ) : (
                <>
                  <PlusIcon className="h-5 w-5" />
                  <span>{cdToEdit ? 'Save Changes' : 'Add CD'}</span>
                </>
              )}
            </button>
            {cdToEdit ? (
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 bg-white text-zinc-700 font-medium py-2 px-4 rounded-lg border border-zinc-300 hover:bg-zinc-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-800"
              >
                Cancel
              </button>
            ) : (
              <button
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  disabled={isProcessing}
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                  <CameraIcon className="h-5 w-5" />
                  Scan Album
              </button>
            )}
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

export default React.memo(AddCDForm);