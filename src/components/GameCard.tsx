import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  EyeOff,
  Download,
  User,
  Users,
} from 'lucide-react';

import { formatImageUrl } from '../utils/formatImage';
import { useFocusable } from '../hooks/useFocusable';

interface GameCardProps {
  game: Game;
  onToggleFavorite?: (id: number) => void;
  onLaunch?: (game: Game, launcherAccountId?: number) => void;
  onInstall?: (game: Game, launcherAccountId?: number, externalGameId?: string) => void;
  onClick?: (game: Game) => void;
  onLocate?: (game: Game) => void;
  onRemove?: (game: Game) => void;
  onHide?: (game: Game) => void;
  onFocus?: (game: Game) => void;
}

export const GameCard: React.FC<GameCardProps> = React.memo(({
  game,
  onToggleFavorite,
  onLaunch,
  onInstall,
  onClick,
  onLocate,
  onRemove,
  onHide,
  onFocus,

}) => {
  const [imgError, setImgError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(formatImageUrl(game.coverImage));
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [menuPos, setMenuPos] = useState<{ top?: number; bottom?: number; right: number }>({ right: 0 });

  const handleToggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!menuOpen && menuButtonRef.current) {
      const rect = menuButtonRef.current.getBoundingClientRect();
      const openUpwards = rect.top > 250;
      if (openUpwards) {
        setMenuPos({
          bottom: Math.round(window.innerHeight - rect.top + 6),
          right: Math.round(window.innerWidth - rect.right),
        });
      } else {
        setMenuPos({
          top: Math.round(rect.bottom + 6),
          right: Math.round(window.innerWidth - rect.right),
        });
      }
      setMenuOpen(true);
    } else {
      setMenuOpen(false);
    }
  };

  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const isAvailable =
    game.libraryStatus === 'AVAILABLE' ||
    (!game.isInstalled && (game.ownerships?.length ?? 0) > 0);
  const isMissing = !game.isInstalled && !isAvailable;

  // When the game is installed, only display the account(s) where it is actually installed locally!
  // On uninstalled/available games, show all accounts so user knows where it's available.
  const displayOwnerships = React.useMemo(() => {
    if (!game.ownerships || game.ownerships.length === 0) return [];
    if (game.isInstalled) {
      const installedOnly = game.ownerships.filter((o) => o.isInstalled);
      return installedOnly.length > 0 ? installedOnly : game.ownerships;
    }
    return game.ownerships;
  }, [game.ownerships, game.isInstalled]);

  const hasMultipleAccounts = displayOwnerships.length > 1;
  const ownerNames = displayOwnerships.map((o) => o.accountDisplayName);

  const handleAction = () => {
    if (game.isInstalled && onLaunch) {
      // Installed games launch directly without interrupting the user
      onLaunch(game);
    } else if (isAvailable && onInstall) {
      if (game.ownerships && game.ownerships.length > 1) {
        setShowAccountPicker(true);
      } else {
        const first = game.ownerships?.[0];
        onInstall(game, first?.launcherAccountId, first?.externalGameId);
      }
    } else if (isMissing && onLocate) {
      onLocate(game);
    } else {
      onClick?.(game);
    }
  };

  const { ref: focusRef, isFocused } = useFocusable<HTMLDivElement>({
    id: `game-card-${game.id}`,
    scope: 'main',
    group: 'grid',
    onConfirm: () => {
      handleAction();
    },
    onSecondary: () => {
      // X Button: Toggle favorite
      onToggleFavorite?.(game.id);
    },
    onMenu: () => {
      // Y Button / Menu: Open Game Details (description) modal
      onClick?.(game);
    },
  });

  useEffect(() => {
    if (isFocused) {
      onFocus?.(game);
    }
  }, [isFocused, game, onFocus]);

  useEffect(() => {
    setCurrentSrc(formatImageUrl(game.coverImage));
    setImgError(false);
  }, [game.coverImage]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        menuButtonRef.current &&
        !menuButtonRef.current.contains(target)
      ) {
        setMenuOpen(false);
      }
    };
    const handleClose = () => {
      setMenuOpen(false);
    };

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleClose, true);
      window.addEventListener('resize', handleClose);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleClose, true);
      window.removeEventListener('resize', handleClose);
    };
  }, [menuOpen]);

  const steamAppId = game.launcherAppId || game.ownerships?.find((o) => o.launcher === 'STEAM')?.externalGameId;

  const handleImageError = () => {
    if (
      (game.launcher === 'STEAM' || game.ownerships?.some((o) => o.launcher === 'STEAM')) &&
      steamAppId &&
      currentSrc &&
      !currentSrc.includes('header.jpg')
    ) {
      setCurrentSrc(`https://cdn.cloudflare.steamstatic.com/steam/apps/${steamAppId}/header.jpg`);
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

  const renderCardSize = () => {
    if (game.installSizeStatus === 'CALCULATING') {
      return (
        <span className="text-amber-400/90 text-[10px] bg-black/50 px-1.5 py-0.5 rounded backdrop-blur-sm font-sans font-medium">
          Calculating…
        </span>
      );
    }
    if (game.installSizeStatus === 'ACCESS_DENIED') {
      return (
        <span className="text-rose-400/90 text-[10px] bg-black/50 px-1.5 py-0.5 rounded backdrop-blur-sm font-sans font-medium" title="Access denied">
          Access denied
        </span>
      );
    }
    if (game.installSizeStatus === 'UNKNOWN') {
      return (
        <span className="text-zinc-500 text-[10px] bg-black/50 px-1.5 py-0.5 rounded backdrop-blur-sm font-sans font-medium" title="Size unavailable">
          Size unavailable
        </span>
      );
    }
    const bytes = game.installSizeBytes ?? game.installedSize;
    if (bytes && bytes > 0) {
      const sizeStr = bytes >= 1024 * 1024 * 1024
        ? `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
        : `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
      return (
        <span className="bg-black/50 px-1.5 py-0.5 rounded backdrop-blur-sm font-mono">
          {sizeStr}
        </span>
      );
    }
    if (game.installSizeStatus === 'KNOWN') {
      return (
        <span className="bg-black/50 px-1.5 py-0.5 rounded backdrop-blur-sm font-mono">
          0 B
        </span>
      );
    }
    return null;
  };

  return (
    <div
      ref={focusRef}
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
      className={`group relative flex flex-col rounded-2xl bg-surface-850 border transition-all duration-300 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-900 ${
        menuOpen ? 'z-40' : isFocused ? 'z-30' : 'z-10'
      } ${
        isFocused
          ? isMissing
            ? 'border-amber-400 shadow-2xl shadow-amber-500/25 -translate-y-1.5 ring-2 ring-amber-400 scale-[1.02]'
            : 'border-teal-400 shadow-2xl shadow-teal-500/30 -translate-y-1.5 ring-2 ring-teal-400 scale-[1.02]'
          : isMissing
          ? 'border-amber-500/40 hover:border-amber-400 hover:shadow-amber-500/10 hover:-translate-y-1.5 hover:shadow-xl hover:scale-[1.02]'
          : 'border-zinc-800/80 hover:border-teal-500/50 hover:shadow-teal-500/10 hover:-translate-y-1.5 hover:shadow-xl hover:scale-[1.02]'
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
            className={`w-full h-full object-cover transition-transform duration-500 select-none ${
              isFocused ? 'scale-105' : 'group-hover:scale-105'
            } ${
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
        <div
          className={`absolute inset-0 bg-gradient-to-t from-surface-900 via-transparent to-black/40 transition-opacity pointer-events-none ${
            isFocused ? 'opacity-90' : 'opacity-70 group-hover:opacity-90'
          }`}
        />

        {/* Top Badges & Actions */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-30 pointer-events-auto">
          <div className="flex items-center gap-1.5 flex-wrap">
            <LauncherBadge launcher={game.launcher} />
            {isAvailable && (
              <span className="inline-flex items-center gap-1 bg-sky-500/90 text-zinc-950 font-bold px-1.5 py-0.5 rounded text-[10px] tracking-wider uppercase shadow-md backdrop-blur-sm">
                <Download className="w-3 h-3 text-zinc-950" />
                Available
              </span>
            )}
            {hasMultipleAccounts && (
              <span
                className="inline-flex items-center gap-1 bg-teal-500/20 text-teal-300 border border-teal-500/30 font-bold px-1.5 py-0.5 rounded text-[10px] tracking-wider uppercase shadow-md backdrop-blur-sm"
                title={`Owned across multiple accounts: ${ownerNames.join(', ')}`}
              >
                <Users className="w-3 h-3 text-teal-300" />
                {game.ownerships?.length} Accounts
              </span>
            )}
            {isMissing && (
              <span className="inline-flex items-center gap-1 bg-amber-500/95 text-zinc-950 font-bold px-1.5 py-0.5 rounded text-[10px] tracking-wider uppercase shadow-md backdrop-blur-sm">
                <AlertTriangle className="w-3 h-3 text-zinc-950" />
                Missing / Moved
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

        {/* Hover / Controller Focus Quick Action Overlay */}
        <div
          className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 z-20 bg-black/40 backdrop-blur-[2px] ${
            isFocused ? 'opacity-100 pointer-events-auto' : 'opacity-0 group-hover:opacity-100 pointer-events-none'
          }`}
        >
          <div className="pointer-events-auto">
            {isMissing ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAction();
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs tracking-wider uppercase shadow-lg shadow-amber-500/30 transition-all hover:scale-105 active:scale-95"
              >
                <FolderSearch className="w-4 h-4" />
                <span>Locate</span>
              </button>
            ) : isAvailable ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAction();
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-zinc-950 font-bold text-xs tracking-wider uppercase shadow-lg shadow-sky-500/30 transition-all hover:scale-105 active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>Install</span>
              </button>
            ) : (
              <PlayButton
                label="PLAY"
                size="md"
                onPlay={(e) => {
                  e.stopPropagation();
                  handleAction();
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
          {renderCardSize()}
        </div>
      </div>

      {/* Card Info Section */}
      <div className="p-3.5 flex flex-col flex-1 justify-between gap-1.5 bg-surface-850 rounded-b-2xl relative z-20">
        <div>
          <div className="flex items-start justify-between gap-2 relative">
            <h3
              title={game.name}
              className={`font-semibold text-sm transition-colors line-clamp-1 ${
                isMissing
                  ? isFocused
                    ? 'text-amber-300'
                    : 'text-zinc-300 group-hover:text-amber-300'
                  : isFocused
                  ? 'text-teal-300'
                  : 'text-zinc-100 group-hover:text-teal-300'
              }`}
            >
              {game.name}
            </h3>

            <div className="relative">
              <button
                ref={menuButtonRef}
                type="button"
                onClick={handleToggleMenu}
                className="text-zinc-500 hover:text-zinc-300 p-0.5 rounded transition-colors cursor-pointer"
                title="More Options"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {/* Context Dropdown Menu */}
              {menuOpen &&
                createPortal(
                  <div
                    ref={menuRef}
                    style={{
                      position: 'fixed',
                      bottom: menuPos.bottom,
                      top: menuPos.top,
                      right: menuPos.right,
                      zIndex: 9999,
                      transform: 'none',
                    }}
                    className="w-48 rounded-xl bg-[#18181b] border border-zinc-700 shadow-2xl py-1.5 text-[13px] text-zinc-100 antialiased select-none"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* 1. View Details */}
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onClick?.(game);
                      }}
                      className="w-full text-left px-3 py-2 text-zinc-100 hover:bg-zinc-800 flex items-center gap-2.5 transition-colors cursor-pointer font-medium"
                    >
                      <Info className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                      <span>View Details</span>
                    </button>

                    {/* Multi-account selector if multiple ownerships exist */}
                    {game.ownerships && game.ownerships.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          setShowAccountPicker(true);
                        }}
                        className="w-full text-left px-3 py-2 text-teal-300 hover:bg-teal-500/20 flex items-center gap-2.5 font-medium transition-colors cursor-pointer"
                      >
                        <User className="w-3.5 h-3.5 shrink-0" />
                        <span>Select Account...</span>
                      </button>
                    )}

                    {/* 2. Play, Install or Locate */}
                    {isMissing ? (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onLocate?.(game);
                        }}
                        className="w-full text-left px-3 py-2 text-amber-300 hover:bg-amber-500/20 flex items-center gap-2.5 font-medium transition-colors cursor-pointer"
                      >
                        <FolderSearch className="w-3.5 h-3.5 shrink-0" />
                        <span>Locate Game...</span>
                      </button>
                    ) : isAvailable ? (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          handleAction();
                        }}
                        className="w-full text-left px-3 py-2 text-sky-400 hover:bg-sky-500/20 flex items-center gap-2.5 font-medium transition-colors cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 shrink-0" />
                        <span>Install Game</span>
                      </button>
                    ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onLaunch?.(game);
                        }}
                        className="w-full text-left px-3 py-2 text-zinc-100 hover:bg-zinc-800 flex items-center gap-2.5 transition-colors cursor-pointer font-medium"
                      >
                        <Play className="w-3.5 h-3.5 text-teal-400 fill-teal-400/40 shrink-0" />
                        <span>Play Game</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          window.gameHub?.games?.openFolder(game.id);
                        }}
                        className="w-full text-left px-3 py-2 text-zinc-100 hover:bg-zinc-800 flex items-center gap-2.5 transition-colors cursor-pointer font-medium"
                      >
                        <FolderOpen className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <span>Open Folder</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onLocate?.(game);
                        }}
                        className="w-full text-left px-3 py-2 text-zinc-100 hover:bg-zinc-800 flex items-center gap-2.5 transition-colors cursor-pointer font-medium"
                      >
                        <Compass className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
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
                    className="w-full text-left px-3 py-2 text-zinc-100 hover:bg-zinc-800 flex items-center gap-2.5 transition-colors cursor-pointer font-medium"
                  >
                    <Star
                      className={`w-3.5 h-3.5 shrink-0 ${
                        game.isFavorite ? 'text-amber-400 fill-amber-400' : 'text-zinc-400'
                      }`}
                    />
                    <span>{game.isFavorite ? 'Unfavorite' : 'Add to Favorites'}</span>
                  </button>

                  {/* 4. Hide Game */}
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onHide?.(game);
                    }}
                    className="w-full text-left px-3 py-2 text-zinc-300 hover:text-white hover:bg-zinc-800 flex items-center gap-2.5 transition-colors cursor-pointer font-medium"
                  >
                    <EyeOff className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span>Hide Game</span>
                  </button>

                  <div className="my-1 border-t border-zinc-700/60" />

                  {/* 5. Remove */}
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onRemove?.(game);
                    }}
                    className="w-full text-left px-3 py-2 text-rose-400 hover:bg-rose-500/20 flex items-center gap-2.5 transition-colors cursor-pointer font-medium"
                  >
                    <Trash2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Remove from Library</span>
                  </button>
                </div>,
                document.body
              )}
          </div>
        </div>

        {/* Multi-Account or Family Ownership Pills */}
        {displayOwnerships.length > 0 &&
          (displayOwnerships.length > 1 ||
            (game.launcher === 'STEAM' &&
              displayOwnerships.some(
                (o) =>
                  o.accountDisplayName !== 'Steam' &&
                  o.accountDisplayName !== 'STEAM'
              ))) && (
            <div className="flex flex-wrap gap-1 mt-1">
              {displayOwnerships.map((o) => (
                <span
                  key={o.launcherGameEntryId}
                  className={`px-1.5 py-0.5 rounded text-[9px] font-mono border ${
                    o.isInstalled
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-zinc-800/80 text-zinc-300 border-zinc-700/50'
                  }`}
                  title={`${o.launcher} (${o.accountDisplayName}): ${o.status}`}
                >
                  {o.launcher} • {o.accountDisplayName}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-zinc-400 pt-1 border-t border-zinc-800/60">
          <span className="text-[11px] text-zinc-500 line-clamp-1">{game.genre || 'Game'}</span>
          <span className="inline-flex items-center gap-1 text-[11px] text-zinc-400 font-mono">
            <Clock className="w-3 h-3 text-zinc-500" />
            {formatPlayTime(game.totalPlayTime)}
          </span>
        </div>
      </div>

      {/* Account Picker Modal for Multi-Account Choices */}
      {showAccountPicker &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
            onClick={(e) => {
              e.stopPropagation();
              setShowAccountPicker(false);
            }}
          >
            <div
              className="w-full max-w-sm rounded-2xl bg-zinc-900 border border-zinc-700 p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div>
                  <h4 className="font-bold text-white text-sm">Select Account</h4>
                  <p className="text-xs text-zinc-400 line-clamp-1">{game.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAccountPicker(false)}
                  className="text-zinc-500 hover:text-zinc-300 p-1"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-2">
                {game.ownerships?.map((o) => (
                  <div
                    key={o.launcherGameEntryId}
                    className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/60 border border-zinc-700/50 hover:border-zinc-500 transition-all"
                  >
                    <div>
                      <div className="text-xs font-bold text-zinc-200">
                        {o.launcher} — {o.accountDisplayName}
                      </div>
                      <div className="text-[11px] font-mono text-zinc-400">
                        {o.isInstalled ? 'Installed locally' : 'Available in library'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAccountPicker(false);
                        if (o.isInstalled) {
                          onLaunch?.(game, o.launcherAccountId);
                        } else {
                          onInstall?.(game, o.launcherAccountId, o.externalGameId);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider uppercase transition-all shadow-md ${
                        o.isInstalled
                          ? 'bg-teal-500 hover:bg-teal-400 text-zinc-950 shadow-teal-500/20'
                          : 'bg-sky-500 hover:bg-sky-400 text-zinc-950 shadow-sky-500/20'
                      }`}
                    >
                      {o.isInstalled ? 'Play' : 'Install'}
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setShowAccountPicker(false)}
                className="w-full py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
});

