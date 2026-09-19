import React from 'react';
import { SearchBar } from './SearchBar';
import { RefreshCw, Plus, Settings } from 'lucide-react';
import { PageRoute } from '../types/Navigation';

interface TopBarProps {
  currentPage: PageRoute;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearchSubmit?: () => void;
  onNavigate: (page: PageRoute) => void;
  onRescan?: () => void;
  onAddGame?: () => void;
  isScanning?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentPage,
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  onNavigate,
  onRescan,
  onAddGame,
  isScanning = false,
}) => {
  const getPageTitle = () => {
    switch (currentPage) {
      case 'home':
        return 'Home';
      case 'library':
        return 'Game Library';
      case 'favorites':
        return 'Favorites';
      case 'recently-played':
        return 'Recently Played';
      case 'drives':
        return 'Available Drives';
      case 'settings':
        return 'Settings';
      default:
        return 'GameHub';
    }
  };

  return (
    <header className="h-16 px-6 border-b border-zinc-800/80 bg-surface-900/80 backdrop-blur-md flex items-center justify-between gap-4 sticky top-0 z-30 select-none">
      {/* Current Page Title */}
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold tracking-tight text-white font-['Outfit']">
          {getPageTitle()}
        </h2>
      </div>

      {/* Global Search Area */}
      <div className="flex-1 flex justify-center max-w-xl">
        <SearchBar
          value={searchQuery}
          onChange={onSearchChange}
          onSubmit={onSearchSubmit}
          placeholder="Search all installed games..."
        />
      </div>

      {/* Quick Action Buttons */}
      <div className="flex items-center gap-2.5">
        {/* Rescan Button */}
        <button
          type="button"
          onClick={onRescan}
          disabled={isScanning}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-850 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
          title="Rescan drives for games"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-teal-400 ${isScanning ? 'animate-spin' : ''}`} />
          <span>{isScanning ? 'Scanning...' : 'Rescan'}</span>
        </button>

        {/* Add Game Button */}
        <button
          type="button"
          onClick={onAddGame}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 text-xs font-semibold text-teal-300 hover:text-teal-200 transition-all cursor-pointer shadow-sm active:scale-95"
          title="Manually add a game"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Game</span>
        </button>

        {/* Quick Settings */}
        <button
          type="button"
          onClick={() => onNavigate('settings')}
          className="p-2 rounded-xl bg-surface-850 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-all cursor-pointer"
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
