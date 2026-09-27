import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Game } from '../types/Game';
import { GameCard } from './GameCard';
import { Loader2 } from 'lucide-react';

interface GameGridProps {
  games: Game[];
  onToggleFavorite?: (id: number) => void;
  onLaunch?: (game: Game, launcherAccountId?: number) => void;
  onInstall?: (game: Game, launcherAccountId?: number, externalGameId?: string) => void;
  onSelectGame?: (game: Game) => void;
  onFocusGame?: (game: Game) => void;
  onLocate?: (game: Game) => void;
  onRemove?: (game: Game) => void;
  onHide?: (game: Game) => void;
  className?: string;
  initialBatch?: number;
  batchSize?: number;
}

export const GameGrid: React.FC<GameGridProps> = ({
  games,
  onToggleFavorite,
  onLaunch,
  onInstall,
  onSelectGame,
  onFocusGame,
  onLocate,
  onRemove,
  onHide,
  className = '',
  initialBatch = 36,
  batchSize = 24,
}) => {
  const [visibleCount, setVisibleCount] = useState<number>(() =>
    Math.min(initialBatch, games.length)
  );
  const sentinelRef = useRef<HTMLDivElement>(null);

  // When the games array changes (filters, search, sort), reset visibleCount to initialBatch
  useEffect(() => {
    setVisibleCount(Math.min(initialBatch, games.length));
  }, [games, initialBatch]);

  // Set up IntersectionObserver to smoothly batch-load more games as user scrolls near bottom
  useEffect(() => {
    if (visibleCount >= games.length) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + batchSize, games.length));
        }
      },
      {
        root: null, // viewport
        rootMargin: '400px', // trigger 400px ahead so user never hits a jarring stop
        threshold: 0,
      }
    );

    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
  }, [visibleCount, games.length, batchSize]);

  const visibleGames = useMemo(() => games.slice(0, visibleCount), [games, visibleCount]);
  const hasMore = visibleCount < games.length;

  const handleLoadAll = () => {
    setVisibleCount(games.length);
  };

  return (
    <div className="space-y-6">
      <div
        className={`grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-5 ${className}`}
        data-testid="game-grid"
      >
        {visibleGames.map((game) => (
          <GameCard
            key={game.id}
            game={game}
            onToggleFavorite={onToggleFavorite}
            onLaunch={onLaunch}
            onInstall={onInstall}
            onClick={onSelectGame}
            onFocus={onFocusGame}
            onLocate={onLocate}
            onRemove={onRemove}
            onHide={onHide}
          />
        ))}
      </div>

      {/* Sentinel & Progressive Scroll Indicator */}
      {hasMore && (
        <div
          ref={sentinelRef}
          className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 text-zinc-400 text-xs shadow-sm"
        >
          <div className="flex items-center gap-2.5">
            <Loader2 className="w-4 h-4 text-teal-400 animate-spin flex-shrink-0" />
            <span>
              Showing <span className="text-zinc-200 font-mono font-semibold">{visibleCount}</span> of{' '}
              <span className="text-zinc-200 font-mono font-semibold">{games.length}</span> games
            </span>
          </div>

          <button
            type="button"
            onClick={handleLoadAll}
            className="px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors text-xs font-semibold"
          >
            Show All ({games.length})
          </button>
        </div>
      )}

      {!hasMore && games.length > initialBatch && (
        <div className="text-center py-4 text-xs font-mono text-zinc-600">
          Showing all {games.length} games
        </div>
      )}
    </div>
  );
};
