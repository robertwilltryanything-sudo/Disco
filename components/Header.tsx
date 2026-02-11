import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { SyncStatus, SyncProvider, CollectionMode } from '../types';
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
import { ArrowUpCircleIcon } from './icons/ArrowUpCircleIcon';
import { ArrowDownCircleIcon } from './icons/ArrowDownCircleIcon';

interface HeaderProps {
    onAddClick: () => void;
    collectionCount: number;
    onImport: () => void;
    onExport: () => void;
    onOpenSyncSettings: () => void;
    syncStatus: SyncStatus;
    syncError: string | null;
    syncProvider: SyncProvider;
    onCloudPush: () => void;
    onCloudPull: () => void;
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
    syncStatus, syncError, syncProvider, onCloudPush, onCloudPull, onSignOut,
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

  const isSyncBusy = syncStatus === 'loading' || syncStatus === 'saving' || syncStatus === 'authenticating';

  return (
    <header className="p-4 md:p-6 bg-white sticky top-0 z-20 border-b border-zinc-200 w-full overflow-hidden">
      <div className="container mx-auto flex items-center justify-between gap-2">
        <div className="flex items-center min-w-0 flex-shrink">
          <a href="/" onClick={handleLogoClick} className="text-xl md:text-2xl font-black text-zinc-900 uppercase tracking-wider shrink-0" style={{ fontFamily: "'Montserrat', sans-serif" }}>disco</a>
          <div className="flex items-center ml-2 md:ml-4 shrink-0">
              <span className="text-[10px] md:text-xs font-semibold text-zinc-500 bg-zinc-200 py-0.5 px-2 rounded-full mr-1 md:mr-2">{collectionCount}</span>
              <button onClick={onToggleMode} className="p-1 rounded-full text-zinc-600 focus:outline-none" title={`Switch to ${collectionMode === 'cd' ? 'Vinyl' : 'CD'} mode`}>
                {collectionMode === 'cd' ? <CompactDiscIcon className="w-5 h-5 md:w-6 md:h-6" /> : <VinylIcon className="w-5 h-5 md:w-6 md:h-6" />}
              </button>
          </div>
        </div>
        
        <nav className="hidden lg:flex flex-shrink-0">
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

        <div className="flex items-center gap-1 md:gap-2 shrink-0">
            {syncProvider === 'google_drive' && (
              <div className="flex items-center bg-zinc-50 border border-zinc-100 rounded-full px-1 py-0.5 mr-0.5 md:mr-1">
                <button 
                  onClick={onCloudPush}
                  disabled={isSyncBusy}
                  className="p-1 md:p-1.5 rounded-full hover:bg-zinc-200 transition-colors text-zinc-600 disabled:opacity-30"
                  title="Save to Cloud (Push)"
                >
                  <ArrowUpCircleIcon className={`w-4 h-4 md:w-5 md:h-5 ${syncStatus === 'saving' ? 'animate-bounce text-blue-600' : ''}`} />
                </button>
                <button 
                  onClick={onCloudPull}
                  disabled={isSyncBusy}
                  className="p-1 md:p-1.5 rounded-full hover:bg-zinc-200 transition-colors text-zinc-600 disabled:opacity-30"
                  title="Load from Cloud (Pull)"
                >
                  <ArrowDownCircleIcon className={`w-4 h-4 md:w-5 md:h-5 ${syncStatus === 'loading' ? 'animate-bounce text-blue-600' : ''}`} />
                </button>
              </div>
            )}

            {syncProvider !== 'none' && (
              <StatusIndicator 
                status={syncStatus} 
                error={syncError} 
                syncProvider={syncProvider}
                onManualSync={() => {}}
                lastSyncTime={lastSyncTime}
              />
            )}
            
            <div ref={menuRef} className="relative">
                <button onClick={() => setIsMenuOpen(prev => !prev)} className="p-1.5 md:p-2 rounded-full text-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-800" aria-haspopup="true" aria-expanded={isMenuOpen} aria-label="Open menu">
                    <MenuIcon className="h-6 w-6" />
                </button>
                {isMenuOpen && (
                <div className="absolute top-full right-0 mt-2 w-64 md:w-72 bg-white rounded-lg shadow-lg border border-zinc-200 p-2 z-30 divide-y divide-zinc-200" role="menu">
                    {syncProvider === 'google_drive' && (
                         <div className="p-2">
                            <button onClick={handleSignOutClick} className="w-full flex items-center gap-3 p-2 rounded-md text-zinc-700 focus:outline-none hover:bg-red-50 transition-colors">
                                <LogoutIcon className="w-5 h-5" />
                                <span className="font-medium text-sm">Sign Out from Drive</span>
                            </button>
                        </div>
                    )}
                    <div className="p-2">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-2 mb-2">Tools</h3>
                        <NavLink to="/duplicates" onClick={() => setIsMenuOpen(false)} className={({ isActive }) => `w-full flex items-center gap-3 p-2 rounded-md text-sm ${isActive ? 'bg-zinc-100 text-zinc-900 font-bold' : 'text-zinc-700'} focus:outline-none hover:bg-zinc-100 transition-colors`}>
                            <SparklesIcon className="w-5 h-5" />
                            <span className="font-medium">Find Duplicates</span>
                        </NavLink>
                    </div>
                    <div className="p-2">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-2 mb-2">Sync & Backup</h3>
                         <div className="space-y-1">
                            <button onClick={() => { onOpenSyncSettings(); setIsMenuOpen(false); }} className="w-full flex items-center gap-3 p-2 rounded-md text-sm text-zinc-700 focus:outline-none hover:bg-zinc-100 transition-colors text-left">
                                <SettingsIcon className="w-5 h-5" />
                                <span className="font-medium">Sync Settings</span>
                            </button>
                        </div>
                    </div>
                    <div className="p-2">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-2 mb-2">Local Actions</h3>
                         <div className="space-y-1">
                            <button onClick={() => { onImport(); setIsMenuOpen(false); }} className="w-full flex items-center gap-3 p-2 rounded-md text-sm text-zinc-700 focus:outline-none hover:bg-zinc-100 transition-colors text-left">
                                <UploadIcon className="w-5 h-5" />
                                <span className="font-medium">Import JSON</span>
                            </button>
                             <button onClick={() => { onExport(); setIsMenuOpen(false); }} className="w-full flex items-center gap-3 p-2 rounded-md text-sm text-zinc-700 focus:outline-none hover:bg-zinc-100 transition-colors text-left">
                                <DownloadIcon className="w-5 h-5" />
                                <span className="font-medium">Export JSON</span>
                            </button>
                        </div>
                    </div>
                </div>
                )}
            </div>
        </div>
      </div>
    </header>
  );
};

export default React.memo(Header);