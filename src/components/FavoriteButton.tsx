import React from 'react';
import { Star } from 'lucide-react';

interface FavoriteButtonProps {
  isFavorite: boolean;
  onToggle: (e: React.MouseEvent) => void;
  className?: string;
}

export const FavoriteButton: React.FC<FavoriteButtonProps> = ({
  isFavorite,
  onToggle,
  className = '',
}) => {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle(e);
      }}
      aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      className={`relative z-20 cursor-pointer p-2 rounded-full transition-all duration-200 backdrop-blur-md ${
        isFavorite
          ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 ring-1 ring-amber-500/40 shadow-lg shadow-amber-500/20'
          : 'bg-black/60 text-zinc-400 hover:text-amber-300 hover:bg-black/80'
      } ${className}`}
    >
      <Star
        className={`w-4 h-4 transition-transform duration-200 ${
          isFavorite ? 'fill-amber-400 scale-110' : 'hover:scale-110'
        }`}
      />
    </button>
  );
};
