import React from 'react';
import { Game } from '../types/Game';
import { GameGrid } from '../components/GameGrid';
import { PlayButton } from '../components/PlayButton';
import { Sparkles, Clock, Gamepad2, Layers, HardDrive, Database, AlertTriangle, FolderSearch } from 'lucide-react';
import { PageRoute } from '../types/Navigation';
import { FocusableItem } from '../components/FocusableItem';
import { formatImageUrl } from '../utils/formatImage';

interface HomeProps {
  games: Game[];
  onToggleFavorite: (id: number) => void;
  onLaunch: (game: Game) => void;
  onNavigate: (page: PageRoute) => void;
  onSelectGame?: (game: Game) => void;
  onFocusGame?: (game: Game) => void;
  onLocate?: (game: Game) => void;
  onRemove?: (game: Game) => void;
  onHide?: (game: Game) => void;
}

export const Home: React.FC<HomeProps> = ({
  games,
  onToggleFavorite,
  onLaunch,
  onNavigate,
  onSelectGame,
  onFocusGame,
  onLocate,
  onRemove,
  onHide,
}) => {
  const [driveCount, setDriveCount] = React.useState<number>(5);

  React.useEffect(() => {
    async function fetchDriveCount() {
      if (window.gameHub?.drives) {
        try {
          const drives = await window.gameHub.drives.getAvailable();
          if (drives && drives.length > 0) {
            setDriveCount(drives.filter((d) => d.isIncluded).length || drives.length);
            return;
          }
        } catch {}
      }
      try {
        const res = await fetch('/api/drives');
        if (res.ok) {
          const drives = await res.json();
          if (Array.isArray(drives) && drives.length > 0) {
            setDriveCount(drives.length);
          }
        }
      } catch {}
    }
    fetchDriveCount();
  }, []);

  const totalPlaySeconds = games.reduce((acc, g) => acc + (g.totalPlayTime || 0), 0);
  const playTimeDisplay =
    totalPlaySeconds >= 3600
      ? `${(totalPlaySeconds / 3600).toFixed(1)} hrs`
      : totalPlaySeconds > 0
      ? `${Math.ceil(totalPlaySeconds / 60)} mins`
      : '0 hrs';

  const totalSizeBytes = games.reduce((acc, g) => acc + (g.installSizeBytes ?? g.installedSize ?? 0), 0);
  const totalStorageDisplay =
    totalSizeBytes >= 1024 * 1024 * 1024 * 1024
      ? `${(totalSizeBytes / (1024 * 1024 * 1024 * 1024)).toFixed(2)} TB`
      : totalSizeBytes > 0
      ? `${(totalSizeBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
      : '0 GB';

  const installedGames = games.filter((g) => g.isInstalled);
  const missingGamesCount = games.length - installedGames.length;

  const featuredGame =
    installedGames.find((g) => g.lastPlayedAt) ||
    installedGames.find((g) => g.isFavorite) ||
    installedGames[0] ||
    games.find((g) => g.lastPlayedAt) ||
    games[0] ||
    null;

  const recentGames = games
    .filter((g) => Boolean(g.lastPlayedAt))
    .sort((a, b) => new Date(b.lastPlayedAt!).getTime() - new Date(a.lastPlayedAt!).getTime())
    .slice(0, 4);

  return (
    <div className="space-y-10 pb-12">
      {/* Hero Banner with Featured / Last Played Title */}
      {featuredGame && (
        <div className="relative rounded-3xl overflow-hidden border border-zinc-800 bg-surface-850 shadow-2xl">
          <div className="absolute inset-0 z-0">
            <img
              src={formatImageUrl(featuredGame.backgroundImage || featuredGame.coverImage)}
              alt={featuredGame.name}
              className="w-full h-full object-cover object-center filter blur-sm scale-105 opacity-30"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-surface-900 via-surface-900/80 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-surface-900 via-transparent to-transparent" />
          </div>

          <div className="relative z-10 p-8 sm:p-10 max-w-2xl space-y-4">
            {featuredGame.isInstalled ? (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-semibold tracking-wide">
                <Sparkles className="w-3.5 h-3.5" />
                <span>READY TO PLAY</span>
              </div>
            ) : (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold tracking-wide">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>FILE MOVED OR MISSING</span>
              </div>
            )}

            <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight font-['Outfit']">
              {featuredGame.name}
            </h1>

            <p className="text-sm text-zinc-300 line-clamp-2 max-w-xl">
              {featuredGame.description || 'Jump back into your adventure right where you left off.'}
            </p>

            <div className="pt-2 flex items-center gap-4">
              <FocusableItem
                id="hero-resume-game"
                scope="main"
                group="hero"
                onConfirm={() =>
                  featuredGame.isInstalled
                    ? onLaunch(featuredGame)
                    : onLocate
                    ? onLocate(featuredGame)
                    : onSelectGame?.(featuredGame)
                }
              >
                {({ ref, isFocused }) => (
                  <div ref={ref} className={isFocused ? 'controller-focus rounded-xl' : ''}>
                    {featuredGame.isInstalled ? (
                      <PlayButton
                        label="RESUME GAME"
                        size="lg"
                        onPlay={() => onLaunch(featuredGame)}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          onLocate ? onLocate(featuredGame) : onSelectGame?.(featuredGame)
                        }
                        className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-sm tracking-wider uppercase shadow-lg shadow-amber-500/30 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                      >
                        <FolderSearch className="w-5 h-5" />
                        <span>LOCATE GAME</span>
                      </button>
                    )}
                  </div>
                )}
              </FocusableItem>

              <FocusableItem
                id="hero-browse-library"
                scope="main"
                group="hero"
                onConfirm={() => onNavigate('library')}
              >
                {({ ref, isFocused }) => (
                  <button
                    ref={ref}
                    type="button"
                    onClick={() => onNavigate('library')}
                    className={`px-5 py-3 rounded-xl bg-surface-800/80 hover:bg-zinc-700 text-sm font-semibold text-zinc-200 hover:text-white transition-all border border-zinc-700/60 ${
                      isFocused ? 'controller-focus' : ''
                    }`}
                  >
                    Browse Library
                  </button>
                )}
              </FocusableItem>
            </div>
          </div>
        </div>
      )}

      {/* Quick Overview Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Installed Games */}
        <div className="p-5 rounded-2xl bg-surface-850 border border-zinc-800/80 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
            <Gamepad2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-zinc-400 uppercase tracking-wider font-medium">Installed Games</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold text-white font-['Outfit']">{installedGames.length}</p>
              {missingGamesCount > 0 && (
                <span className="text-[11px] font-medium text-amber-400 font-mono">
                  ({missingGamesCount} missing)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Total Playtime */}
        <div className="p-5 rounded-2xl bg-surface-850 border border-zinc-800/80 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-zinc-400 uppercase tracking-wider font-medium">Total Playtime</p>
            <p className="text-2xl font-bold text-white font-['Outfit']">{playTimeDisplay}</p>
          </div>
        </div>

        {/* Storage Utilized */}
        <div className="p-5 rounded-2xl bg-surface-850 border border-zinc-800/80 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-zinc-400 uppercase tracking-wider font-medium">Storage Utilized</p>
            <p className="text-2xl font-bold text-white font-['Outfit']">{totalStorageDisplay}</p>
          </div>
        </div>

        {/* Drives Detected */}
        <div className="p-5 rounded-2xl bg-surface-850 border border-zinc-800/80 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <HardDrive className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-zinc-400 uppercase tracking-wider font-medium">Drives Detected</p>
            <p className="text-2xl font-bold text-white font-['Outfit']">{driveCount} Drives Active</p>
          </div>
        </div>
      </div>

      {/* Recently Played Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-teal-400" />
            <h2 className="text-xl font-bold text-white font-['Outfit']">Recently Played</h2>
          </div>
          {recentGames.length > 0 && (
            <button
              type="button"
              onClick={() => onNavigate('recently-played')}
              className="text-xs font-semibold text-teal-400 hover:text-teal-300 transition-colors"
            >
              View All &rarr;
            </button>
          )}
        </div>

        {recentGames.length > 0 ? (
          <GameGrid
            games={recentGames}
            onToggleFavorite={onToggleFavorite}
            onLaunch={onLaunch}
            onSelectGame={onSelectGame}
            onFocusGame={onFocusGame}
            onLocate={onLocate}
            onRemove={onRemove}
            onHide={onHide}
          />
        ) : (
          <div className="p-8 rounded-2xl bg-surface-850/60 border border-zinc-800/80 text-center flex flex-col items-center justify-center space-y-2">
            <div className="p-3 rounded-full bg-zinc-800/60 text-zinc-500 mb-1">
              <Clock className="w-5 h-5" />
            </div>
            <p className="text-sm font-medium text-zinc-300">No Recently Played Games</p>
            <p className="text-xs text-zinc-500 max-w-sm">
              Launch a game from your library to start tracking your recent sessions.
            </p>
          </div>
        )}
      </section>

      {/* All Games Preview Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-teal-400" />
            <h2 className="text-xl font-bold text-white font-['Outfit']">All Games</h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('library')}
            className="text-xs font-semibold text-teal-400 hover:text-teal-300 transition-colors"
          >
            Open Library &rarr;
          </button>
        </div>

        <GameGrid
          games={games}
          onToggleFavorite={onToggleFavorite}
          onLaunch={onLaunch}
          onSelectGame={onSelectGame}
          onFocusGame={onFocusGame}
          onLocate={onLocate}
          onRemove={onRemove}
          onHide={onHide}
        />
      </section>
    </div>
  );
};
