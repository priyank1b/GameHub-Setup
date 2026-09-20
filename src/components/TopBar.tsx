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

import { FocusableItem } from './FocusableItem';
import { useNavigation } from '../context/NavigationContext';
import { Gamepad2 } from 'lucide-react';

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
  const { controllerInfo } = useNavigation();
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
        {/* Live Controller Connection Indicator */}
        {controllerInfo?.connected && (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-medium"
            title={`Active Controller: ${controllerInfo.name}`}
          >
            <Gamepad2 className="w-3.5 h-3.5 text-teal-400" />
            <span className="hidden xl:inline text-[11px] font-mono tracking-tight">
              {controllerInfo.name}
            </span>
          </div>
        )}

        {/* Rescan Button */}
        <FocusableItem
          id="topbar-rescan"
          scope="topbar"
          group="actions"
          onConfirm={onRescan}
        >
          {({ ref, isFocused }) => (
            <button
              ref={ref}
              type="button"
              onClick={onRescan}
              disabled={isScanning}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-850 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50 ${
                isFocused ? 'controller-focus' : ''
              }`}
              title="Rescan drives for games"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-teal-400 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Scanning...' : 'Rescan'}</span>
            </button>
          )}
        </FocusableItem>

        {/* Add Game Button */}
        <FocusableItem
          id="topbar-add-game"
          scope="topbar"
          group="actions"
          onConfirm={onAddGame}
        >
          {({ ref, isFocused }) => (
            <button
              ref={ref}
              type="button"
              onClick={onAddGame}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 text-xs font-semibold text-teal-300 hover:text-teal-200 transition-all cursor-pointer shadow-sm active:scale-95 ${
                isFocused ? 'controller-focus' : ''
              }`}
              title="Manually add a game"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Game</span>
            </button>
          )}
        </FocusableItem>

        {/* Quick Settings */}
        <FocusableItem
          id="topbar-settings"
          scope="topbar"
          group="actions"
          onConfirm={() => onNavigate('settings')}
        >
          {({ ref, isFocused }) => (
            <button
              ref={ref}
              type="button"
              onClick={() => onNavigate('settings')}
              className={`p-2 rounded-xl bg-surface-850 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-all cursor-pointer ${
                isFocused ? 'controller-focus' : ''
              }`}
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
        </FocusableItem>

        {/* Integrated Window Controls */}
        <div className="flex items-center gap-1 ml-1.5 pl-2.5 border-l border-zinc-800/80">
          <FocusableItem
            id="topbar-minimize"
            scope="topbar"
            group="window"
            onConfirm={handleMinimize}
          >
            {({ ref, isFocused }) => (
              <button
                ref={ref}
                type="button"
                onClick={handleMinimize}
                className={`p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800/80 active:scale-95 transition-all cursor-pointer ${
                  isFocused ? 'controller-focus' : ''
                }`}
                title="Minimize"
              >
                <Minus className="w-4 h-4" />
              </button>
            )}
          </FocusableItem>

          <FocusableItem
            id="topbar-maximize"
            scope="topbar"
            group="window"
            onConfirm={handleMaximize}
          >
            {({ ref, isFocused }) => (
              <button
                ref={ref}
                type="button"
                onClick={handleMaximize}
                className={`p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800/80 active:scale-95 transition-all cursor-pointer ${
                  isFocused ? 'controller-focus' : ''
                }`}
                title={isMaximized ? 'Restore' : 'Maximize'}
              >
                {isMaximized ? (
                  <Copy className="w-3.5 h-3.5" />
                ) : (
                  <Square className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </FocusableItem>

          <FocusableItem
            id="topbar-close"
            scope="topbar"
            group="window"
            onConfirm={handleClose}
          >
            {({ ref, isFocused }) => (
              <button
                ref={ref}
                type="button"
                onClick={handleClose}
                className={`p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-red-600 active:scale-95 transition-all cursor-pointer ${
                  isFocused ? 'controller-focus' : ''
                }`}
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </FocusableItem>
        </div>
      </div>
    </header>
  );
};
