import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Game } from '../types/Game';
import { LibraryFilter, SortOption } from '../types/Navigation';
import { GameLauncher } from '../types/Launcher';
import { LauncherAccount } from '../types/LauncherAccount';
import { GameGrid } from '../components/GameGrid';
import { EmptyState } from '../components/EmptyState';
import { LauncherBadge } from '../components/LauncherBadge';
import {
  Filter,
  ArrowUpDown,
  AlertTriangle,
  ChevronDown,
  LayoutGrid,
  FolderTree,
  Users,
  Plus,
  X,
  Check,
  Gamepad2,
  Layers,
} from 'lucide-react';
import { FocusableItem } from '../components/FocusableItem';

interface LibraryProps {
  games: Game[];
  currentFilter: LibraryFilter;
  onFilterChange: (filter: LibraryFilter) => void;
  searchQuery: string;
  onToggleFavorite: (id: number) => void;
  onLaunch: (game: Game, launcherAccountId?: number) => void;
  onInstall?: (game: Game, launcherAccountId?: number, externalGameId?: string) => void;
  onSelectGame?: (game: Game) => void;
  onFocusGame?: (game: Game) => void;
  onLocate?: (game: Game) => void;
  onRemove?: (game: Game) => void;
  onHide?: (game: Game) => void;
  accounts?: LauncherAccount[];
  accountGameCounts?: Record<string, number>;
  onOpenAccounts?: () => void;
}

