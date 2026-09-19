import React, { useMemo } from 'react';
import { Game } from '../types/Game';
import { LibraryFilter, SortOption } from '../types/Navigation';
import { GameGrid } from '../components/GameGrid';
import { EmptyState } from '../components/EmptyState';
import { Filter, ArrowUpDown, AlertTriangle } from 'lucide-react';

interface LibraryProps {
  games: Game[];
  currentFilter: LibraryFilter;
  onFilterChange: (filter: LibraryFilter) => void;
  searchQuery: string;
  onToggleFavorite: (id: number) => void;
  onLaunch: (game: Game) => void;
  onSelectGame?: (game: Game) => void;
  onFocusGame?: (game: Game) => void;
  onLocate?: (game: Game) => void;
  onRemove?: (game: Game) => void;
}

export const Library: React.FC<LibraryProps> = ({
  games,
  currentFilter,
  onFilterChange,
  searchQuery,
  onToggleFavorite,
  onLaunch,
  onSelectGame,
  onFocusGame,
  onLocate,
  onRemove,
}) => {
  const [sortBy, setSortBy] = React.useState<SortOption>('name-asc');

  const missingGamesCount = useMemo(() => games.filter((g) => !g.isInstalled).length, [games]);
  const favoritesCount = useMemo(() => games.filter((g) => g.isFavorite).length, [games]);

  const filteredGames = useMemo(() => {
    return games
      .filter((game) => {
        // Platform, Favorites, or Missing filter
        if (currentFilter === 'MISSING') {
          if (game.isInstalled) return false;
        } else if (currentFilter === 'FAVORITES') {
          if (!game.isFavorite) return false;
        } else if (currentFilter !== 'ALL' && game.launcher !== currentFilter) {
          return false;
        }
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
            return (b.installedSize || 0) - (a.installedSize || 0);
          default:
            return 0;
        }
      });
  }, [games, currentFilter, searchQuery, sortBy]);

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

  const filterTabs: { id: LibraryFilter; label: string; count: number }[] = [
    { id: 'ALL', label: 'All Games', count: launcherCounts.ALL },
    { id: 'STEAM', label: 'Steam', count: launcherCounts.STEAM },
    { id: 'EPIC', label: 'Epic', count: launcherCounts.EPIC },
    { id: 'GOG', label: 'GOG', count: launcherCounts.GOG },
    { id: 'XBOX', label: 'Xbox', count: launcherCounts.XBOX },
    { id: 'UBISOFT', label: 'Ubisoft', count: launcherCounts.UBISOFT },
    { id: 'STANDALONE', label: 'Standalone', count: launcherCounts.STANDALONE },
    { id: 'FAVORITES', label: 'Favorites', count: launcherCounts.FAVORITES },
  ];

  if (missingGamesCount > 0) {
    filterTabs.push({
      id: 'MISSING',
      label: 'Missing',
      count: missingGamesCount,
    });
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Filter and Sort Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-surface-850 border border-zinc-800/80">
        {/* Launcher Pills */}
        <div className="flex items-center flex-wrap gap-1.5">
          <Filter className="w-4 h-4 text-zinc-500 mr-1" />
          {filterTabs.map((tab) => {
            const isActive = currentFilter === tab.id;
            const isMissingTab = tab.id === 'MISSING';
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onFilterChange(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? isMissingTab
                      ? 'bg-amber-500 text-zinc-950 font-bold shadow-md shadow-amber-500/20'
                      : 'bg-teal-500 text-zinc-950 font-bold shadow-md shadow-teal-500/20'
                    : isMissingTab
                    ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                }`}
              >
                {isMissingTab && <AlertTriangle className="w-3.5 h-3.5" />}
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    isActive
                      ? isMissingTab
                        ? 'bg-zinc-950 text-amber-400'
                        : 'bg-zinc-950 text-teal-400'
                      : isMissingTab
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Sort Dropdown */}
        <div className="flex items-center gap-2 text-xs text-zinc-400 self-end sm:self-center">
          <ArrowUpDown className="w-3.5 h-3.5 text-zinc-500" />
          <span className="text-zinc-500">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl px-3 py-1.5 focus:outline-none focus:border-teal-500/50 text-xs"
          >
            <option value="name-asc">Title (A - Z)</option>
            <option value="name-desc">Title (Z - A)</option>
            <option value="recently-added">Recently Added</option>
            <option value="recent">Recently Played</option>
            <option value="playtime">Most Played</option>
            <option value="size">Installed Size</option>
          </select>
        </div>
      </div>

      {/* Game Grid or Empty State */}
      {filteredGames.length > 0 ? (
        <GameGrid
          games={filteredGames}
          onToggleFavorite={onToggleFavorite}
          onLaunch={onLaunch}
          onSelectGame={onSelectGame}
          onFocusGame={onFocusGame}
          onLocate={onLocate}
          onRemove={onRemove}
        />
      ) : (
        <EmptyState
          title={currentFilter === 'MISSING' ? 'No Missing Games' : 'No Games Found'}
          description={
            currentFilter === 'MISSING'
              ? 'All installed games have verified file paths on disk.'
              : searchQuery
              ? `No games match the search term "${searchQuery}".`
              : `No games currently found under the ${currentFilter} launcher.`
          }
          actionLabel="Reset Filters"
          onAction={() => onFilterChange('ALL')}
        />
      )}
    </div>
  );
};
