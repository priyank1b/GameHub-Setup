import React, { useState, useEffect } from 'react';
import { SearchBar } from './SearchBar';
import { RefreshCw, Plus, Settings, Minus, Square, Copy, X } from 'lucide-react';
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
  const [isMaximized, setIsMaximized] = useState<boolean>(false);

  useEffect(() => {
    if (window.gameHub?.window?.isMaximized) {
      window.gameHub.window.isMaximized().then((max) => setIsMaximized(max));
    }
    if (window.gameHub?.window?.onMaximizedChange) {
      const unsub = window.gameHub.window.onMaximizedChange((max) => setIsMaximized(max));
      return () => unsub();
    }
  }, []);

  const handleMinimize = () => {
    window.gameHub?.window?.minimize?.();
  };

  const handleMaximize = async () => {
    if (window.gameHub?.window?.maximize) {
      const max = await window.gameHub.window.maximize();
      setIsMaximized(max);
    }
  };

  const handleClose = () => {
    window.gameHub?.window?.close?.();
  };

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
    <header
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest('.no-drag')) return;
        handleMaximize();
      }}
      className="h-16 px-6 border-b border-zinc-800/80 bg-surface-900/80 backdrop-blur-md flex items-center justify-between gap-4 sticky top-0 z-30 select-none drag-region"
    >
      {/* Current Page Title */}
      <div className="flex items-center gap-3 no-drag">
        <h2 className="text-xl font-bold tracking-tight text-white font-['Outfit']">
          {getPageTitle()}
        </h2>
      </div>

      {/* Global Search Area */}
      <div className="flex-1 flex justify-center max-w-xl no-drag">
        <SearchBar
          value={searchQuery}
          onChange={onSearchChange}
          onSubmit={onSearchSubmit}
          placeholder="Search all installed games..."
        />
      </div>

      {/* Quick Action Buttons & Integrated Window Controls */}
      <div className="flex items-center gap-2.5 no-drag">
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

        {/* Integrated Window Controls */}
        <div className="flex items-center gap-1 ml-1.5 pl-2.5 border-l border-zinc-800/80">
          <button
            type="button"
            onClick={handleMinimize}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800/80 active:scale-95 transition-all cursor-pointer"
            title="Minimize"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleMaximize}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800/80 active:scale-95 transition-all cursor-pointer"
            title={isMaximized ? 'Restore' : 'Maximize'}
          >
            {isMaximized ? (
              <Copy className="w-3.5 h-3.5" />
            ) : (
              <Square className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-red-600 active:scale-95 transition-all cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
