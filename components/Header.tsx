
import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import GoogleDriveSync from './GoogleDriveSync';
import { SyncStatus } from '../hooks/useGoogleDrive';
import { MenuIcon } from './icons/MenuIcon';
import StatusIndicator from './StatusIndicator';

interface HeaderProps {
    isApiReady: boolean;
    isSignedIn: boolean;
    signIn: () => void;
    signOut: () => void;
    syncStatus: SyncStatus;
    driveError: string | null;
    onAddClick: () => void;
    collectionCount: number;
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

const Header: React.FC<HeaderProps> = ({ isApiReady, isSignedIn, signIn, signOut, syncStatus, driveError, onAddClick, collectionCount }) => {
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
      // If we are already on the homepage, clicking the logo should clear any active filters.
      // We achieve this by navigating to the same page with a special state object that
      // the ListView component can detect. Using `replace: true` prevents this action
      // from adding a new entry to the browser's history.
      navigate('/', { state: { clearFilter: true }, replace: true });
    } else {
      // If on any other page, simply navigate to the homepage.
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
        
        <nav className="flex-shrink-0">
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
            {isSignedIn && <StatusIndicator status={syncStatus} error={driveError} />}
            
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
                    className="absolute top-full right-0 mt-2 w-max bg-white rounded-lg shadow-lg border border-zinc-200 p-4 z-30"
                    role="menu"
                >
                    <GoogleDriveSync 
                    isApiReady={isApiReady}
                    isSignedIn={isSignedIn}
                    signIn={signIn}
                    signOut={signOut}
                    status={syncStatus}
                    error={driveError}
                    />
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