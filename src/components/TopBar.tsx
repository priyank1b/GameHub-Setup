import React, { useState, useEffect, useRef } from 'react';
import { SearchBar } from './SearchBar';
import { RefreshCw, Plus, Settings, Minus, Square, Copy, X, Users, HelpCircle, ChevronDown, Trash2, Sparkles } from 'lucide-react';
import { PageRoute } from '../types/Navigation';

interface TopBarProps {
  currentPage: PageRoute;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearchSubmit?: () => void;
  onNavigate: (page: PageRoute) => void;
  onRescan?: () => void;
  onClearCacheAndRescan?: () => void;
  onAddGame?: () => void;
  onOpenAccounts?: () => void;
  isScanning?: boolean;
  gameCount?: number;
}

import { FocusableItem } from './FocusableItem';
import { useNavigation } from '../context/NavigationContext';
import { Gamepad2 } from 'lucide-react';
import { CardSizeControl } from './CardSizeControl';

export const TopBar: React.FC<TopBarProps> = ({
  currentPage,
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  onNavigate,
  onRescan,
  onClearCacheAndRescan,
  onAddGame,
  onOpenAccounts,
  isScanning = false,
  gameCount = 0,
}) => {
  const { controllerInfo } = useNavigation();
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [isScanMenuOpen, setIsScanMenuOpen] = useState(false);
  const scanMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (scanMenuRef.current && !scanMenuRef.current.contains(e.target as Node)) {
        setIsScanMenuOpen(false);
      }
    };
    if (isScanMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isScanMenuOpen]);

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
        return 'OmniPlay';
    }
  };

  return (
    <header
      onDoubleClick={(e) => {
        if ((e.target as HTMLElement).closest('.no-drag')) return;
        handleMaximize();
      }}
      className="h-16 pl-6 pr-0 border-b border-zinc-800/80 bg-surface-900/80 backdrop-blur-md flex items-center justify-between gap-4 sticky top-0 z-30 select-none drag-region"
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
      <div className="flex items-center h-full no-drag">
        <div className="flex items-center gap-2.5 pr-3">
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

        {/* Rescan / Scan for Games Button */}
        {gameCount === 0 ? (
          <FocusableItem
            id="topbar-scan-initial"
            scope="topbar"
            group="actions"
            onConfirm={isScanning ? undefined : onRescan}
          >
            {({ ref, isFocused }) => (
              <button
                ref={ref}
                type="button"
                onClick={isScanning ? undefined : onRescan}
                disabled={isScanning}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-zinc-950 text-xs font-bold shadow-lg shadow-teal-500/25 transition-all cursor-pointer active:scale-95 disabled:opacity-50 ${
                  isFocused ? 'controller-focus' : ''
                }`}
                title="Scan your PC to discover games"
              >
                <Sparkles className="w-3.5 h-3.5 text-zinc-950" />
                <RefreshCw className={`w-3.5 h-3.5 text-zinc-950 ${isScanning ? 'animate-spin' : ''}`} />
                <span>{isScanning ? 'Scanning PC...' : 'Scan for Games'}</span>
              </button>
            )}
          </FocusableItem>
        ) : (
          <div className="relative inline-flex items-center rounded-xl bg-surface-850 border border-zinc-800 hover:border-zinc-700 shadow-sm transition-all" ref={scanMenuRef}>
            <FocusableItem
              id="topbar-rescan"
              scope="topbar"
              group="actions"
              onConfirm={isScanning ? undefined : onRescan}
            >
              {({ ref, isFocused }) => (
                <button
                  ref={ref}
                  type="button"
                  onClick={isScanning ? undefined : onRescan}
                  disabled={isScanning}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-l-xl hover:bg-zinc-800/80 text-xs font-semibold text-zinc-200 hover:text-white transition-all cursor-pointer disabled:opacity-50 ${
                    isFocused ? 'controller-focus' : ''
                  }`}
                  title="Rescan drives for newly installed games (F5)"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-teal-400 ${isScanning ? 'animate-spin' : ''}`} />
                  <span>{isScanning ? 'Scanning...' : 'Rescan'}</span>
                </button>
              )}
            </FocusableItem>

            <div className="w-[1px] h-4 bg-zinc-700/60" />

            <button
              type="button"
              onClick={() => setIsScanMenuOpen((prev) => !prev)}
              disabled={isScanning}
              className={`px-2 py-1.5 rounded-r-xl hover:bg-zinc-800/80 text-zinc-400 hover:text-teal-400 transition-all cursor-pointer flex items-center justify-center disabled:opacity-50 ${
                isScanMenuOpen ? 'text-teal-400 bg-zinc-800' : ''
              }`}
              title="Scan and cache options (Clear cache & rescan)"
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isScanMenuOpen ? 'rotate-180 text-teal-400' : ''}`} />
            </button>

            {isScanMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-surface-900/95 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100 space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsScanMenuOpen(false);
                    onRescan?.();
                  }}
                  className="w-full flex items-start gap-2.5 p-2 rounded-xl text-left hover:bg-zinc-800/70 transition-all text-xs text-zinc-300 hover:text-white cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4 text-teal-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-white">Rescan Library</p>
                    <p className="text-[10px] text-zinc-400">Quick check for newly installed or moved games (F5)</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsScanMenuOpen(false);
                    onClearCacheAndRescan?.();
                  }}
                  className="w-full flex items-start gap-2.5 p-2 rounded-xl text-left hover:bg-amber-500/10 hover:text-amber-300 transition-all text-xs text-zinc-300 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-amber-300">Clear Cache &amp; Rescan</p>
                    <p className="text-[10px] text-zinc-400">Wipe artwork &amp; metadata cache, then execute clean full scan</p>
                  </div>
                </button>
              </div>
            )}
          </div>
        )}

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

        {/* Accounts Manager Button */}
        <FocusableItem
          id="topbar-accounts"
          scope="topbar"
          group="actions"
          onConfirm={onOpenAccounts}
        >
          {({ ref, isFocused }) => (
            <button
              ref={ref}
              type="button"
              onClick={onOpenAccounts}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-850 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white transition-all cursor-pointer shadow-sm active:scale-95 ${
                isFocused ? 'controller-focus' : ''
              }`}
              title="Manage Launcher Accounts"
            >
              <Users className="w-3.5 h-3.5 text-teal-400" />
              <span>Accounts</span>
            </button>
          )}
        </FocusableItem>

        {/* Card Display Size Density Control */}
        <CardSizeControl variant="popover" />

        {/* Help & Documentation */}
        <FocusableItem
          id="topbar-help"
          scope="topbar"
          group="actions"
          onConfirm={() => onNavigate('help')}
        >
          {({ ref, isFocused }) => (
            <button
              ref={ref}
              type="button"
              onClick={() => onNavigate('help')}
              className={`p-2 rounded-xl bg-surface-850 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-all cursor-pointer ${
                isFocused ? 'controller-focus' : ''
              }`}
              title="Help & Documentation"
            >
              <HelpCircle className="w-4 h-4" />
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

        </div>

        {/* Integrated Window Controls - flush to top-right corner */}
        <div className="flex items-center h-full border-l border-zinc-800/80">
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
                className={`w-11 h-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer ${
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
                className={`w-11 h-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer ${
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
                className={`w-12 h-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-red-600 active:bg-red-700 transition-colors cursor-pointer ${
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
