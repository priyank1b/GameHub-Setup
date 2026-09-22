import React from 'react';
import { Game } from '../types/Game';
import { GameCard } from './GameCard';

interface GameGridProps {
  games: Game[];
  onToggleFavorite?: (id: number) => void;
  onLaunch?: (game: Game) => void;
  onSelectGame?: (game: Game) => void;
  onFocusGame?: (game: Game) => void;
  onLocate?: (game: Game) => void;
  onRemove?: (game: Game) => void;
  onHide?: (game: Game) => void;
  className?: string;
}

export const GameGrid: React.FC<GameGridProps> = ({
  games,
  onToggleFavorite,
  onLaunch,
  onSelectGame,
  onFocusGame,
  onLocate,
  onRemove,
  onHide,
  className = '',
}) => {
  return (
    <div
      className={`grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-5 ${className}`}
      data-testid="game-grid"
    >
      {games.map((game) => (
        <GameCard
          key={game.id}
          game={game}
          onToggleFavorite={onToggleFavorite}
          onLaunch={onLaunch}
          onClick={onSelectGame}
          onFocus={onFocusGame}
          onLocate={onLocate}
          onRemove={onRemove}
          onHide={onHide}
        />
      ))}
    </div>
  );
};
