import React from 'react';
import { Game } from '../types/Game';
import { PlayButton } from '../components/PlayButton';
import { LauncherBadge } from '../components/LauncherBadge';
import { Clock, Calendar, Play, HardDrive, Gamepad2, AlertTriangle } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';
import { PageRoute } from '../types/Navigation';
import { FocusableItem } from '../components/FocusableItem';
import { formatImageUrl } from '../utils/formatImage';

interface RecentlyPlayedProps {
  games: Game[];
  onLaunch: (game: Game) => void;
  onNavigate?: (page: PageRoute) => void;
}

export const RecentlyPlayed: React.FC<RecentlyPlayedProps> = ({
  games,
  onLaunch,
  onNavigate,
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
              onConfirm={() => onLaunch(game)}
            >
              {({ ref, isFocused }) => (
                <div
                  ref={ref}
                  className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-surface-850 border transition-all hover:bg-zinc-800/40 cursor-pointer ${
                    isFocused
                      ? 'controller-focus border-teal-500'
                      : 'border-zinc-800/80 hover:border-teal-500/40'
                  }`}
                  onClick={() => onLaunch(game)}
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

                  {/* Right Quick Play Button */}
                  <div className="self-end sm:self-center">
                    <PlayButton
                      label="PLAY NOW"
                      size="sm"
                      onPlay={() => onLaunch(game)}
                    />
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
