import React from 'react';
import { NavLink } from 'react-router-dom';
import { HomeIcon } from './icons/HomeIcon';
import { DashboardIcon } from './icons/DashboardIcon';
import { UserIcon } from './icons/UserIcon';
import { TagIcon } from './icons/TagIcon';

const NavItem: React.FC<{ to?: string; onClick?: () => void; children: React.ReactNode; label: string; state?: any }> = ({ to, onClick, children, label, state }) => {
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
        <span className="text-xs font-medium">{label}</span>
      </NavLink>
    );
  }
  return (
     <button
        onClick={onClick}
        className="flex flex-col items-center justify-center gap-1 w-full h-full text-zinc-500 hover:text-zinc-700 transition-colors duration-200"
      >
        {children}
        <span className="text-xs font-medium">{label}</span>
      </button>
  );
};

const BottomNavBar: React.FC = () => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white/90 backdrop-blur-sm border-t border-zinc-200 z-20 grid grid-cols-4 md:hidden">
        <NavItem to="/" label="Collection">
            <HomeIcon className="w-6 h-6" />
        </NavItem>
        <NavItem to="/artists" label="Artists">
            <UserIcon className="w-6 h-6" />
        </NavItem>
        <NavItem to="/wantlist" label="Wantlist">
            <TagIcon className="w-6 h-6" />
        </NavItem>
        <NavItem to="/dashboard" label="Dashboard">
            <DashboardIcon className="w-6 h-6" />
        </NavItem>
    </nav>
  );
};

export default BottomNavBar;