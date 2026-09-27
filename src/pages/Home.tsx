import React, { useState, useMemo } from 'react';
import { Game } from '../types/Game';
import { GameGrid } from '../components/GameGrid';
import { PlayButton } from '../components/PlayButton';
import {
  Sparkles,
  Clock,
  Layers,
  AlertTriangle,
  FolderSearch,
  Download,
  HardDrive,
} from 'lucide-react';
import { PageRoute, LibraryFilter } from '../types/Navigation';
import { FocusableItem } from '../components/FocusableItem';
import { formatImageUrl } from '../utils/formatImage';

interface HomeProps {
  games: Game[];
  onToggleFavorite: (id: number) => void;
  onLaunch: (game: Game) => void;
  onInstall?: (game: Game, launcherAccountId?: number, externalGameId?: string) => void;
  onNavigate: (page: PageRoute, filter?: LibraryFilter) => void;
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
  onInstall,
  onNavigate,
  onSelectGame,
  onFocusGame,
  onLocate,
  onRemove,
  onHide,
}) => {
  // Default to INSTALLED so user sees ready-to-play games first
  const [homeFilter, setHomeFilter] = useState<'INSTALLED' | 'AVAILABLE' | 'ALL'>('INSTALLED');

  const installedGames = useMemo(() => games.filter((g) => g.isInstalled), [games]);

  const availableGames = useMemo(() => {
    return games.filter(
      (g) =>
        g.libraryStatus === 'AVAILABLE' ||
        (!g.isInstalled && (g.ownerships?.length ?? 0) > 0)
    );
  }, [games]);

  const displayedGames = useMemo(() => {
    if (homeFilter === 'INSTALLED') return installedGames;
    if (homeFilter === 'AVAILABLE') return availableGames;
    return games;
  }, [homeFilter, installedGames, availableGames, games]);

  // Prioritize installed games for the hero banner
  const featuredGame = useMemo(() => {
    return (
      installedGames.find((g) => g.lastPlayedAt) ||
      installedGames.find((g) => g.isFavorite) ||
      installedGames[0] ||
      availableGames[0] ||
      games[0] ||
      null
    );
  }, [installedGames, availableGames, games]);

  const isFeaturedAvailable = Boolean(
    featuredGame &&
      (featuredGame.libraryStatus === 'AVAILABLE' ||
        (!featuredGame.isInstalled && (featuredGame.ownerships?.length ?? 0) > 0))
  );

  const isFeaturedMissing = Boolean(
    featuredGame && !featuredGame.isInstalled && !isFeaturedAvailable
  );

  const recentGames = useMemo(() => {
    return games
      .filter((g) => Boolean(g.lastPlayedAt))
      .sort((a, b) => new Date(b.lastPlayedAt!).getTime() - new Date(a.lastPlayedAt!).getTime())
      .slice(0, 4);
  }, [games]);

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
            ) : isFeaturedAvailable ? (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-300 text-xs font-semibold tracking-wide">
                <Download className="w-3.5 h-3.5 text-sky-400" />
                <span>AVAILABLE TO INSTALL</span>
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
                onConfirm={() => {
                  if (featuredGame.isInstalled) {
                    onLaunch(featuredGame);
                  } else if (isFeaturedAvailable) {
                    const first = featuredGame.ownerships?.[0];
                    onInstall
                      ? onInstall(featuredGame, first?.launcherAccountId, first?.externalGameId)
                      : onSelectGame?.(featuredGame);
                  } else {
                    onLocate ? onLocate(featuredGame) : onSelectGame?.(featuredGame);
                  }
                }}
              >
                {({ ref, isFocused }) => (
                  <div ref={ref} className={isFocused ? 'controller-focus rounded-xl' : ''}>
                    {featuredGame.isInstalled ? (
                      <PlayButton
                        label="RESUME GAME"
                        size="lg"
                        onPlay={() => onLaunch(featuredGame)}
                      />
                    ) : isFeaturedAvailable ? (
                      <button
                        type="button"
                        onClick={() => {
                          const first = featuredGame.ownerships?.[0];
                          onInstall
                            ? onInstall(featuredGame, first?.launcherAccountId, first?.externalGameId)
                            : onSelectGame?.(featuredGame);
                        }}
                        className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-zinc-950 font-bold text-sm tracking-wider uppercase shadow-lg shadow-sky-500/30 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                      >
                        <Download className="w-5 h-5" />
                        <span>INSTALL GAME</span>
                      </button>
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
                onConfirm={() => onNavigate('library', 'INSTALLED')}
              >
                {({ ref, isFocused }) => (
                  <button
                    ref={ref}
                    type="button"
                    onClick={() => onNavigate('library', 'INSTALLED')}
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
            onInstall={onInstall}
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

      {/* Main Games Section with Installed / Available / All Toggle */}
      <section className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/60 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white font-['Outfit']">Your Games</h2>
              <p className="text-xs text-zinc-400">
                {homeFilter === 'INSTALLED'
                  ? 'Showing installed titles ready to play'
                  : homeFilter === 'AVAILABLE'
                  ? 'Showing games ready to download & install'
                  : 'Showing your complete collection'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Filter Toggle Pills */}
            <div className="inline-flex p-1 rounded-xl bg-surface-900 border border-zinc-800">
              <button
                type="button"
                onClick={() => setHomeFilter('INSTALLED')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  homeFilter === 'INSTALLED'
                    ? 'bg-teal-500 text-zinc-950 shadow-md font-bold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <HardDrive className="w-3.5 h-3.5" />
                <span>Installed</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                    homeFilter === 'INSTALLED' ? 'bg-zinc-950/20 text-zinc-950' : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {installedGames.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setHomeFilter('AVAILABLE')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  homeFilter === 'AVAILABLE'
                    ? 'bg-sky-500 text-zinc-950 shadow-md font-bold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                <span>Available to Install</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                    homeFilter === 'AVAILABLE' ? 'bg-zinc-950/20 text-zinc-950' : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {availableGames.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setHomeFilter('ALL')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  homeFilter === 'ALL'
                    ? 'bg-zinc-700 text-white shadow-md font-bold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>All</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                    homeFilter === 'ALL' ? 'bg-zinc-950/30 text-white' : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {games.length}
                </span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('library', homeFilter)}
              className="text-xs font-semibold text-teal-400 hover:text-teal-300 transition-colors ml-1 cursor-pointer"
            >
              Open Library &rarr;
            </button>
          </div>
        </div>

        {displayedGames.length > 0 ? (
          <GameGrid
            games={displayedGames}
            initialBatch={24}
            batchSize={18}
            onToggleFavorite={onToggleFavorite}
            onLaunch={onLaunch}
            onInstall={onInstall}
            onSelectGame={onSelectGame}
            onFocusGame={onFocusGame}
            onLocate={onLocate}
            onRemove={onRemove}
            onHide={onHide}
          />
        ) : (
          <div className="p-12 rounded-2xl bg-surface-850/60 border border-zinc-800/80 text-center flex flex-col items-center justify-center space-y-3">
            <div className="p-4 rounded-full bg-zinc-800/60 text-zinc-500 mb-1">
              {homeFilter === 'INSTALLED' ? (
                <HardDrive className="w-6 h-6 text-teal-400/60" />
              ) : (
                <Download className="w-6 h-6 text-sky-400/60" />
              )}
            </div>
            <p className="text-base font-semibold text-zinc-200">
              {homeFilter === 'INSTALLED'
                ? 'No Installed Games Found'
                : 'No Games Available to Install'}
            </p>
            <p className="text-xs text-zinc-400 max-w-md">
              {homeFilter === 'INSTALLED'
                ? 'Select "Available to Install" to download games from your linked Epic Games or Steam accounts, or add a game manually.'
                : 'All your games are currently installed or no external accounts have pending games.'}
            </p>
            {homeFilter === 'INSTALLED' && availableGames.length > 0 && (
              <button
                type="button"
                onClick={() => setHomeFilter('AVAILABLE')}
                className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-300 hover:bg-sky-500/20 text-xs font-semibold transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>View {availableGames.length} Games Available to Install</span>
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
