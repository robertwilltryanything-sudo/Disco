import React, { useState, useEffect, useCallback } from 'react';
import { useGoogleDrive, DriveFile } from '../hooks/useGoogleDrive';
import { XIcon } from './icons/XIcon';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { SearchIcon } from './icons/SearchIcon';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';

interface DriveImagePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (imageUrl: string) => void;
}

const DriveImagePickerModal: React.FC<DriveImagePickerModalProps> = ({ isOpen, onClose, onSelect }) => {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [folderStack, setFolderStack] = useState<{ id: string; name: string }[]>([{ id: 'root', name: 'My Drive' }]);
  
  const drive = useGoogleDrive();
  const currentFolder = folderStack[folderStack.length - 1];

  const fetchFiles = useCallback(async (folderId: string, query: string = '') => {
    setIsLoading(true);
    const results = await drive.searchDriveFiles(folderId, query);
    setFiles(results);
    setIsLoading(false);
  }, [drive]);

  useEffect(() => {
    if (isOpen && drive.isSignedIn) {
      fetchFiles(currentFolder.id, searchQuery);
    }
  }, [isOpen, drive.isSignedIn, currentFolder.id, searchQuery, fetchFiles]);

  const handleFolderClick = (id: string, name: string) => {
    setFolderStack([...folderStack, { id, name }]);
    setSearchQuery('');
  };

  const handleBackClick = () => {
    if (folderStack.length > 1) {
      setFolderStack(folderStack.slice(0, -1));
      setSearchQuery('');
    }
  };

  const handleFileClick = (file: DriveFile) => {
    if (file.mimeType === 'application/vnd.google-apps.folder') {
      handleFolderClick(file.id, file.name);
    } else {
      // Direct high-quality thumbnail link that usually works with auth headers handled by Drive
      // Or we construct a webContentLink/download link. 
      // For simplicity in a browser app without a proxy, thumbnailLink is most reliable for preview.
      // But we want the full version if possible:
      const fullImageUrl = `https://lh3.googleusercontent.com/u/0/d/${file.id}`;
      onSelect(fullImageUrl);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl border border-zinc-200 w-full max-w-2xl flex flex-col max-h-[85vh] shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-zinc-900 text-white rounded-lg">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19 13H5v-2h14v2z"/></svg>
             </div>
             <div>
                <h2 className="text-lg font-black text-zinc-900 uppercase tracking-tight">Drive Image Picker</h2>
                <div className="flex items-center gap-1 text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-0.5">
                   {folderStack.map((f, i) => (
                      <React.Fragment key={f.id}>
                        <span>{f.name}</span>
                        {i < folderStack.length - 1 && <span>/</span>}
                      </React.Fragment>
                   ))}
                </div>
             </div>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-900 transition-colors">
            <XIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 border-b border-zinc-100 flex gap-2">
            {folderStack.length > 1 && (
                <button 
                    onClick={handleBackClick}
                    className="p-2 bg-zinc-100 text-zinc-600 rounded-lg hover:bg-zinc-200 transition-colors"
                >
                    <ArrowLeftIcon className="w-5 h-5" />
                </button>
            )}
            <div className="relative flex-grow">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input 
                    type="text" 
                    placeholder="Search your Drive..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900"
                />
            </div>
        </div>

        <div className="flex-grow overflow-y-auto p-4">
          {isLoading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-3 text-zinc-400">
              <SpinnerIcon className="w-8 h-8 animate-spin" />
              <p className="text-sm font-medium uppercase tracking-widest">Searching Drive...</p>
            </div>
          ) : files.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {files.map(file => (
                <button
                  key={file.id}
                  onClick={() => handleFileClick(file)}
                  className="group flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-zinc-50 border border-transparent hover:border-zinc-200 transition-all text-center"
                >
                  <div className="relative w-full aspect-square bg-zinc-100 rounded-lg overflow-hidden flex items-center justify-center">
                    {file.mimeType === 'application/vnd.google-apps.folder' ? (
                       <svg className="w-12 h-12 text-zinc-300 group-hover:text-zinc-400 transition-colors" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
                       </svg>
                    ) : file.thumbnailLink ? (
                      <img src={file.thumbnailLink.replace('s220', 's400')} alt={file.name} className="w-full h-full object-cover" />
                    ) : (
                       <img src={file.iconLink} alt="file type" className="w-8 h-8 opacity-40" />
                    )}
                  </div>
                  <span className="text-[11px] font-bold text-zinc-700 line-clamp-2 leading-tight uppercase tracking-tight">
                    {file.name}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-zinc-400">
              <p className="font-bold uppercase tracking-widest">No images found here</p>
              <p className="text-xs mt-1 italic">Try another folder or check your Drive</p>
            </div>
          )}
        </div>
        
        <div className="p-4 bg-zinc-50 border-t border-zinc-200 text-center">
             <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Select an image to use as cover art</p>
        </div>
      </div>
    </div>
  );
};

export default DriveImagePickerModal;