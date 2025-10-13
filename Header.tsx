import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { SyncStatus } from '../hooks/useGoogleDrive';
import { MenuIcon } from './icons/MenuIcon';
import StatusIndicator from './components/StatusIndicator';
import { UploadIcon } from './icons/UploadIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { SyncProvider } from './App';
import { SettingsIcon } from './icons/SettingsIcon';

interface HeaderProps {
    onAddClick: () => void;
    collectionCount: number;
    onImport: () => void;
    onExport: () => void;
    onOpenSyncSettings: () => void;
    syncStatus: SyncStatus;
    syncError: string | null;
    syncProvider: SyncProvider;
}

const NavItem: React.FC<{ to: string; children: React.ReactNode }> = ({ to, children }) => (
  <li>
    <NavLink
      to={to}
      className={({ isActive }) =>
        `text-lg font-medium pb-1 border-b-2 ${
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
    syncProvider
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
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
    if (location.pathname === '/') {
      navigate('/', { state: { clearFilter: true }, replace: true });
    } else {
      navigate('/');
    }
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
            <ul className="flex items-center gap-4">
                <NavItem to="/dashboard">Dashboard</NavItem>
                <NavItem to="/artists">Artists</NavItem>
                <li>
                    <button
                        onClick={onAddClick}
                        className="text-lg font-medium text-zinc-600 hover:text-zinc-900"
                        aria-label="Add a new CD"
                    >
                        Add CD
                    </button>
                </li>
            </ul>
        </nav>

        <div className="flex-1 flex justify-end">
          <div className="flex items-center gap-2">
            {syncProvider !== 'none' && <StatusIndicator status={syncStatus} error={syncError} />}
            
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