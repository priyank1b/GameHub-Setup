import React, { useState, useMemo } from 'react';
import {
  Home,
  Layers,
  Star,
  Clock,
  HardDrive,
  Gamepad2,
  ChevronDown,
  ChevronRight,
  Users,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  BookOpen,
  Download,
  GripVertical,
} from 'lucide-react';
import { PageRoute, LibraryFilter } from '../types/Navigation';
import { APP_CONFIG } from '../config/appConfig';
import { LauncherAccount } from '../types/LauncherAccount';
import { FocusableItem } from './FocusableItem';
import omniPlayLogo from '../assets/logo.png';

interface SidebarProps {
  currentPage: PageRoute;
  currentFilter: LibraryFilter;
  onNavigate: (page: PageRoute, filter?: LibraryFilter) => void;
  onOpenAccounts?: () => void;
  accounts?: LauncherAccount[];
  accountGameCounts?: Record<string, number>;
  gameCounts: {
    total: number;
    installed?: number;
    available?: number;
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
  onOpenAccounts,
  accounts,
  accountGameCounts,
  gameCounts,
}) => {
  const isLibraryActive = currentPage === 'library';

  // Persisted state for retractable sidebar & collapsible submenus
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('gamehub_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const [isLibraryOpen, setIsLibraryOpen] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('gamehub_sidebar_library_open');
      return stored !== null ? stored === 'true' : true;
    } catch {
      return true;
    }
  });

  const [isAccountsOpen, setIsAccountsOpen] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('gamehub_sidebar_accounts_open');
      return stored !== null ? stored === 'true' : true;
    } catch {
      return true;
    }
  });

  const handleToggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('gamehub_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const handleToggleLibrary = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLibraryOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('gamehub_sidebar_library_open', String(next));
      } catch {}
      return next;
    });
  };

  const handleToggleAccounts = () => {
    setIsAccountsOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('gamehub_sidebar_accounts_open', String(next));
      } catch {}
      return next;
    });
  };

  // Sort connected accounts so that accounts with games are prominently displayed first
  const sortedAccounts = useMemo(() => {
    if (!accounts) return [];
    return accounts
      .filter((a) => a.connectionStatus === 'CONNECTED')
      .slice()
      .sort((a, b) => {
        const countA = accountGameCounts?.[a.displayName] ?? 0;
        const countB = accountGameCounts?.[b.displayName] ?? 0;
        if (countA > 0 && countB === 0) return -1;
        if (countA === 0 && countB > 0) return 1;
        if (countB !== countA) return countB - countA;
        return a.displayName.localeCompare(b.displayName);
      });
  }, [accounts, accountGameCounts]);

  // Draggable menu ordering (Library, Favorites, Recently Played)
  const [navOrder, setNavOrder] = useState<('library' | 'favorites' | 'recently-played')[]>(() => {
    try {
      const saved = localStorage.getItem('omniplay_sidebar_nav_order');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          Array.isArray(parsed) &&
          parsed.length === 3 &&
          parsed.includes('library') &&
          parsed.includes('favorites') &&
          parsed.includes('recently-played')
        ) {
          return parsed;
        }
      }
    } catch {}
    return ['library', 'favorites', 'recently-played'];
  });

  const [draggedId, setDraggedId] = useState<'library' | 'favorites' | 'recently-played' | null>(null);
  const [dragOverId, setDragOverId] = useState<'library' | 'favorites' | 'recently-played' | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'after'>('before');

  const handleDragStart = (e: React.DragEvent, id: 'library' | 'favorites' | 'recently-played') => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedId(id);
  };

  const handleDragOver = (e: React.DragEvent, id: 'library' | 'favorites' | 'recently-played') => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const pos = e.clientY < midY ? 'before' : 'after';
    if (dragOverId !== id || dropPosition !== pos) {
      setDragOverId(id);
      setDropPosition(pos);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    const related = e.relatedTarget as Node | null;
    if (!e.currentTarget.contains(related)) {
      setDragOverId(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: 'library' | 'favorites' | 'recently-played') => {
    e.preventDefault();
    const sourceId = (e.dataTransfer.getData('text/plain') || draggedId) as 'library' | 'favorites' | 'recently-played';
    if (sourceId && sourceId !== targetId) {
      const list = [...navOrder];
      const fromIdx = list.indexOf(sourceId);
      const toIdx = list.indexOf(targetId);
      if (fromIdx !== -1 && toIdx !== -1) {
        list.splice(fromIdx, 1);
        const insertIdx = dropPosition === 'before'
          ? (toIdx > fromIdx ? toIdx - 1 : toIdx)
          : (toIdx > fromIdx ? toIdx : toIdx + 1);
        list.splice(insertIdx, 0, sourceId);
        setNavOrder(list);
        try {
          localStorage.setItem('omniplay_sidebar_nav_order', JSON.stringify(list));
        } catch {}
      }
    }
    setDraggedId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  return (
    <aside
      className={`${
        isCollapsed ? 'w-[72px]' : 'w-64'
      } flex-shrink-0 bg-surface-900 border-r border-zinc-800/80 flex flex-col justify-between select-none h-screen sticky top-0 transition-all duration-300 ease-in-out`}
    >
      <div className="flex flex-col h-full min-h-0">
        {/* Brand Header */}
        <div
          onDoubleClick={() => window.gameHub?.window?.maximize()}
          className="h-16 px-4 flex items-center justify-between border-b border-zinc-800/80 drag-region flex-shrink-0"
        >
          {!isCollapsed ? (
            <>
              <div className="flex items-center gap-3 no-drag min-w-0">
                <div className="p-1 rounded-xl bg-teal-500/10 border border-teal-500/25 flex-shrink-0 flex items-center justify-center">
                  <img src={omniPlayLogo} className="w-6 h-6 rounded-lg object-contain" alt="OmniPlay Logo" />
                </div>
                <div className="min-w-0">
                  <h1 className="font-bold text-base text-white font-['Outfit'] tracking-tight truncate leading-none">
                    {APP_CONFIG.name}
                  </h1>
                  <p className="text-[9px] font-semibold text-teal-400 font-mono tracking-wider truncate mt-0.5">
                    ALL-IN-ONE LAUNCHER
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleToggleCollapse}
                className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors no-drag flex-shrink-0 ml-2"
                title="Minimize sidebar to left"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={handleToggleCollapse}
              className="w-10 h-10 mx-auto rounded-xl bg-teal-500/10 border border-teal-500/20 hover:bg-teal-500/20 flex items-center justify-center transition-all no-drag group"
              title="Expand sidebar"
            >
              <img src={omniPlayLogo} className="w-6 h-6 rounded-lg object-contain group-hover:hidden" alt="OmniPlay" />
              <PanelLeftOpen className="w-5 h-5 text-teal-400 hidden group-hover:block" />
            </button>
          )}
        </div>

        {/* Navigation Section */}
        <nav
          className={`flex-1 overflow-y-auto no-scrollbar ${
            isCollapsed ? 'p-2 space-y-3' : 'p-4 space-y-5'
          }`}
        >
          {/* Main Top Navigation: HOME */}
          <div>
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
                  className={`w-full flex items-center ${
                    isCollapsed ? 'justify-center h-10 px-0' : 'justify-between px-3.5 py-2.5'
                  } rounded-xl text-sm font-semibold transition-all ${
                    currentPage === 'home'
                      ? 'bg-teal-500 text-zinc-950 font-bold shadow-lg shadow-teal-500/20'
                      : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60'
                  } ${isFocused ? 'controller-focus' : ''}`}
                  title="Home"
                >
                  <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
                    <Home className="w-4 h-4 flex-shrink-0" />
                    {!isCollapsed && <span>HOME</span>}
                  </div>
                </button>
              )}
            </FocusableItem>
          </div>

          {/* Draggable Nav Items: Library, Favorites, Recently Played */}
          {navOrder.map((id) => {
            const isDragging = draggedId === id;
            const isOver = dragOverId === id && draggedId !== id;

            return (
              <div
                key={id}
                draggable
                onDragStart={(e) => handleDragStart(e, id)}
                onDragOver={(e) => handleDragOver(e, id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, id)}
                onDragEnd={handleDragEnd}
                className={`relative transition-all duration-150 group/nav-item ${
                  isDragging ? 'opacity-40 scale-[0.98]' : 'opacity-100'
                }`}
              >
                {/* Drop Indicator - Above */}
                {isOver && dropPosition === 'before' && (
                  <div className="absolute -top-1.5 left-2 right-2 h-1 bg-gradient-to-r from-teal-400 to-cyan-400 rounded-full shadow-lg shadow-teal-500/50 z-30 animate-pulse pointer-events-none" />
                )}

                {/* Item Content: Library */}
                {id === 'library' && (
                  <div className="space-y-1">
                    <FocusableItem
                      id="nav-library-main"
                      scope="sidebar"
                      group="nav"
                      onConfirm={() => onNavigate('library', 'INSTALLED')}
                    >
                      {({ ref, isFocused }) => (
                        <div
                          ref={ref}
                          className={`w-full flex items-center ${
                            isCollapsed ? 'justify-center h-10 px-0' : 'justify-between px-3 py-2'
                          } rounded-xl text-xs font-bold uppercase tracking-wider transition-all select-none ${
                            isLibraryActive
                              ? 'text-teal-400 bg-teal-500/10 border border-teal-500/20'
                              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                          } ${isFocused ? 'controller-focus' : ''}`}
                        >
                          <button
                            type="button"
                            onClick={() => onNavigate('library', 'ALL')}
                            className={`flex items-center ${
                              isCollapsed ? 'justify-center w-full' : 'gap-2 flex-1 text-left min-w-0 cursor-pointer'
                            }`}
                            title={`Library - All Games (${gameCounts.total}) (Drag to reorder)`}
                          >
                            {!isCollapsed && (
                              <span title="Drag to reorder menu" className="inline-flex items-center">
                                <GripVertical className="w-3.5 h-3.5 text-zinc-600 hover:text-zinc-300 cursor-grab active:cursor-grabbing flex-shrink-0 transition-colors" />
                              </span>
                            )}
                            <Layers className="w-4 h-4 text-teal-400 flex-shrink-0" />
                            {!isCollapsed && <span className="truncate">LIBRARY</span>}
                          </button>

                          {!isCollapsed && (
                            <div className="flex items-center gap-1.5 flex-shrink-0 ml-1">
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
                                {gameCounts.total}
                              </span>
                              <button
                                type="button"
                                onClick={handleToggleLibrary}
                                className="p-1 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                                title={isLibraryOpen ? 'Collapse library submenus' : 'Expand library submenus'}
                              >
                                <ChevronDown
                                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                                    isLibraryOpen ? 'rotate-0' : '-rotate-90'
                                  }`}
                                />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </FocusableItem>

                    {/* Library Sub-items (collapsible: platforms / launchers) */}
                    {!isCollapsed && isLibraryOpen && (
                      <div className="pl-4 space-y-1 border-l border-zinc-800/80 ml-4 pt-1 animate-in fade-in slide-in-from-top-1 duration-150">
                        {[
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
                                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                                    isActive
                                      ? 'bg-zinc-800 text-teal-300 font-semibold border-l-2 border-teal-400 pl-2.5'
                                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                                  } ${isFocused ? 'controller-focus' : ''}`}
                                >
                                  <span className="truncate font-medium">{label}</span>
                                  <span className="text-[10px] font-mono ml-1.5 flex-shrink-0 text-zinc-500">
                                    {count}
                                  </span>
                                </button>
                              )}
                            </FocusableItem>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Item Content: Favorites */}
                {id === 'favorites' && (
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
                        className={`w-full flex items-center ${
                          isCollapsed ? 'justify-center h-10 px-0' : 'justify-between px-3.5 py-2.5'
                        } rounded-xl text-sm font-semibold transition-all ${
                          currentPage === 'favorites'
                            ? 'bg-teal-500 text-zinc-950 font-bold shadow-lg shadow-teal-500/20'
                            : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60'
                        } ${isFocused ? 'controller-focus' : ''}`}
                        title={`Favorites (${gameCounts.favorites}) (Drag to reorder)`}
                      >
                        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2.5'}`}>
                          {!isCollapsed && (
                            <span title="Drag to reorder menu" className="inline-flex items-center">
                              <GripVertical className="w-3.5 h-3.5 text-zinc-600 hover:text-zinc-300 cursor-grab active:cursor-grabbing flex-shrink-0 transition-colors" />
                            </span>
                          )}
                          <Star className="w-4 h-4 flex-shrink-0" />
                          {!isCollapsed && <span>FAVORITES</span>}
                        </div>
                        {!isCollapsed && (
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                              currentPage === 'favorites'
                                ? 'bg-zinc-900 text-teal-300'
                                : 'bg-zinc-800 text-zinc-400'
                            }`}
                          >
                            {gameCounts.favorites}
                          </span>
                        )}
                      </button>
                    )}
                  </FocusableItem>
                )}

                {/* Item Content: Recently Played */}
                {id === 'recently-played' && (
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
                        className={`w-full flex items-center ${
                          isCollapsed ? 'justify-center h-10 px-0' : 'justify-between px-3.5 py-2.5'
                        } rounded-xl text-sm font-semibold transition-all ${
                          currentPage === 'recently-played'
                            ? 'bg-teal-500 text-zinc-950 font-bold shadow-lg shadow-teal-500/20'
                            : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60'
                        } ${isFocused ? 'controller-focus' : ''}`}
                        title="Recently Played (Drag to reorder)"
                      >
                        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2.5'}`}>
                          {!isCollapsed && (
                            <span title="Drag to reorder menu" className="inline-flex items-center">
                              <GripVertical className="w-3.5 h-3.5 text-zinc-600 hover:text-zinc-300 cursor-grab active:cursor-grabbing flex-shrink-0 transition-colors" />
                            </span>
                          )}
                          <Clock className="w-4 h-4 flex-shrink-0" />
                          {!isCollapsed && <span>RECENTLY PLAYED</span>}
                        </div>
                      </button>
                    )}
                  </FocusableItem>
                )}

                {/* Drop Indicator - Below */}
                {isOver && dropPosition === 'after' && (
                  <div className="absolute -bottom-1.5 left-2 right-2 h-1 bg-gradient-to-r from-teal-400 to-cyan-400 rounded-full shadow-lg shadow-teal-500/50 z-30 animate-pulse pointer-events-none" />
                )}
              </div>
            );
          })}

          {/* FAMILY & LAUNCHER ACCOUNTS */}
          <div className="pt-3 border-t border-zinc-800/80">
            {!isCollapsed ? (
              <div className="space-y-1.5">
                <div className="px-3.5 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleToggleAccounts}
                    className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-300 font-mono transition-colors group"
                    title={isAccountsOpen ? 'Collapse accounts' : 'Expand accounts'}
                  >
                    <ChevronDown
                      className={`w-3 h-3 text-zinc-500 group-hover:text-zinc-300 transition-transform duration-200 ${
                        isAccountsOpen ? 'rotate-0' : '-rotate-90'
                      }`}
                    />
                    <span>ACCOUNTS & FAMILY</span>
                  </button>
                  <button
                    type="button"
                    onClick={onOpenAccounts}
                    className="text-[10px] font-semibold text-teal-400 hover:text-teal-300 transition-colors uppercase tracking-wider"
                    title="Manage launcher accounts and family libraries"
                  >
                    Manage
                  </button>
                </div>

                {/* Account List (collapsible) */}
                {isAccountsOpen && (
                  <div className="space-y-0.5 animate-in fade-in slide-in-from-top-1 duration-150">
                    {sortedAccounts && sortedAccounts.length > 0 ? (
                      sortedAccounts.map((acc) => {
                        const isFilterActive =
                          isLibraryActive && currentFilter === `account:${acc.displayName}`;
                        const count = accountGameCounts?.[acc.displayName] ?? 0;
                        return (
                          <FocusableItem
                            key={acc.id}
                            id={`nav-acc-${acc.id}`}
                            scope="sidebar"
                            group="nav"
                            onConfirm={() => onNavigate('library', `account:${acc.displayName}`)}
                          >
                            {({ ref, isFocused }) => (
                              <button
                                ref={ref}
                                type="button"
                                onClick={() => onNavigate('library', `account:${acc.displayName}`)}
                                className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs transition-all ${
                                  isFilterActive
                                    ? 'bg-teal-500/10 text-teal-300 font-semibold border border-teal-500/30'
                                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                                } ${isFocused ? 'controller-focus' : ''}`}
                                title={`Filter games owned or shared by ${acc.displayName}`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  {acc.avatarUrl ? (
                                    <img
                                      src={acc.avatarUrl}
                                      alt=""
                                      className="w-4 h-4 rounded-full object-cover flex-shrink-0"
                                    />
                                  ) : (
                                    <Users className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" />
                                  )}
                                  <span className="truncate">{acc.displayName}</span>
                                </div>
                                <span
                                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full flex-shrink-0 ml-1.5 ${
                                    count > 0
                                      ? 'bg-zinc-800 text-zinc-300'
                                      : 'bg-zinc-800/50 text-zinc-500'
                                  }`}
                                >
                                  {count}
                                </span>
                              </button>
                            )}
                          </FocusableItem>
                        );
                      })
                    ) : null}

                    <button
                      type="button"
                      onClick={onOpenAccounts}
                      className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-zinc-500 hover:text-teal-400 hover:bg-zinc-800/30 transition-all font-medium"
                    >
                      <Plus className="w-3.5 h-3.5 text-teal-500 flex-shrink-0" />
                      <span>Add Family Account...</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenAccounts}
                className="w-10 h-10 mx-auto flex items-center justify-center rounded-xl text-zinc-400 hover:text-teal-400 hover:bg-zinc-800/60 transition-all"
                title="Manage Accounts & Family"
              >
                <Users className="w-4 h-4" />
              </button>
            )}
          </div>
        </nav>

        {/* Collapsed Bottom Expand Trigger */}
        {isCollapsed && (
          <div className="p-2 border-t border-zinc-800/80 flex-shrink-0">
            <button
              type="button"
              onClick={handleToggleCollapse}
              className="w-10 h-10 mx-auto flex items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              title="Expand sidebar"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
