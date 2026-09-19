import React from 'react';
import { Play } from 'lucide-react';

interface PlayButtonProps {
  onPlay?: (e: React.MouseEvent) => void;
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
}

export const PlayButton: React.FC<PlayButtonProps> = ({
  onPlay,
  size = 'md',
  label = 'PLAY',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2.5',
  }[size];

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  }[size];

  return (
    <button
      type="button"
      onClick={onPlay}
      className={`inline-flex items-center justify-center font-bold tracking-wider rounded-xl bg-teal-500 hover:bg-teal-400 text-zinc-950 shadow-lg shadow-teal-500/20 hover:shadow-teal-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer ${sizeClasses} ${className}`}
    >
      <Play className={`${iconSizes} fill-current`} />
      <span>{label}</span>
    </button>
  );
};
