import React from 'react';
import { NavLink } from 'react-router-dom';
import { HomeIcon } from './icons/HomeIcon';
import { DashboardIcon } from './icons/DashboardIcon';
import { UserIcon } from './icons/UserIcon';
import { TagIcon } from './icons/TagIcon';
import { CompactDiscIcon } from './icons/CompactDiscIcon';
import { VinylIcon } from './icons/VinylIcon';
import { CollectionMode } from '../types';

interface NavItemProps {
  to?: string;
  onClick?: () => void;
  children: React.ReactNode;
  label: string;
  state?: any;
}

const NavItem: React.FC<NavItemProps> = ({ to, onClick, children, label, state }) => {
  if (to) {
    return (
      <NavLink
        to={to}
        end={to === '/'}
        state={state}
        className={({ isActive }) =>
          `flex flex-col items-center justify-center gap-1 w-full h-full transition-colors duration-200 ${
            isActive ? 'text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
          }`
        }
      >
        {children}
        <span className="text-[10px] font-medium leading-none">{label}</span>
      </NavLink>
    );
  }
  return (
     <button
        onClick={onClick}
        className="flex flex-col items-center justify-center gap-1 w-full h-full text-zinc-500 hover:text-zinc-700 transition-colors duration-200"
      >
        {children}
        <span className="text-[10px] font-medium leading-none">{label}</span>
      </button>
  );
};

interface BottomNavBarProps {
  collectionMode: CollectionMode;
  onToggleMode: () => void;
}

const BottomNavBar: React.FC<BottomNavBarProps> = ({ collectionMode, onToggleMode }) => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-md border-t border-zinc-200 z-20 grid grid-cols-5 md:hidden shadow-[0_-1px_10px_rgba(0,0,0,0.05)]">
        <NavItem to="/" label="Home">
            <HomeIcon className="w-6 h-6" />
        </NavItem>
        <NavItem to="/artists" label="Artists">
            <UserIcon className="w-6 h-6" />
        </NavItem>
        <NavItem onClick={onToggleMode} label={collectionMode === 'cd' ? 'CDs' : 'Vinyl'}>
            <div className="p-1 rounded-full bg-zinc-100 text-zinc-800">
                {collectionMode === 'cd' ? <CompactDiscIcon className="w-6 h-6" /> : <VinylIcon className="w-6 h-6" />}
            </div>
        </NavItem>
        <NavItem to="/wantlist" label="Wantlist">
            <TagIcon className="w-6 h-6" />
        </NavItem>
        <NavItem to="/stats" label="Stats">
            <DashboardIcon className="w-6 h-6" />
        </NavItem>
    </nav>
  );
};

export default BottomNavBar;