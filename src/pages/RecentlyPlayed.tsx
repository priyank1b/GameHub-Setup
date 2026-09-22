import React from 'react';
import { Game } from '../types/Game';
import { PlayButton } from '../components/PlayButton';
import { LauncherBadge } from '../components/LauncherBadge';
import { Clock, Calendar, Play, HardDrive, Gamepad2, AlertTriangle, FolderSearch } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';
import { PageRoute } from '../types/Navigation';
import { FocusableItem } from '../components/FocusableItem';
import { formatImageUrl } from '../utils/formatImage';

interface RecentlyPlayedProps {
  games: Game[];
  onLaunch: (game: Game) => void;
  onNavigate?: (page: PageRoute) => void;
  onSelectGame?: (game: Game) => void;
  onLocate?: (game: Game) => void;
}

export const RecentlyPlayed: React.FC<RecentlyPlayedProps> = ({
  games,
  onLaunch,
  onNavigate,
  onSelectGame,
  onLocate,
}) => {
  const recentGames = games.filter((g) => g.lastPlayedAt);

  const formatPlayTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours === 0) {
      return `${minutes}m`;
    }
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-surface-850 border border-zinc-800/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white font-['Outfit']">Play Activity & History</h2>
            <p className="text-xs text-zinc-400">
              Track your recent sessions, accumulated hours, and last launched games.
            </p>
          </div>
        </div>
        <span className="text-xs font-mono px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300">
          {recentGames.length} Recorded Sessions
        </span>
      </div>

      {/* List of Recently Played Games */}
      {recentGames.length > 0 ? (
        <div className="space-y-3">
          {recentGames.map((game, index) => (
            <FocusableItem
              key={game.id}
              id={`recent-game-${game.id}`}
              scope="main"
              group="recently-played"
              onConfirm={() => (game.isInstalled ? onLaunch(game) : (onLocate ? onLocate(game) : onSelectGame?.(game)))}
            >
              {({ ref, isFocused }) => (
                <div
                  ref={ref}
                  onClick={() => onSelectGame?.(game)}
                  className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-surface-850 border transition-all hover:bg-zinc-800/40 cursor-pointer ${
                    isFocused
                      ? !game.isInstalled
                        ? 'controller-focus border-amber-500'
                        : 'controller-focus border-teal-500'
                      : !game.isInstalled
                      ? 'border-amber-500/30 hover:border-amber-400/60'
                      : 'border-zinc-800/80 hover:border-teal-500/40'
                  }`}
                >
                  {/* Left Info with Thumbnail */}
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-20 rounded-xl overflow-hidden bg-zinc-900 flex-shrink-0 border border-zinc-800">
                      {game.coverImage ? (
                        <img
                          src={formatImageUrl(game.coverImage)}
                          alt={game.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-600">
                          <Gamepad2 className="w-6 h-6" />
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-white font-['Outfit']">{game.name}</h3>
                        <LauncherBadge launcher={game.launcher} size="sm" />
                        {!game.isInstalled && (
                          <span className="inline-flex items-center gap-1 bg-amber-500/90 text-zinc-950 font-bold px-1.5 py-0.5 rounded text-[10px] tracking-wider uppercase shadow-sm">
                            <AlertTriangle className="w-3 h-3 text-zinc-950" />
                            Missing
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-zinc-400">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-zinc-400" />
                          {game.lastPlayedAt}
                        </span>
                        <span>&bull;</span>
                        <span className="inline-flex items-center gap-1 text-teal-400">
                          <Clock className="w-3 h-3" />
                          {formatPlayTime(game.totalPlayTime)} total
                        </span>
                        {game.drive && (
                          <>
                            <span>&bull;</span>
                            <span className="inline-flex items-center gap-1 text-zinc-400">
                              <HardDrive className="w-3 h-3" />
                              {game.drive}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Quick Action: Play or Locate */}
                  <div className="self-end sm:self-center">
                    {!game.isInstalled ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onLocate?.(game);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs tracking-wider uppercase shadow-md shadow-amber-500/20 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                      >
                        <FolderSearch className="w-3.5 h-3.5" />
                        <span>Locate</span>
                      </button>
                    ) : (
                      <PlayButton
                        label="PLAY NOW"
                        size="sm"
                        onPlay={() => onLaunch(game)}
                      />
                    )}
                  </div>
                </div>
              )}
            </FocusableItem>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Clock}
          title="No Recent Sessions"
          description="Launch any game from your library to start tracking your gameplay hours, sessions, and history."
          actionLabel="Go to Library"
          onAction={() => onNavigate?.('library')}
        />
      )}
    </div>
  );
};
