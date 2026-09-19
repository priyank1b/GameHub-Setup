import React, { useState, useRef, useEffect } from 'react';
import { Game } from '../types/Game';
import { LauncherBadge } from './LauncherBadge';
import { FavoriteButton } from './FavoriteButton';
import { PlayButton } from './PlayButton';
import {
  MoreVertical,
  Clock,
  HardDrive,
  Gamepad2,
  AlertTriangle,
  FolderSearch,
  FolderOpen,
  Compass,
  Star,
  Trash2,
  Info,
  Play,
} from 'lucide-react';

import { formatImageUrl } from '../utils/formatImage';

interface GameCardProps {
  game: Game;
  onToggleFavorite?: (id: number) => void;
  onLaunch?: (game: Game) => void;
  onClick?: (game: Game) => void;
  onLocate?: (game: Game) => void;
  onRemove?: (game: Game) => void;
  onFocus?: (game: Game) => void;
}

export const GameCard: React.FC<GameCardProps> = React.memo(({
  game,
  onToggleFavorite,
  onLaunch,
  onClick,
  onLocate,
  onRemove,
  onFocus,
}) => {
  const [imgError, setImgError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(formatImageUrl(game.coverImage));
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isMissing = !game.isInstalled;

  useEffect(() => {
    setCurrentSrc(formatImageUrl(game.coverImage));
    setImgError(false);
  }, [game.coverImage]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  const handleImageError = () => {
    if (
      game.launcher === 'STEAM' &&
      game.launcherAppId &&
      currentSrc &&
      currentSrc.includes('library_600x900.jpg')
    ) {
      setCurrentSrc(`https://cdn.cloudflare.steamstatic.com/steam/apps/${game.launcherAppId}/header.jpg`);
    } else {
      setImgError(true);
    }
  };

  const formatPlayTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    if (hours === 0) {
      const minutes = Math.floor(seconds / 60);
      return `${minutes}m played`;
    }
    return `${hours}h played`;
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return null;
    const gb = (bytes / (1024 * 1024 * 1024)).toFixed(1);
    return `${gb} GB`;
  };

  return (
    <div
      tabIndex={0}
      role="button"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '200px 300px' }}
      aria-label={`${game.name} (${game.launcher})`}
      onClick={() => onClick?.(game)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (onLaunch) {
            onLaunch(game);
          } else {
            onClick?.(game);
          }
        } else if (e.key === ' ') {
          e.preventDefault();
          onClick?.(game);
        }
      }}
      onFocus={() => onFocus?.(game)}
      className={`group relative flex flex-col rounded-2xl bg-surface-850 border transition-all duration-300 hover:shadow-xl hover:-translate-y-1.5 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-900 ${
        menuOpen ? 'z-40' : 'z-10'
      } ${
        isMissing
          ? 'border-amber-500/40 hover:border-amber-400 hover:shadow-amber-500/10'
          : 'border-zinc-800/80 hover:border-teal-500/50 hover:shadow-teal-500/10'
      }`}
    >
      {/* Cover Artwork Container with 3:4 Aspect Ratio */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-zinc-900 rounded-t-2xl">
        {!imgError && currentSrc ? (
          <img
            src={currentSrc}
            alt={game.name}
            onError={handleImageError}
            draggable={false}
            className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 select-none ${
              isMissing ? 'opacity-70 grayscale-[35%]' : ''
            }`}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-zinc-900 to-zinc-800 text-zinc-600 p-4 text-center select-none">
            <Gamepad2 className="w-12 h-12 mb-2 text-zinc-500" />
            <span className="text-xs font-semibold text-zinc-400 line-clamp-2">{game.name}</span>
          </div>
        )}

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-surface-900 via-transparent to-black/40 opacity-70 group-hover:opacity-90 transition-opacity pointer-events-none" />

        {/* Top Badges & Actions */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-30 pointer-events-auto">
          <div className="flex items-center gap-1.5 flex-wrap">
            <LauncherBadge launcher={game.launcher} />
            {isMissing && (
              <span className="inline-flex items-center gap-1 bg-amber-500/95 text-zinc-950 font-bold px-1.5 py-0.5 rounded text-[10px] tracking-wider uppercase shadow-md backdrop-blur-sm">
                <AlertTriangle className="w-3 h-3 text-zinc-950" />
                Missing
              </span>
            )}
          </div>
          <FavoriteButton
            isFavorite={game.isFavorite}
            onToggle={(e) => {
              e.stopPropagation();
              onToggleFavorite?.(game.id);
            }}
          />
        </div>

        {/* Hover Quick Action Overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20 bg-black/40 backdrop-blur-[2px] pointer-events-none">
          <div className="pointer-events-auto">
            {isMissing ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onLocate) {
                    onLocate(game);
                  } else {
                    onClick?.(game);
                  }
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs tracking-wider uppercase shadow-lg shadow-amber-500/30 transition-all hover:scale-105 active:scale-95"
              >
                <FolderSearch className="w-4 h-4" />
                <span>Locate</span>
              </button>
            ) : (
              <PlayButton
                label="PLAY"
                size="md"
                onPlay={(e) => {
                  e.stopPropagation();
                  onLaunch?.(game);
                }}
              />
            )}
          </div>
        </div>

        {/* Bottom Artwork Details (Drive & Size) */}
        <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-[11px] text-zinc-400 font-mono pointer-events-none z-10">
          {game.drive && (
            <span className="inline-flex items-center gap-1 bg-black/40 px-1.5 py-0.5 rounded backdrop-blur-sm">
              <HardDrive className={`w-3 h-3 ${isMissing ? 'text-amber-400' : 'text-teal-400'}`} />
              {game.drive}
            </span>
          )}
          {game.installedSize && <span>{formatSize(game.installedSize)}</span>}
        </div>
      </div>

      {/* Card Info Section */}
      <div className="p-3.5 flex flex-col flex-1 justify-between gap-1.5 bg-surface-850 rounded-b-2xl relative z-20">
        <div className="flex items-start justify-between gap-2 relative">
          <h3
            title={game.name}
            className={`font-semibold text-sm transition-colors line-clamp-1 ${
              isMissing
                ? 'text-zinc-300 group-hover:text-amber-300'
                : 'text-zinc-100 group-hover:text-teal-300'
            }`}
          >
            {game.name}
          </h3>

          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(!menuOpen);
              }}
              className="text-zinc-500 hover:text-zinc-300 p-0.5 rounded transition-colors cursor-pointer"
              title="More Options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {/* Context Dropdown Menu - opens upwards so it is never clipped */}
            {menuOpen && (
              <div
                className="absolute right-0 bottom-full mb-2 w-48 rounded-2xl bg-surface-800 border border-zinc-700 shadow-2xl py-1.5 z-50 text-xs backdrop-blur-xl"
                onClick={(e) => e.stopPropagation()}
              >
                {/* 1. View Details */}
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onClick?.(game);
                  }}
                  className="w-full text-left px-3 py-2 text-zinc-200 hover:bg-zinc-700/60 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <Info className="w-3.5 h-3.5 text-teal-400" />
                  <span>View Details</span>
                </button>

                {/* 2. Play or Locate */}
                {isMissing ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onLocate?.(game);
                    }}
                    className="w-full text-left px-3 py-2 text-amber-300 hover:bg-amber-500/20 flex items-center gap-2.5 font-medium transition-colors cursor-pointer"
                  >
                    <FolderSearch className="w-3.5 h-3.5" />
                    <span>Locate Game...</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onLaunch?.(game);
                      }}
                      className="w-full text-left px-3 py-2 text-zinc-200 hover:bg-zinc-700/60 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 text-teal-400 fill-teal-400/40" />
                      <span>Play Game</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        window.gameHub?.games?.openFolder(game.id);
                      }}
                      className="w-full text-left px-3 py-2 text-zinc-200 hover:bg-zinc-700/60 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <FolderOpen className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Open Folder</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onLocate?.(game);
                      }}
                      className="w-full text-left px-3 py-2 text-zinc-200 hover:bg-zinc-700/60 flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <Compass className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Re-locate Game...</span>
                    </button>
                  </>
                )}

                {/* 3. Favorite */}
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onToggleFavorite?.(game.id);
                  }}
                  className="w-full text-left px-3 py-2 text-zinc-200 hover:bg-zinc-700/60 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <Star className={`w-3.5 h-3.5 ${game.isFavorite ? 'text-amber-400 fill-amber-400' : 'text-zinc-400'}`} />
                  <span>{game.isFavorite ? 'Unfavorite' : 'Add to Favorites'}</span>
                </button>

                <div className="my-1 border-t border-zinc-700/60" />

                {/* 4. Remove */}
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onRemove?.(game);
                  }}
                  className="w-full text-left px-3 py-2 text-rose-400 hover:bg-rose-500/20 flex items-center gap-2.5 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove from Library</span>
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-zinc-400 pt-1 border-t border-zinc-800/60">
          <span className="text-[11px] text-zinc-500 line-clamp-1">{game.genre || 'Game'}</span>
          <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400 font-mono">
            <Clock className="w-3 h-3 text-zinc-500" />
            {formatPlayTime(game.totalPlayTime)}
          </span>
        </div>
      </div>
    </div>
  );
});
