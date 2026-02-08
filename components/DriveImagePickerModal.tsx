import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { DriveFile } from '../hooks/useGoogleDrive';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { XIcon } from './icons/XIcon';
import { GoogleDriveIcon } from './icons/GoogleDriveIcon';
import { SearchIcon } from './icons/SearchIcon';

interface DriveImagePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (imageUrl: string) => void;
  fetchImages: (pageToken?: string) => Promise<{files: DriveFile[], nextPageToken?: string}>;
}

const DriveImagePickerModal: React.FC<DriveImagePickerModalProps> = ({ isOpen, onClose, onSelect, fetchImages }) => {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async (token?: string, clear = false) => {
    setIsLoading(true);
    const result = await fetchImages(token);
    if (clear) {
      setFiles(result.files);
    } else {
      setFiles(prev => [...prev, ...result.files]);
    }
    setNextPageToken(result.nextPageToken);
    setIsLoading(false);
  }, [fetchImages]);

  useEffect(() => {
    if (isOpen) {
      loadMore(undefined, true);
    } else {
      setFiles([]);
      setNextPageToken(undefined);
      setSearchQuery('');
    }
  }, [isOpen, loadMore]);

  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current || isLoading || !nextPageToken) return;
    
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    if (scrollHeight - scrollTop <= clientHeight + 100) {
      loadMore(nextPageToken);
    }
  }, [isLoading, nextPageToken, loadMore]);

  const filteredFiles = useMemo(() => {
    if (!searchQuery) return files;
    const lowerQuery = searchQuery.toLowerCase();
    return files.filter(f => f.name.toLowerCase().includes(lowerQuery));
  }, [files, searchQuery]);

  // Helper to get high-quality direct image URL from Google's thumbnail link
  const getHighResUrl = (file: DriveFile) => {
    if (file.thumbnailLink) {
        // thumbnailLink usually ends with =s220. 
        // Replacing it with =s1000 gives a high-quality direct link that bypasses cookie auth issues.
        return file.thumbnailLink.split('=')[0] + '=s1000';
    }
    return `https://drive.google.com/thumbnail?id=${file.id}&sz=w1000`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col h-[85vh] overflow-hidden border border-zinc-200">
        <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-zinc-100 rounded-lg">
              <GoogleDriveIcon className="w-6 h-6 text-zinc-600" />
            </div>
            <div>
              <h2 className="text-xl font-black text-zinc-900 uppercase tracking-tight">Drive Artwork</h2>
              <p className="text-xs text-zinc-500 font-medium">Select an image from your Google Drive</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-900 transition-colors">
            <XIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 border-b border-zinc-50 shrink-0">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input 
              type="text"
              placeholder="Search images in your Drive..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-zinc-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-zinc-900 transition-all"
            />
          </div>
        </div>

        <div 
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 bg-zinc-50/50"
        >
          {filteredFiles.length === 0 && !isLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-zinc-400 space-y-2 py-20">
              <GoogleDriveIcon className="w-12 h-12 opacity-20" />
              <p className="font-bold text-sm">No images found</p>
              <p className="text-xs">Try uploading images to your Drive first</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filteredFiles.map((file) => (
                <button
                  key={file.id}
                  onClick={() => onSelect(getHighResUrl(file))}
                  className="group relative bg-white border border-zinc-200 rounded-xl overflow-hidden hover:ring-2 hover:ring-zinc-900 transition-all text-left shadow-sm"
                >
                  <div className="aspect-square bg-zinc-100 flex items-center justify-center overflow-hidden">
                    {file.thumbnailLink ? (
                      <img 
                        src={file.thumbnailLink.replace('=s220', '=s400')} 
                        alt={file.name} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <GoogleDriveIcon className="w-8 h-8 text-zinc-200" />
                    )}
                  </div>
                  <div className="p-2 border-t border-zinc-50">
                    <p className="text-[10px] font-bold text-zinc-900 truncate" title={file.name}>
                      {file.name}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {isLoading && (
            <div className="flex items-center justify-center py-10">
              <SpinnerIcon className="w-8 h-8 text-zinc-400 animate-spin" />
            </div>
          )}
        </div>

        <div className="p-4 bg-zinc-50 border-t border-zinc-100 flex justify-between items-center shrink-0">
          <p className="text-[10px] text-zinc-400 uppercase font-black tracking-widest">
            {filteredFiles.length} images found
          </p>
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-white border border-zinc-200 text-zinc-900 font-bold text-xs rounded-lg hover:bg-zinc-100 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default DriveImagePickerModal;