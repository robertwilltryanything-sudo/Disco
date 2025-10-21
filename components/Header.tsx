import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { SyncStatus, SyncProvider, SyncMode } from '../types';
import { MenuIcon } from './icons/MenuIcon';
import StatusIndicator from './StatusIndicator';
import { UploadIcon } from './icons/UploadIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { SettingsIcon } from './icons/SettingsIcon';
import { User } from '@supabase/supabase-js';
import { LogoutIcon } from './icons/LogoutIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import { PlusIcon } from './icons/PlusIcon';

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
    user: User | null;
    onSignOut: () => void;
    isOnWantlistPage?: boolean;
}

const NavItem: React.FC<{ to: string; children: React.ReactNode }> = ({ to, children }) => (
  <li>
    <NavLink
      to={to}
      className={({ isActive }) =>
        `text-base font-medium pb-1 border-b-2 uppercase tracking-wide ${
          isActive
            ? 'text-zinc-900 border-zinc-900'
            : 'text-zinc-600 border-transparent'
        } hover:text-zinc-900`
      }
    >
      {children}
    </NavLink>
  </li>
);

const Header: React.FC<HeaderProps> = ({ 
    onAddClick, 
    collectionCount, 
    onImport, 
    onExport, 
    onOpenSyncSettings,
    syncStatus,
    syncError,
    syncProvider,
    syncMode,
    onManualSync,
    user,
    onSignOut,
    isOnWantlistPage,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
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
          <a
            href="/"
            onClick={handleLogoClick}
            aria-label="Home, clear search filter" 
            className="text-2xl font-black text-zinc-900 hover:text-black uppercase tracking-wider"
            style={{ fontFamily: "'Montserrat', sans-serif" }}
          >
              disco
          </a>
          <span className="ml-3 text-xs font-semibold text-zinc-500 bg-zinc-200 py-0.5 px-2 rounded-full">{collectionCount}</span>
        </div>
        
        <nav className="hidden md:flex flex-shrink-0">
            <ul className="flex items-center gap-6">
                <NavItem to="/dashboard">Dashboard</NavItem>
                <NavItem to="/artists">Artists</NavItem>
                <NavItem to="/wantlist">Wantlist</NavItem>
                <li>
                    <button
                        onClick={onAddClick}
                        className="flex items-center justify-center gap-2 bg-zinc-900 text-white font-bold text-sm py-2 px-4 rounded-lg hover:bg-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zinc-900"
                        aria-label={isOnWantlistPage ? "Add a new item to wantlist" : "Add a new CD"}
                    >
                        <PlusIcon className="h-5 w-5" />
                        <span>{isOnWantlistPage ? 'Add to Wantlist' : 'Add CD'}</span>
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
              />
            )}
            
            <div ref={menuRef} className="relative group">
                <button
                onClick={() => setIsMenuOpen(prev => !prev)}
                className="p-2 rounded-full text-zinc-600 hover:bg-zinc-100 hover:text-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-800"
                aria-haspopup="true"
                aria-expanded={isMenuOpen}
                aria-label="Open menu"
                >
                <MenuIcon className="h-6 w-6" />
                </button>

                <div className="absolute bottom-full right-1/2 translate-x-1/2 mb-2 w-max bg-zinc-800 text-white text-sm rounded-lg py-1 px-2 opacity-0 group-hover:opacity-100 pointer-events-none z-20">
                  Menu
                </div>

                {isMenuOpen && (
                <div 
                    className="absolute top-full right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-zinc-200 p-2 z-30 divide-y divide-zinc-200"
                    role="menu"
                >
                    {user?.email && syncProvider === 'supabase' && (
                         <div className="p-2">
                            <p className="text-sm font-medium text-zinc-500 px-2">Signed in as</p>
                            <p className="text-sm font-semibold text-zinc-800 px-2 truncate">{user.email}</p>
                            <button 
                                onClick={handleSignOutClick}
                                className="w-full flex items-center gap-3 p-2 mt-2 rounded-md text-zinc-700 hover:bg-red-50 hover:text-red-700 focus:outline-none focus:bg-red-50"
                            >
                                <LogoutIcon className="w-5 h-5" />
                                <span className="font-medium">Sign Out</span>
                            </button>
                        </div>
                    )}
                    <div className="p-2">
                        <h3 className="text-sm font-bold text-zinc-800 px-2 mb-2">Tools</h3>
                        <NavLink
                            to="/duplicates"
                            onClick={() => setIsMenuOpen(false)}
                            className={({ isActive }) => `w-full flex items-center gap-3 p-2 rounded-md ${isActive ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900'} focus:outline-none focus:bg-zinc-100`}
                        >
                            <SparklesIcon className="w-5 h-5" />
                            <span className="font-medium">Find Duplicates</span>
                        </NavLink>
                    </div>
                    <div className="p-2">
                        <h3 className="text-sm font-bold text-zinc-800 px-2 mb-2">Sync & Backup</h3>
                         <div className="space-y-2">
                            <button 
                                onClick={onOpenSyncSettings}
                                className="w-full flex items-center gap-3 p-2 rounded-md text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 focus:outline-none focus:bg-zinc-100"
                            >
                                <SettingsIcon className="w-5 h-5" />
                                <span className="font-medium">Sync & Backup Settings...</span>
                            </button>
                        </div>
                    </div>
                    <div className="p-2">
                        <h3 className="text-sm font-bold text-zinc-800 px-2 mb-2">Manual Backup</h3>
                         <div className="space-y-2">
                            <button 
                                onClick={onImport}
                                className="w-full flex items-center gap-3 p-2 rounded-md text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 focus:outline-none focus:bg-zinc-100"
                            >
                                <UploadIcon className="w-5 h-5" />
                                <span className="font-medium">Import Collection...</span>
                            </button>
                             <button
                                onClick={onExport}
                                className="w-full flex items-center gap-3 p-2 rounded-md text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 focus:outline-none focus:bg-zinc-100"
                            >
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