import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { SyncStatus, SyncProvider, SyncMode, CollectionMode } from '../types';
import { MenuIcon } from './icons/MenuIcon';
import StatusIndicator from './StatusIndicator';
import { UploadIcon } from './icons/UploadIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { SettingsIcon } from './icons/SettingsIcon';
import { LogoutIcon } from './icons/LogoutIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import { PlusIcon } from './icons/PlusIcon';
import { CompactDiscIcon } from './icons/CompactDiscIcon';
import { VinylIcon } from './icons/VinylIcon';

interface HeaderProps {
    onAddClick: () => void;
    collectionCount: number;
    onImport: () => void;
    onExport: () => void;
    onOpenSyncSettings: () => void;
    syncStatus: SyncStatus;
    syncError: string | null;
    syncProvider: SyncProvider;
    syncMode: SyncMode;
    onManualSync: () => void;
    onSignOut: () => void;
    isOnWantlistPage?: boolean;
    collectionMode: CollectionMode;
    onToggleMode: () => void;
    lastSyncTime?: string | null;
}

const NavItem: React.FC<{ to: string; children: React.ReactNode }> = ({ to, children }) => (
  <li>
    <NavLink
      to={to}
      className={({ isActive }) =>
        `text-base font-medium pb-1 border-b-2 uppercase tracking-wide ${
          isActive ? 'text-zinc-900 border-zinc-900' : 'text-zinc-600 border-transparent'
        }`
      }
    >
      {children}
    </NavLink>
  </li>
);

const Header: React.FC<HeaderProps> = ({ 
    onAddClick, collectionCount, onImport, onExport, onOpenSyncSettings,
    syncStatus, syncError, syncProvider, syncMode, onManualSync, onSignOut,
    isOnWantlistPage, collectionMode, onToggleMode, lastSyncTime
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setIsMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogoClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    navigate('/');
  };
  
  const handleSignOutClick = () => {
    onSignOut();
    setIsMenuOpen(false);
  };

  return (
    <header className="p-4 md:p-6 bg-white sticky top-0 z-20 border-b border-zinc-200">
      <div className="container mx-auto flex items-center">
        <div className="flex-1 flex items-center">
          <a href="/" onClick={handleLogoClick} className="text-2xl font-black text-zinc-900 uppercase tracking-wider" style={{ fontFamily: "'Montserrat', sans-serif" }}>disco</a>
          <div className="flex items-center ml-4">
              <span className="text-xs font-semibold text-zinc-500 bg-zinc-200 py-0.5 px-2 rounded-full mr-2">{collectionCount}</span>
              <button onClick={onToggleMode} className="p-1 rounded-full text-zinc-600" title={`Switch to ${collectionMode === 'cd' ? 'Vinyl' : 'CD'} mode`}>
                {collectionMode === 'cd' ? <CompactDiscIcon className="w-6 h-6" /> : <VinylIcon className="w-6 h-6" />}
              </button>
          </div>
        </div>
        
        <nav className="hidden md:flex flex-shrink-0">
            <ul className="flex items-center gap-6">
                <NavItem to="/stats">Stats</NavItem>
                <NavItem to="/artists">Artists</NavItem>
                <NavItem to="/wantlist">Wantlist</NavItem>
                <li>
                    <button onClick={onAddClick} className="flex items-center justify-center gap-2 bg-zinc-900 text-white font-bold text-sm py-2 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900">
                        <PlusIcon className="h-5 w-5" />
                        <span>{isOnWantlistPage ? 'Add to Wantlist' : `Add ${collectionMode.toUpperCase()}`}</span>
                    </button>
                </li>
            </ul>
        </nav>

        <div className="flex-1 flex justify-end">
          <div className="flex items-center gap-2">
            {syncProvider !== 'none' && (
              <StatusIndicator 
                status={syncStatus} 
                error={syncError} 
                syncProvider={syncProvider}
                syncMode={syncMode}
                onManualSync={onManualSync}
                lastSyncTime={lastSyncTime}
              />
            )}
            
            <div ref={menuRef} className="relative group">
                <button onClick={() => setIsMenuOpen(prev => !prev)} className="p-2 rounded-full text-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-800" aria-haspopup="true" aria-expanded={isMenuOpen} aria-label="Open menu">
                    <MenuIcon className="h-6 w-6" />
                </button>
                {isMenuOpen && (
                <div className="absolute top-full right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-zinc-200 p-2 z-30 divide-y divide-zinc-200" role="menu">
                    {syncProvider === 'google_drive' && (
                         <div className="p-2">
                            <button onClick={handleSignOutClick} className="w-full flex items-center gap-3 p-2 rounded-md text-zinc-700 focus:outline-none focus:bg-red-50">
                                <LogoutIcon className="w-5 h-5" />
                                <span className="font-medium">Sign Out from Drive</span>
                            </button>
                        </div>
                    )}
                    <div className="p-2">
                        <h3 className="text-sm font-bold text-zinc-800 px-2 mb-2">Tools</h3>
                        <NavLink to="/duplicates" onClick={() => setIsMenuOpen(false)} className={({ isActive }) => `w-full flex items-center gap-3 p-2 rounded-md ${isActive ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-700'} focus:outline-none focus:bg-zinc-100`}>
                            <SparklesIcon className="w-5 h-5" />
                            <span className="font-medium">Find Duplicates</span>
                        </NavLink>
                    </div>
                    <div className="p-2">
                        <h3 className="text-sm font-bold text-zinc-800 px-2 mb-2">Sync & Backup</h3>
                         <div className="space-y-2">
                            <button onClick={onOpenSyncSettings} className="w-full flex items-center gap-3 p-2 rounded-md text-zinc-700 focus:outline-none focus:bg-zinc-100">
                                <SettingsIcon className="w-5 h-5" />
                                <span className="font-medium">Sync & Backup Settings...</span>
                            </button>
                        </div>
                    </div>
                    <div className="p-2">
                        <h3 className="text-sm font-bold text-zinc-800 px-2 mb-2">Manual Backup</h3>
                         <div className="space-y-2">
                            <button onClick={onImport} className="w-full flex items-center gap-3 p-2 rounded-md text-zinc-700 focus:outline-none focus:bg-zinc-100">
                                <UploadIcon className="w-5 h-5" />
                                <span className="font-medium">Import Collection...</span>
                            </button>
                             <button onClick={onExport} className="w-full flex items-center gap-3 p-2 rounded-md text-zinc-700 focus:outline-none focus:bg-zinc-100">
                                <DownloadIcon className="w-5 h-5" />
                                <span className="font-medium">Export Collection</span>
                            </button>
                        </div>
                    </div>
                </div>
                )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default React.memo(Header);