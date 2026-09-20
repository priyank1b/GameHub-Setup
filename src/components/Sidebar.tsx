import React from 'react';
import {
  Home,
  Layers,
  Star,
  Clock,
  HardDrive,
  Gamepad2,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { PageRoute, LibraryFilter } from '../types/Navigation';
import { APP_CONFIG } from '../config/appConfig';

import { FocusableItem } from './FocusableItem';

interface SidebarProps {
  currentPage: PageRoute;
  currentFilter: LibraryFilter;
  onNavigate: (page: PageRoute, filter?: LibraryFilter) => void;
  gameCounts: {
    total: number;
    steam: number;
    epic: number;
    gog: number;
    xbox: number;
    ubisoft: number;
    standalone: number;
    favorites: number;
  };
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  currentFilter,
  onNavigate,
  gameCounts,
}) => {
  const isLibraryActive = currentPage === 'library';

  return (
    <aside className="w-64 flex-shrink-0 bg-surface-900 border-r border-zinc-800/80 flex flex-col justify-between select-none h-screen sticky top-0">
      {/* Brand Header */}
      <div>
        <div
          onDoubleClick={() => window.gameHub?.window?.maximize()}
          className="h-16 px-6 flex items-center gap-3 border-b border-zinc-800/80 drag-region"
        >
          <div className="p-2 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 no-drag">
            <Gamepad2 className="w-6 h-6" />
          </div>
          <div className="no-drag">
            <h1 className="font-bold text-lg text-white font-['Outfit'] tracking-tight">
              {APP_CONFIG.name}
            </h1>
            <p className="text-[10px] font-medium text-teal-400/90 font-mono tracking-wider">
              LAUNCHER SHELL
            </p>
          </div>
        </div>

        {/* Navigation Section */}
        <nav className="p-4 space-y-6 overflow-y-auto max-h-[calc(100vh-8rem)]">
          {/* Main Top Navigation */}
          <div className="space-y-1">
            {/* HOME */}
            <FocusableItem
              id="nav-home"
              scope="sidebar"
              group="nav"
              onConfirm={() => onNavigate('home')}
            >
              {({ ref, isFocused }) => (
                <button
                  ref={ref}
                  type="button"
                  onClick={() => onNavigate('home')}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    currentPage === 'home'
                      ? 'bg-teal-500 text-zinc-950 font-bold shadow-lg shadow-teal-500/20'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60'
                  } ${isFocused ? 'controller-focus' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <Home className="w-4 h-4" />
                    <span>HOME</span>
                  </div>
                </button>
              )}
            </FocusableItem>
          </div>

          {/* LIBRARY Group */}
          <div className="space-y-1.5">
            <FocusableItem
              id="nav-library-all"
              scope="sidebar"
              group="nav"
              onConfirm={() => onNavigate('library', 'ALL')}
            >
              {({ ref, isFocused }) => (
                <button
                  ref={ref}
                  type="button"
                  onClick={() => onNavigate('library', 'ALL')}
                  className={`w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                    isLibraryActive && currentFilter === 'ALL'
                      ? 'text-teal-400 bg-teal-500/10 border border-teal-500/20'
                      : 'text-zinc-400 hover:text-zinc-200'
                  } ${isFocused ? 'controller-focus' : ''}`}
                >
                  <div className="flex items-center gap-2.5">
                    <Layers className="w-4 h-4 text-teal-400" />
                    <span>LIBRARY</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
                    {gameCounts.total}
                  </span>
                </button>
              )}
            </FocusableItem>

            {/* Library Sub-items */}
            <div className="pl-4 space-y-1 border-l border-zinc-800/80 ml-4 pt-1">
              {[
                { filter: 'ALL' as LibraryFilter, label: 'All Games', count: gameCounts.total },
                { filter: 'STEAM' as LibraryFilter, label: 'Steam', count: gameCounts.steam },
                { filter: 'EPIC' as LibraryFilter, label: 'Epic', count: gameCounts.epic },
                { filter: 'GOG' as LibraryFilter, label: 'GOG', count: gameCounts.gog },
                { filter: 'XBOX' as LibraryFilter, label: 'Xbox', count: gameCounts.xbox },
                { filter: 'UBISOFT' as LibraryFilter, label: 'Ubisoft', count: gameCounts.ubisoft },
                {
                  filter: 'STANDALONE' as LibraryFilter,
                  label: 'Standalone',
                  count: gameCounts.standalone,
                },
              ].map(({ filter, label, count }) => {
                const isActive = isLibraryActive && currentFilter === filter;
                return (
                  <FocusableItem
                    key={filter}
                    id={`nav-filter-${filter.toLowerCase()}`}
                    scope="sidebar"
                    group="nav"
                    onConfirm={() => onNavigate('library', filter)}
                  >
                    {({ ref, isFocused }) => (
                      <button
                        ref={ref}
                        type="button"
                        onClick={() => onNavigate('library', filter)}
                        className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-all ${
                          isActive
                            ? 'bg-zinc-800 text-teal-300 font-semibold border-l-2 border-teal-400 pl-2.5'
                            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                        } ${isFocused ? 'controller-focus' : ''}`}
                      >
                        <span>{label}</span>
                        <span className="text-[10px] font-mono text-zinc-500">{count}</span>
                      </button>
                    )}
                  </FocusableItem>
                );
              })}
            </div>
          </div>

          {/* FAVORITES */}
          <div className="space-y-1">
            <FocusableItem
              id="nav-favorites"
              scope="sidebar"
              group="nav"
              onConfirm={() => onNavigate('favorites')}
            >
              {({ ref, isFocused }) => (
                <button
                  ref={ref}
                  type="button"
                  onClick={() => onNavigate('favorites')}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    currentPage === 'favorites'
                      ? 'bg-teal-500 text-zinc-950 font-bold shadow-lg shadow-teal-500/20'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60'
                  } ${isFocused ? 'controller-focus' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <Star className="w-4 h-4" />
                    <span>FAVORITES</span>
                  </div>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                      currentPage === 'favorites'
                        ? 'bg-zinc-900 text-teal-300'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {gameCounts.favorites}
                  </span>
                </button>
              )}
            </FocusableItem>
          </div>

          {/* RECENTLY PLAYED */}
          <div className="space-y-1">
            <FocusableItem
              id="nav-recently-played"
              scope="sidebar"
              group="nav"
              onConfirm={() => onNavigate('recently-played')}
            >
              {({ ref, isFocused }) => (
                <button
                  ref={ref}
                  type="button"
                  onClick={() => onNavigate('recently-played')}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    currentPage === 'recently-played'
                      ? 'bg-teal-500 text-zinc-950 font-bold shadow-lg shadow-teal-500/20'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60'
                  } ${isFocused ? 'controller-focus' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4" />
                    <span>RECENTLY PLAYED</span>
                  </div>
                </button>
              )}
            </FocusableItem>
          </div>

          {/* DRIVES */}
          <div className="space-y-1">
            <FocusableItem
              id="nav-drives"
              scope="sidebar"
              group="nav"
              onConfirm={() => onNavigate('drives')}
            >
              {({ ref, isFocused }) => (
                <button
                  ref={ref}
                  type="button"
                  onClick={() => onNavigate('drives')}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    currentPage === 'drives'
                      ? 'bg-teal-500 text-zinc-950 font-bold shadow-lg shadow-teal-500/20'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60'
                  } ${isFocused ? 'controller-focus' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <HardDrive className="w-4 h-4" />
                    <span>DRIVES</span>
                  </div>
                </button>
              )}
            </FocusableItem>
          </div>
        </nav>
      </div>
    </aside>
  );
};