export const Library: React.FC<LibraryProps> = ({
  games,
  currentFilter,
  onFilterChange,
  searchQuery,
  onToggleFavorite,
  onLaunch,
  onInstall,
  onSelectGame,
  onFocusGame,
  onLocate,
  onRemove,
  onHide,
  accounts,
  accountGameCounts,
  onOpenAccounts,
}) => {
  const [sortBy, setSortBy] = useState<SortOption>('name-asc');
  const [viewMode, setViewMode] = useState<'SECTIONS' | 'GRID'>('SECTIONS');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const missingGamesCount = useMemo(() => games.filter((g) => !g.isInstalled).length, [games]);
  const favoritesCount = useMemo(() => games.filter((g) => g.isFavorite).length, [games]);

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'INSTALLED' | 'AVAILABLE'>('ALL');

  // Synchronize statusFilter when parent filter changes
  useEffect(() => {
    if (currentFilter === 'INSTALLED') {
      setStatusFilter('INSTALLED');
    } else if (currentFilter === 'AVAILABLE') {
      setStatusFilter('AVAILABLE');
    } else {
      setStatusFilter('ALL');
    }
  }, [currentFilter]);

  // Games matching the active launcher/account/favorite filter
  const currentScopedGames = useMemo(() => {
    return games.filter((game) => {
      if (currentFilter === 'INSTALLED') return game.isInstalled;
      if (currentFilter === 'AVAILABLE') {
        return (
          game.libraryStatus === 'AVAILABLE' ||
          (!game.isInstalled && (game.ownerships?.length ?? 0) > 0)
        );
      }
      if (currentFilter === 'MISSING') {
        const isAvail =
          game.libraryStatus === 'AVAILABLE' ||
          (!game.isInstalled && (game.ownerships?.length ?? 0) > 0);
        return !game.isInstalled && !isAvail;
      }
      if (currentFilter === 'FAVORITES') return game.isFavorite;
      if (currentFilter.startsWith('account:')) {
        const targetAccount = currentFilter.replace('account:', '');
        return game.ownerships?.some((o) => o.accountDisplayName === targetAccount);
      }
      if (currentFilter !== 'ALL' && game.launcher !== currentFilter) {
        return false;
      }
      return true;
    });
  }, [games, currentFilter]);

  // Counts of installed vs uninstalled/available games within the current filter scope
  const scopedCounts = useMemo(() => {
    let installed = 0;
    let available = 0;
    for (const g of currentScopedGames) {
      if (g.isInstalled) installed++;
      else available++;
    }
    return {
      total: currentScopedGames.length,
      installed,
      available,
    };
  }, [currentScopedGames]);

  const filteredGames = useMemo(() => {
    return currentScopedGames
      .filter((game) => {
        // Status sub-filter (All / Installed Only / Ready to Install Only)
        if (statusFilter === 'INSTALLED' && !game.isInstalled) return false;
        if (statusFilter === 'AVAILABLE' && game.isInstalled) return false;

        // Multi-attribute search filter: Name, Developer, Publisher, Genre
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = game.name.toLowerCase().includes(q);
          const matchDev = game.developer?.toLowerCase().includes(q);
          const matchPub = game.publisher?.toLowerCase().includes(q);
          const matchGenre = game.genre?.toLowerCase().includes(q);
          return matchName || matchDev || matchPub || matchGenre;
        }
        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'name-asc':
            return a.name.localeCompare(b.name);
          case 'name-desc':
            return b.name.localeCompare(a.name);
          case 'recently-added':
            return (b.id || 0) - (a.id || 0);
          case 'recent': {
            const timeA = a.lastPlayedAt ? new Date(a.lastPlayedAt).getTime() : 0;
            const timeB = b.lastPlayedAt ? new Date(b.lastPlayedAt).getTime() : 0;
            return timeB - timeA;
          }
          case 'playtime':
            return b.totalPlayTime - a.totalPlayTime;
          case 'size':
            return (
              (b.installSizeBytes ?? b.installedSize ?? 0) -
              (a.installSizeBytes ?? a.installedSize ?? 0)
            );
          default:
            return 0;
        }
      });
  }, [currentScopedGames, statusFilter, searchQuery, sortBy]);

  const launcherCounts = useMemo(() => {
    return {
      ALL: games.length,
      STEAM: games.filter((g) => g.launcher === 'STEAM').length,
      EPIC: games.filter((g) => g.launcher === 'EPIC').length,
      GOG: games.filter((g) => g.launcher === 'GOG').length,
      XBOX: games.filter((g) => g.launcher === 'XBOX').length,
      UBISOFT: games.filter((g) => g.launcher === 'UBISOFT').length,
      STANDALONE: games.filter((g) => g.launcher === 'STANDALONE').length,
      FAVORITES: favoritesCount,
    };
  }, [games, favoritesCount]);

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        filterDropdownRef.current &&
        !filterDropdownRef.current.contains(target) &&
        filterButtonRef.current &&
        !filterButtonRef.current.contains(target)
      ) {
        setIsFilterOpen(false);
      }
    };
    if (isFilterOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFilterOpen]);

  const filterAccounts = useMemo(() => {
    if (!accounts) return [];
    return accounts
      .filter((a) => a.connectionStatus === 'CONNECTED')
      .map((acc) => ({
        ...acc,
        count: accountGameCounts?.[acc.displayName] ?? 0,
      }))
      .sort((a, b) => {
        if (a.count > 0 && b.count === 0) return -1;
        if (a.count === 0 && b.count > 0) return 1;
        if (b.count !== a.count) return b.count - a.count;
        return a.displayName.localeCompare(b.displayName);
      });
  }, [accounts, accountGameCounts]);

  const platformFilters = useMemo(
    () => [
      { id: 'STEAM' as GameLauncher, label: 'Steam', count: launcherCounts.STEAM },
      { id: 'EPIC' as GameLauncher, label: 'Epic Games', count: launcherCounts.EPIC },
      { id: 'XBOX' as GameLauncher, label: 'Xbox', count: launcherCounts.XBOX },
      { id: 'GOG' as GameLauncher, label: 'GOG', count: launcherCounts.GOG },
      { id: 'UBISOFT' as GameLauncher, label: 'Ubisoft', count: launcherCounts.UBISOFT },
      { id: 'STANDALONE' as GameLauncher, label: 'Standalone', count: launcherCounts.STANDALONE },
    ],
    [launcherCounts]
  );

  const statusFilters = useMemo(
    () => [
      { id: 'ALL' as LibraryFilter, label: 'All Games', count: games.length },
      {
        id: 'INSTALLED' as LibraryFilter,
        label: 'Installed Only',
        count: games.filter((g) => g.isInstalled).length,
      },
      {
        id: 'AVAILABLE' as LibraryFilter,
        label: 'Available to Install',
        count: games.filter(
          (g) =>
            !g.isInstalled &&
            ((g.ownerships?.length ?? 0) > 0 || g.libraryStatus === 'AVAILABLE')
        ).length,
      },
      { id: 'FAVORITES' as LibraryFilter, label: 'Favorites', count: favoritesCount },
      ...(missingGamesCount > 0
        ? [
            {
              id: 'MISSING' as LibraryFilter,
              label: 'Missing / Moved',
              count: missingGamesCount,
              isWarning: true,
            },
          ]
        : []),
    ],
    [games, favoritesCount, missingGamesCount]
  );

  const activeFilterInfo = useMemo(() => {
    if (currentFilter === 'ALL') return null;
    if (currentFilter === 'INSTALLED') {
      return {
        label: 'Installed Only',
        type: 'Status',
        count: games.filter((g) => g.isInstalled).length,
        isWarning: false,
      };
    }
    if (currentFilter === 'AVAILABLE') {
      const count = games.filter(
        (g) =>
          !g.isInstalled &&
          ((g.ownerships?.length ?? 0) > 0 || g.libraryStatus === 'AVAILABLE')
      ).length;
      return { label: 'Available to Install', type: 'Status', count, isWarning: false };
    }
    if (currentFilter === 'FAVORITES') {
      return { label: 'Favorites', type: 'Status', count: favoritesCount, isWarning: false };
    }
    if (currentFilter === 'MISSING') {
      return {
        label: 'Missing / Moved',
        type: 'Status',
        count: missingGamesCount,
        isWarning: true,
      };
    }
    if (currentFilter.startsWith('account:')) {
      const accName = currentFilter.replace('account:', '');
      const count = accountGameCounts?.[accName] ?? 0;
      return { label: accName, type: 'Account', count, isWarning: false };
    }
    const launcherLabels: Record<string, string> = {
      STEAM: 'Steam',
      EPIC: 'Epic Games',
      GOG: 'GOG',
      XBOX: 'Xbox',
      UBISOFT: 'Ubisoft',
      STANDALONE: 'Standalone',
    };
    return {
      label: launcherLabels[currentFilter] || currentFilter,
      type: 'Platform',
      count: launcherCounts[currentFilter as keyof typeof launcherCounts],
      isWarning: false,
    };
  }, [
    currentFilter,
    games,
    favoritesCount,
    missingGamesCount,
    accountGameCounts,
    launcherCounts,
  ]);


  // Steam-style Collapsible Section groupings — Named directly after each Steam Account / Launcher
  const sections = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        title: string;
        subtitle?: string;
        launcher: GameLauncher;
        accountName: string;
        avatarUrl?: string;
        isFamily?: boolean;
        games: Game[];
      }
    >();

    // 1. First register all connected launcher and family accounts so they appear even with 0 games
    if (accounts && accounts.length > 0) {
      for (const acc of accounts) {
        if (acc.connectionStatus !== 'CONNECTED') continue;
        const key = `${acc.launcher}:${acc.displayName}`;
        const isSteam = acc.launcher === 'STEAM';
        // Family accounts are Steam friends/borrowers without local machine login, or detected friends
        const isFamily =
          isSteam &&
          ['JackedJoker', 'KhatarnakIshan', 'yadavdhruvesh06'].includes(acc.displayName);

        map.set(key, {
          id: key,
          title: acc.displayName,
          subtitle: isFamily
            ? 'Shared Family Library'
            : isSteam
            ? 'Steam Account'
            : `${acc.launcher} Account`,
          launcher: acc.launcher,
          accountName: acc.displayName,
          avatarUrl: acc.avatarUrl,
          isFamily,
          games: [],
        });
      }
    }

    // 2. Distribute filtered games into their respective account groups
    for (const game of filteredGames) {
      if (game.ownerships && game.ownerships.length > 0) {
        for (const o of game.ownerships) {
          // When filtering by Installed, only attribute the game to the account(s) where it is actually installed locally!
          if (
            (currentFilter === 'INSTALLED' || statusFilter === 'INSTALLED') &&
            !o.isInstalled
          ) {
            continue;
          }

          const key = `${o.launcher}:${o.accountDisplayName}`;
          if (!map.has(key)) {
            map.set(key, {
              id: key,
              title: o.accountDisplayName,
              subtitle: o.launcher === 'STEAM' ? 'Steam Account' : `${o.launcher} Account`,
              launcher: o.launcher,
              accountName: o.accountDisplayName,
              games: [],
            });
          }
          const group = map.get(key)!;
          if (!group.games.some((g) => g.id === game.id)) {
            group.games.push(game);
          }
        }
      } else {
        const key = `${game.launcher}:local`;
        if (!map.has(key)) {
          map.set(key, {
            id: key,
            title: game.launcher === 'EPIC' ? 'Epic Games' : `${game.launcher} Library`,
            subtitle: 'Local Installation',
            launcher: game.launcher,
            accountName: game.launcher,
            games: [],
          });
        }
        const group = map.get(key)!;
        if (!group.games.some((g) => g.id === game.id)) {
          group.games.push(game);
        }
      }
    }

    let allSections = Array.from(map.values());

    // Filter sections based on active filter
    if (currentFilter.startsWith('account:')) {
      const targetAcc = currentFilter.replace('account:', '');
      allSections = allSections.filter((s) => s.accountName === targetAcc);
    } else if (
      currentFilter !== 'ALL' &&
      !['INSTALLED', 'AVAILABLE', 'MISSING', 'FAVORITES'].includes(currentFilter)
    ) {
      allSections = allSections.filter((s) => s.launcher === currentFilter);
    }

    return allSections.sort((a, b) => {
      // Primary accounts first (pbadda, Deltawave), then family/friends, then other launchers
      if (a.launcher === 'STEAM' && b.launcher !== 'STEAM') return -1;
      if (a.launcher !== 'STEAM' && b.launcher === 'STEAM') return 1;
      return a.title.localeCompare(b.title);
    });
  }, [filteredGames, accounts, currentFilter]);

  const toggleSection = (sectionId: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const areAllCollapsed = useMemo(() => {
    return sections.length > 0 && sections.every((s) => collapsedSections[s.id]);
  }, [sections, collapsedSections]);

  const toggleAllSections = () => {
    if (areAllCollapsed) {
      setCollapsedSections({});
    } else {
      const next: Record<string, boolean> = {};
      sections.forEach((s) => (next[s.id] = true));
      setCollapsedSections(next);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Filter and Sort Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-surface-850 border border-zinc-800/80">
        {/* Left Side: Filter Trigger, Quick Tabs & Active Filter Chips */}
        <div className="flex items-center flex-wrap gap-2 relative">
          {/* Main Filter Dropdown Trigger Button */}
          <FocusableItem
            id="library-filter-trigger"
            scope="main"
            group="filters"
            onConfirm={() => setIsFilterOpen((prev) => !prev)}
          >
            {({ ref, isFocused }) => (
              <button
                ref={(node) => {
                  (filterButtonRef as any).current = node;
                  (ref as any).current = node;
                }}
                type="button"
                onClick={() => setIsFilterOpen((prev) => !prev)}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  isFocused ? 'controller-focus' : ''
                } ${
                  currentFilter !== 'ALL'
                    ? 'bg-teal-500/15 text-teal-300 border border-teal-500/40 shadow-sm'
                    : isFilterOpen
                    ? 'bg-zinc-800 text-zinc-100 border border-zinc-700'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800'
                }`}
                title="Filter games by Account, Platform, or Status"
              >
                <Filter className="w-3.5 h-3.5 text-teal-400" />
                <span>Filter</span>
                {currentFilter !== 'ALL' && (
                  <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                )}
                <ChevronDown
                  className={`w-3 h-3 text-zinc-400 transition-transform duration-200 ${
                    isFilterOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>
            )}
          </FocusableItem>

          {/* Quick Tab: All Games */}
          <FocusableItem
            id="filter-quick-all"
            scope="main"
            group="filters"
            onConfirm={() => onFilterChange('ALL')}
          >
            {({ ref, isFocused }) => (
              <button
                ref={ref}
                type="button"
                onClick={() => onFilterChange('ALL')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  isFocused ? 'controller-focus' : ''
                } ${
                  currentFilter === 'ALL'
                    ? 'bg-teal-500 text-zinc-950 font-bold shadow-md shadow-teal-500/20'
                    : 'bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                }`}
              >
                <span>All Games</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    currentFilter === 'ALL'
                      ? 'bg-zinc-950 text-white'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {games.length}
                </span>
              </button>
            )}
          </FocusableItem>

          {/* Active Filter Chip with ✕ clear button */}
          {activeFilterInfo && (
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold animate-in fade-in zoom-in-95 duration-150 ${
                activeFilterInfo.isWarning
                  ? 'bg-amber-500/15 border border-amber-500/30 text-amber-300'
                  : 'bg-teal-500/15 border border-teal-500/30 text-teal-300'
              }`}
            >
              <span className="text-[10px] uppercase font-bold opacity-75 font-mono">
                {activeFilterInfo.type}:
              </span>
              <span>{activeFilterInfo.label}</span>
              {activeFilterInfo.count !== undefined && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    activeFilterInfo.isWarning
                      ? 'bg-amber-500/20 text-amber-200'
                      : 'bg-teal-500/20 text-teal-200'
                  }`}
                >
                  {activeFilterInfo.count}
                </span>
              )}
              <button
                type="button"
                onClick={() => onFilterChange('ALL')}
                className="ml-1 p-0.5 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                title="Clear filter and show all games"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Status Sub-Filter Segmented Control (All / Installed / Ready to Install) */}
          <div className="flex items-center bg-zinc-900/90 p-1 rounded-xl border border-zinc-800/80 shadow-inner">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                statusFilter === 'ALL'
                  ? 'bg-teal-500 text-zinc-950 font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Show both installed and available games"
            >
              <span>All</span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                  statusFilter === 'ALL' ? 'bg-zinc-950 text-white' : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {scopedCounts.total}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('INSTALLED')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                statusFilter === 'INSTALLED'
                  ? 'bg-emerald-500 text-zinc-950 font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-emerald-300'
              }`}
              title="Show only locally installed games ready to play"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Installed</span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                  statusFilter === 'INSTALLED' ? 'bg-zinc-950 text-white' : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {scopedCounts.installed}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('AVAILABLE')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                statusFilter === 'AVAILABLE'
                  ? 'bg-sky-500 text-zinc-950 font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-sky-300'
              }`}
              title="Show only uninstalled games ready to install"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
              <span>Ready to Install</span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                  statusFilter === 'AVAILABLE' ? 'bg-zinc-950 text-white' : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {scopedCounts.available}
              </span>
            </button>
          </div>

          {/* Filter Popover Dropdown */}
          {isFilterOpen && (
            <div
              ref={filterDropdownRef}
              className="absolute left-0 top-full mt-2 w-80 max-h-[75vh] overflow-y-auto bg-zinc-950/95 backdrop-blur-xl border border-zinc-800/90 rounded-2xl shadow-2xl p-3.5 z-50 no-scrollbar space-y-3.5 animate-in fade-in zoom-in-95 duration-150"
            >
              {/* Dropdown Header */}
              <div className="flex items-center justify-between pb-2.5 border-b border-zinc-800/80">
                <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-200">
                  <Filter className="w-3.5 h-3.5 text-teal-400" />
                  <span>Filter Games</span>
                </div>
                {currentFilter !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => {
                      onFilterChange('ALL');
                      setIsFilterOpen(false);
                    }}
                    className="text-[11px] text-teal-400 hover:text-teal-300 flex items-center gap-1 font-medium transition-colors"
                  >
                    <X className="w-3 h-3" />
                    <span>Clear Filter</span>
                  </button>
                )}
              </div>

              {/* By Account & Family Section */}
              {filterAccounts.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-mono">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3 text-teal-400" />
                      <span>Accounts & Family</span>
                    </span>
                    {onOpenAccounts && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsFilterOpen(false);
                          onOpenAccounts();
                        }}
                        className="text-teal-400 hover:text-teal-300 text-[10px] normal-case font-sans hover:underline"
                      >
                        + Manage
                      </button>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    {filterAccounts.map((acc) => {
                      const isSelected = currentFilter === `account:${acc.displayName}`;
                      return (
                        <button
                          key={acc.id}
                          type="button"
                          onClick={() => {
                            onFilterChange(`account:${acc.displayName}`);
                            setIsFilterOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition-colors ${
                            isSelected
                              ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 font-semibold'
                              : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {acc.avatarUrl ? (
                              <img
                                src={acc.avatarUrl}
                                alt=""
                                className="w-4 h-4 rounded-full object-cover flex-shrink-0"
                              />
                            ) : (
                              <Users className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                            )}
                            <span className="truncate">{acc.displayName}</span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                            <span
                              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                                isSelected
                                  ? 'bg-teal-500 text-zinc-950 font-bold'
                                  : acc.count > 0
                                  ? 'bg-zinc-800 text-zinc-300'
                                  : 'bg-zinc-900 text-zinc-600'
                              }`}
                            >
                              {acc.count}
                            </span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-teal-400" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* By Platform / Launcher Section */}
              <div className="space-y-1.5 pt-2 border-t border-zinc-800/80">
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-mono flex items-center gap-1">
                  <Gamepad2 className="w-3 h-3 text-teal-400" />
                  <span>Platforms</span>
                </div>
                <div className="space-y-0.5">
                  {platformFilters
                    .filter((p) => p.count > 0 || ['STEAM', 'EPIC'].includes(p.id))
                    .map((plat) => {
                      const isSelected = currentFilter === plat.id;
                      return (
                        <button
                          key={plat.id}
                          type="button"
                          onClick={() => {
                            onFilterChange(plat.id);
                            setIsFilterOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition-colors ${
                            isSelected
                              ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 font-semibold'
                              : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
                          }`}
                        >
                          <span>{plat.label}</span>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                                isSelected
                                  ? 'bg-teal-500 text-zinc-950 font-bold'
                                  : plat.count > 0
                                  ? 'bg-zinc-800 text-zinc-300'
                                  : 'bg-zinc-900 text-zinc-600'
                              }`}
                            >
                              {plat.count}
                            </span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-teal-400" />}
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* By Status Section */}
              <div className="space-y-1.5 pt-2 border-t border-zinc-800/80">
                <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-mono flex items-center gap-1">
                  <Layers className="w-3 h-3 text-teal-400" />
                  <span>Status & Type</span>
                </div>
                <div className="space-y-0.5">
                  {statusFilters.map((st) => {
                    const isSelected = currentFilter === st.id;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => {
                          onFilterChange(st.id);
                          setIsFilterOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition-colors ${
                          isSelected
                            ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 font-semibold'
                            : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {st.isWarning && (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                          )}
                          <span
                            className={
                              st.isWarning ? 'text-amber-300 font-medium' : ''
                            }
                          >
                            {st.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                              isSelected
                                ? 'bg-teal-500 text-zinc-950 font-bold'
                                : st.isWarning
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-zinc-800 text-zinc-300'
                            }`}
                          >
                            {st.count}
                          </span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-teal-400" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* View Mode & Sort Controls */}
        <div className="flex items-center flex-wrap gap-2 text-xs text-zinc-400 self-end sm:self-center">
          {/* Section View Toggle */}
          <div className="flex items-center gap-1.5 bg-zinc-900/80 p-1 rounded-xl border border-zinc-800">
            <button
              type="button"
              onClick={() => setViewMode('SECTIONS')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                viewMode === 'SECTIONS'
                  ? 'bg-teal-500 text-zinc-950 font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Organize into collapsible sections per Steam / Launcher Account"
            >
              <FolderTree className="w-3.5 h-3.5" />
              <span>Sections</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('GRID')}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                viewMode === 'GRID'
                  ? 'bg-teal-500 text-zinc-950 font-bold shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Display all games in one unified grid"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Grid</span>
            </button>
          </div>

          {/* Quick Collapse / Expand All button in Sections mode */}
          {viewMode === 'SECTIONS' && sections.length > 1 && (
            <button
              type="button"
              onClick={toggleAllSections}
              className="px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs font-medium transition-colors"
            >
              {areAllCollapsed ? 'Expand All' : 'Collapse All'}
            </button>
          )}

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1.5 ml-1">
            <ArrowUpDown className="w-3.5 h-3.5 text-zinc-500" />
            <FocusableItem id="library-sort-select" scope="main" group="filters">
              {({ ref, isFocused }) => (
                <select
                  ref={ref}
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className={`bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-teal-500/50 text-xs ${
                    isFocused ? 'controller-focus' : ''
                  }`}
                >
                  <option value="name-asc">Title (A - Z)</option>
                  <option value="name-desc">Title (Z - A)</option>
                  <option value="recently-added">Recently Added</option>
                  <option value="recent">Recently Played</option>
                  <option value="playtime">Most Played</option>
                  <option value="size">Installed Size</option>
                </select>
              )}
            </FocusableItem>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {filteredGames.length > 0 || (viewMode === 'SECTIONS' && sections.length > 0) ? (
        viewMode === 'SECTIONS' ? (
          <div className="space-y-6">
            {sections.map((section) => {
              const isCollapsed = collapsedSections[section.id];
              const installedCount = section.games.filter((g) => {
                const own = g.ownerships?.find((o) => o.accountDisplayName === section.accountName);
                return own ? own.isInstalled : g.isInstalled;
              }).length;
              const availableCount = section.games.length - installedCount;

              return (
                <div key={section.id} className="space-y-3">
                  {/* Collapsible Section Header with actual Steam / Account Name */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleSection(section.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleSection(section.id);
                      }
                    }}
                    className="flex items-center justify-between p-3.5 px-4 rounded-2xl bg-surface-850 hover:bg-zinc-800/80 border border-zinc-800/80 hover:border-zinc-700/80 transition-all cursor-pointer select-none group shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-1 rounded-lg bg-zinc-800 text-zinc-400 group-hover:text-zinc-200 transition-colors">
                        <ChevronDown
                          className={`w-4 h-4 transition-transform duration-200 ${
                            isCollapsed ? '-rotate-90' : 'rotate-0'
                          }`}
                        />
                      </div>

                      <div className="p-1.5 rounded-xl bg-zinc-800/90 border border-zinc-700/80 flex items-center justify-center">
                        <LauncherBadge launcher={section.launcher} />
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-sm font-bold text-zinc-100 group-hover:text-white transition-colors">
                            {section.title}
                          </h2>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-800 text-zinc-300 border border-zinc-700/60 font-mono uppercase tracking-wider">
                            {section.launcher}
                          </span>
                        </div>
                        {section.subtitle && (
                          <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
                            {section.subtitle}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono">
                        {installedCount > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setStatusFilter((prev) => (prev === 'INSTALLED' ? 'ALL' : 'INSTALLED'));
                            }}
                            className={`px-2 py-0.5 rounded-full transition-all ${
                              statusFilter === 'INSTALLED'
                                ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40 ring-1 ring-emerald-500/30'
                                : 'text-emerald-400/90 hover:bg-emerald-500/10 hover:text-emerald-300'
                            }`}
                            title="Filter: Show only installed games"
                          >
                            {installedCount} installed
                          </button>
                        )}
                        {installedCount > 0 && availableCount > 0 && (
                          <span className="text-zinc-600">•</span>
                        )}
                        {availableCount > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setStatusFilter((prev) => (prev === 'AVAILABLE' ? 'ALL' : 'AVAILABLE'));
                            }}
                            className={`px-2 py-0.5 rounded-full transition-all ${
                              statusFilter === 'AVAILABLE'
                                ? 'bg-sky-500/20 text-sky-300 font-bold border border-sky-500/40 ring-1 ring-sky-500/30'
                                : 'text-sky-400/90 hover:bg-sky-500/10 hover:text-sky-300'
                            }`}
                            title="Filter: Show only ready to install games"
                          >
                            {availableCount} available
                          </button>
                        )}
                      </div>
                      <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300">
                        {section.games.length} {section.games.length === 1 ? 'game' : 'games'}
                      </span>
                      <span className="text-xs text-zinc-500 group-hover:text-zinc-300 transition-colors">
                        {isCollapsed ? 'Expand' : 'Collapse'}
                      </span>
                    </div>
                  </div>

                  {/* Section Content */}
                  {!isCollapsed && (
                    <div className="pt-1">
                      {section.games.length > 0 ? (
                        <GameGrid
                          games={section.games}
                          onToggleFavorite={onToggleFavorite}
                          onLaunch={onLaunch}
                          onInstall={onInstall}
                          onSelectGame={onSelectGame}
                          onFocusGame={onFocusGame}
                          onLocate={onLocate}
                          onRemove={onRemove}
                          onHide={onHide}
                        />
                      ) : (
                        <div className="rounded-2xl border border-zinc-800/80 bg-surface-850/60 p-6 flex flex-col md:flex-row items-center justify-between gap-5 my-1">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 overflow-hidden flex-shrink-0">
                              {section.avatarUrl ? (
                                <img
                                  src={section.avatarUrl}
                                  alt={section.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <Users className="w-6 h-6" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-sm font-bold text-white font-['Outfit']">
                                  {section.title}
                                </h4>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20 font-semibold uppercase tracking-wider">
                                  {section.isFamily ? 'Shared Family Library' : `${section.launcher} Library`}
                                </span>
                              </div>
                              <p className="text-xs text-zinc-400 mt-1">
                                0 games currently installed on this PC from {section.title}.
                              </p>
                              <p className="text-[11px] text-zinc-500 mt-0.5">
                                Games installed from this shared library in Steam will automatically appear here. You can also provide an optional Steam Web API key in Settings to sync remote library games.
                              </p>
                            </div>
                          </div>
                          {onOpenAccounts && (
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <button
                                type="button"
                                onClick={onOpenAccounts}
                                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-200 bg-zinc-800 hover:bg-zinc-700 hover:text-white transition-all border border-zinc-700/60"
                              >
                                Manage Account
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <GameGrid
            games={filteredGames}
            onToggleFavorite={onToggleFavorite}
            onLaunch={onLaunch}
            onInstall={onInstall}
            onSelectGame={onSelectGame}
            onFocusGame={onFocusGame}
            onLocate={onLocate}
            onRemove={onRemove}
            onHide={onHide}
          />
        )
      ) : (
        <EmptyState
          title={
            currentFilter === 'MISSING'
              ? 'No Missing Games'
              : 'No Games Found'
          }
          description={
            currentFilter === 'MISSING'
              ? 'All installed games have verified file paths on disk.'
              : searchQuery
              ? `No games match the search term "${searchQuery}".`
              : `No games currently found under the ${currentFilter} filter.`
          }
          actionLabel="Reset Filters"
          onAction={() => onFilterChange('ALL')}
        />
      )}
    </div>
  );
};
