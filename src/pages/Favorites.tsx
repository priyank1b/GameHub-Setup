import React from 'react';
import { Game } from '../types/Game';
import { GameGrid } from '../components/GameGrid';
import { EmptyState } from '../components/EmptyState';
import { Star } from 'lucide-react';
import { PageRoute } from '../types/Navigation';

interface FavoritesProps {
  games: Game[];
  onToggleFavorite: (id: number) => void;
  onLaunch: (game: Game) => void;
  onNavigate: (page: PageRoute) => void;
  onSelectGame?: (game: Game) => void;
  onLocate?: (game: Game) => void;
  onRemove?: (game: Game) => void;
  onHide?: (game: Game) => void;
}

export const Favorites: React.FC<FavoritesProps> = ({
  games,
  onToggleFavorite,
  onLaunch,
  onNavigate,
  onSelectGame,
  onLocate,
  onRemove,
  onHide,
}) => {
  const favoriteGames = games.filter((g) => g.isFavorite);

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="flex items-center justify-between p-6 rounded-2xl bg-surface-850 border border-zinc-800/80">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Star className="w-6 h-6 fill-amber-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white font-['Outfit']">Favorite Games</h2>
            <p className="text-xs text-zinc-400">
              Quick access to your most cherished titles across all launchers.
            </p>
          </div>
        </div>
        <span className="text-xs font-mono px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300">
          {favoriteGames.length} Favorites
        </span>
      </div>

      {/* Grid or Empty State */}
      {favoriteGames.length > 0 ? (
        <GameGrid
          games={favoriteGames}
          onToggleFavorite={onToggleFavorite}
          onLaunch={onLaunch}
          onSelectGame={onSelectGame}
          onLocate={onLocate}
          onRemove={onRemove}
          onHide={onHide}
        />
      ) : (
        <EmptyState
          icon={Star}
          title="No Favorites Yet"
          description="Click the star icon on any game card in your library to pin it here for quick access."
          actionLabel="Browse Library"
          onAction={() => onNavigate('library')}
        />
      )}
    </div>
  );
};
