import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { Home } from './pages/Home';
import { Library } from './pages/Library';
import { Favorites } from './pages/Favorites';
import { RecentlyPlayed } from './pages/RecentlyPlayed';
import { Drives } from './pages/Drives';
import { Settings } from './pages/Settings';
import { Help } from './pages/Help';
import { AddGameModal } from './components/AddGameModal';
import { GameDetailsModal } from './components/GameDetailsModal';
import { ConfirmModal, ConfirmModalType } from './components/ConfirmModal';
import { AccountManagerModal } from './components/AccountManagerModal';
import { Game } from './types/Game';
import { PageRoute, LibraryFilter } from './types/Navigation';
import { LauncherAccount } from './types/LauncherAccount';
import { useNavigation } from './context/NavigationContext';
import { ControllerManager } from './controllers/ControllerManager';
import { Loader2, Gamepad2 } from 'lucide-react';

export const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<PageRoute>('home');
  const [currentFilter, setCurrentFilter] = useState<LibraryFilter>('INSTALLED');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [games, setGames] = useState<Game[]>([]);
  const [accounts, setAccounts] = useState<LauncherAccount[]>([]);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [focusedGame, setFocusedGame] = useState<Game | null>(null);
  const [isDbLoaded, setIsDbLoaded] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const isScanningRef = useRef<boolean>(false);
  const isLocatingRef = useRef<boolean>(false);
  const [launchMessage, setLaunchMessage] = useState<string | null>(null);
  const [isAddGameOpen, setIsAddGameOpen] = useState<boolean>(false);
  const [isAccountManagerOpen, setIsAccountManagerOpen] = useState<boolean>(false);

  // Custom UI alert & confirm dialog state
  const [confirmModalState, setConfirmModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    subMessage?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    type?: ConfirmModalType;
    icon?: 'trash' | 'eye-off' | 'alert' | 'info';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Intercept window.alert so all popups match our custom sleek dark theme
  useEffect(() => {
    const originalAlert = window.alert;
    window.alert = (msg?: any) => {
      setConfirmModalState({
        isOpen: true,
        title: 'Alert',
        message: String(msg ?? ''),
        confirmLabel: 'OK',
        cancelLabel: 'Dismiss',
        type: 'info',
        icon: 'info',
        onConfirm: () => setConfirmModalState((prev) => ({ ...prev, isOpen: false })),
      });
    };
    return () => {
      window.alert = originalAlert;
    };
  }, []);

  const { setOnTabChange } = useNavigation();

  // Cycle navigation pages with controller bumpers (LB / RB)
  useEffect(() => {
    const pages: PageRoute[] = ['home', 'library', 'favorites', 'recently-played', 'drives', 'help', 'settings'];
    setOnTabChange((direction) => {
      setCurrentPage((prev) => {
        const idx = pages.indexOf(prev);
        if (idx === -1) return 'home';
        const nextIdx =
          direction === 'NEXT'
            ? (idx + 1) % pages.length
            : (idx - 1 + pages.length) % pages.length;
        return pages[nextIdx];
      });
    });
  }, [setOnTabChange]);

  // Load games from SQLite via IPC
  const loadGames = useCallback(async () => {
    if (window.gameHub?.games) {
      try {
        const dbGames = await window.gameHub.games.getAll();
        setGames(dbGames);
        setIsDbLoaded(true);
        // Asynchronously check for missing or restored games against active drives after initial load
        if (window.gameHub.games.checkMissing) {
          setTimeout(() => {
            window.gameHub?.games?.checkMissing?.().then((res) => {
              if (res.success && ((res.missingCount && res.missingCount > 0) || (res.restoredCount && res.restoredCount > 0))) {
                window.gameHub!.games.getAll().then((refreshed) => setGames(refreshed));
              }
            }).catch(() => {});
          }, 1500);
        }
      } catch (err: any) {
        console.error('[App] Failed to load games from IPC:', err.message);
        setGames([]);
        setIsDbLoaded(true);
      }
    } else {
      // Standalone browser preview without mock data
      setGames([]);
      setIsDbLoaded(true);
    }
  }, []);

  // Load connected launcher accounts from IPC
  const loadAccounts = useCallback(async () => {
    if (window.gameHub?.accounts?.getAll) {
      try {
        const accs = await window.gameHub.accounts.getAll();
        setAccounts(accs || []);
      } catch (err: any) {
        console.error('[App] Failed to load accounts:', err.message);
      }
    }
  }, []);

  useEffect(() => {
    loadGames();
    loadAccounts();
  }, [loadGames, loadAccounts]);

  // Listen to live GameScanner progress events from IPC
  useEffect(() => {
    if (window.gameHub?.scanner?.onProgress) {
      const unsubscribe = window.gameHub.scanner.onProgress((progress) => {
        if (
          progress.stage === 'detecting' ||
          progress.stage === 'drives' ||
          progress.stage === 'initializing' ||
          progress.stage === 'deduplicating' ||
          progress.stage === 'database_sync'
        ) {
          isScanningRef.current = true;
          setIsScanning(true);
          setLaunchMessage(`[${progress.percent}%] ${progress.message}`);
        } else if (progress.stage === 'complete') {
          isScanningRef.current = false;
          setIsScanning(false);
          loadGames();
          setLaunchMessage(progress.message);
          setTimeout(() => setLaunchMessage(null), 4000);
        } else if (progress.stage === 'cancelled' || progress.stage === 'error') {
          isScanningRef.current = false;
          setIsScanning(false);
          setLaunchMessage(progress.stage === 'cancelled' ? 'Scan was cancelled.' : progress.message);
          setTimeout(() => setLaunchMessage(null), 3000);
        }
      });
      return unsubscribe;
    }
  }, [loadGames]);

  // Listen for auto-rescan discoveries or missing games updates to refresh library reactively
  useEffect(() => {
    if (window.gameHub?.scanner?.onNewGamesDiscovered) {
      const unsubscribe = window.gameHub.scanner.onNewGamesDiscovered((data: any) => {
        console.log('[App] Auto-rescan update received:', data);
        loadGames();
        if (data?.count > 0) {
          setLaunchMessage(`Auto-rescan: ${data.count} new game(s) discovered!`);
          setTimeout(() => setLaunchMessage(null), 4000);
        } else if (data?.missingCount && data.missingCount > 0) {
          setLaunchMessage(`Auto-rescan: ${data.missingCount} missing game(s) updated.`);
          setTimeout(() => setLaunchMessage(null), 4000);
        }
      });
      return unsubscribe;
    }
  }, [loadGames]);

  // Listen for window restoration from system tray to ensure UI responsiveness
  useEffect(() => {
    if (window.gameHub?.window?.onRestored) {
      const unsubscribe = window.gameHub.window.onRestored(() => {
        ControllerManager.getInstance().resume();
      });
      return unsubscribe;
    }
  }, []);



  const handleToggleFavorite = async (id: number) => {
    // Optimistic UI update
    setGames((prev) =>
      prev.map((g) => (g.id === id ? { ...g, isFavorite: !g.isFavorite } : g))
    );
    if (selectedGame && selectedGame.id === id) {
      setSelectedGame((prev) => (prev ? { ...prev, isFavorite: !prev.isFavorite } : null));
    }

    // Persist to SQLite database via IPC
    if (window.gameHub?.games) {
      try {
        await window.gameHub.games.toggleFavorite(id);
      } catch (err: any) {
        console.error('[App] Failed to persist favorite via IPC:', err.message);
      }
    }
  };

  const handleLocateGame = async (game: Game) => {
    if (!window.gameHub || isLocatingRef.current) return;
    isLocatingRef.current = true;

    try {
      if (!window.gameHub.dialog?.selectExecutable) return;

      const fileRes = await window.gameHub.dialog.selectExecutable();
      if (!fileRes?.filePath) {
        // User closed or cancelled the dialog - return cleanly without opening a second window
        return;
      }

      const res = await window.gameHub.games.locate(game.id, fileRes.filePath);
      if (res.success && res.game) {
        const updatedGame = res.game;
        setGames((prev) => prev.map((g) => (g.id === game.id ? updatedGame : g)));
        if (selectedGame?.id === game.id) {
          setSelectedGame(updatedGame);
        }
        setLaunchMessage(`"${game.name}" successfully relocated and restored!`);
        setTimeout(() => setLaunchMessage(null), 4000);
      } else {
        setLaunchMessage(`Failed to relocate game: ${res.error || 'Unknown error'}`);
        setTimeout(() => setLaunchMessage(null), 4000);
      }
    } catch (err: any) {
      console.error('[App] Locate game error:', err.message);
      setLaunchMessage(`Locate error: ${err.message}`);
      setTimeout(() => setLaunchMessage(null), 4000);
    } finally {
      isLocatingRef.current = false;
    }
  };

  const handleRemoveGame = (game: Game) => {
    if (!window.gameHub) return;

    setConfirmModalState({
      isOpen: true,
      title: 'Remove from Library',
      message: `Are you sure you want to remove "${game.name}" from your library?`,
      subMessage: 'This will remove the game record from your launcher, but will NOT delete any actual game files or save data from your disk.',
      confirmLabel: 'Remove Game',
      cancelLabel: 'Cancel',
      type: 'danger',
      icon: 'trash',
      onConfirm: async () => {
        setConfirmModalState((prev) => ({ ...prev, isOpen: false }));
        try {
          const removed = await window.gameHub?.games.remove(game.id);
          if (removed) {
            setGames((prev) => prev.filter((g) => g.id !== game.id));
            if (selectedGame?.id === game.id) {
              setSelectedGame(null);
            }
            setLaunchMessage(`"${game.name}" removed from library.`);
            setTimeout(() => setLaunchMessage(null), 3000);
          }
        } catch (err: any) {
          console.error('[App] Remove game error:', err.message);
          setLaunchMessage(`Failed to remove: ${err.message}`);
          setTimeout(() => setLaunchMessage(null), 3000);
        }
      },
    });
  };

  const handleHideGame = (game: Game) => {
    setConfirmModalState({
      isOpen: true,
      title: `Hide "${game.name}"?`,
      message: `Are you sure you want to hide this game from your library?`,
      subMessage: `It will be removed from your library and excluded from future automatic and manual rescans.\n\nYou can restore it at any time in Settings > Library & Folders > Hidden & Excluded Games.`,
      confirmLabel: 'Hide Game',
      cancelLabel: 'Cancel',
      type: 'warning',
      icon: 'eye-off',
      onConfirm: async () => {
        setConfirmModalState((prev) => ({ ...prev, isOpen: false }));
        try {
          if (window.gameHub?.games?.hide) {
            await window.gameHub.games.hide(game.id);
          }
          setGames((prev) => prev.filter((g) => g.id !== game.id));
          if (selectedGame?.id === game.id) {
            setSelectedGame(null);
          }
          setLaunchMessage(`"${game.name}" hidden and excluded from future rescans.`);
          setTimeout(() => setLaunchMessage(null), 3500);
        } catch (err: any) {
          console.error('[App] Hide game error:', err.message);
          setLaunchMessage(`Failed to hide: ${err.message}`);
          setTimeout(() => setLaunchMessage(null), 3000);
        }
      },
    });
  };

  const handleInstallGame = async (
    game: Game,
    launcherAccountId?: number,
    externalGameId?: string
  ) => {
    try {
      setLaunchMessage(`Handing off installation of "${game.name}" to official launcher...`);
      const targetAccountId =
        launcherAccountId || game.ownerships?.[0]?.launcherAccountId;
      const targetExternalId =
        externalGameId ||
        game.ownerships?.[0]?.externalGameId ||
        game.launcherAppId;

      if (!targetAccountId || !targetExternalId) {
        setLaunchMessage(`Cannot install: Missing account or game ID.`);
        setTimeout(() => setLaunchMessage(null), 3000);
        return;
      }

      if (window.gameHub?.canonical?.install) {
        const res = await window.gameHub.canonical.install(targetAccountId, targetExternalId);
        if (res.success) {
          setLaunchMessage(res.message || `Installation handoff dispatched to official launcher.`);
        } else {
          setLaunchMessage(`Install notice: ${res.error || 'Check official launcher'}`);
        }
      }
    } catch (err: any) {
      console.error('[App] Install handoff error:', err.message);
      setLaunchMessage(`Install failed: ${err.message}`);
    } finally {
      setTimeout(() => setLaunchMessage(null), 4000);
    }
  };

  const handleLaunch = async (game: Game, launcherAccountId?: number) => {
    if (!game.isInstalled) {
      // If game is available in launcher account, trigger install handoff
      if (
        game.libraryStatus === 'AVAILABLE' ||
        (game.ownerships && game.ownerships.length > 0)
      ) {
        handleInstallGame(game, launcherAccountId);
        return;
      }
      // Prompt user to locate game instead of attempting doomed launch
      handleLocateGame(game);
      return;
    }

    const msg = `Launching ${game.name} via ${game.launcher}...`;
    setLaunchMessage(msg);

    // Suspend GameHub controller input so game receives full dedicated controller control
    ControllerManager.getInstance().suspend();

    if (window.gameHub?.canonical?.launch) {
      try {
        const result = await window.gameHub.canonical.launch(game.id, launcherAccountId);
        if (!result.success && window.gameHub.games?.launch) {
          await window.gameHub.games.launch(game.id);
        }
      } catch (err: any) {
        if (window.gameHub.games?.launch) {
          await window.gameHub.games.launch(game.id);
        }
      }
    } else if (window.gameHub?.games) {
      try {
        await window.gameHub.games.launch(game.id);
      } catch (err: any) {
        console.error('[App] Launch IPC error:', err.message);
      }
    }

    setTimeout(() => {
      setLaunchMessage(null);
    }, 3500);
  };

  const handleUpdateGame = (updatedGame: Game) => {
    setGames((prev) => prev.map((g) => (g.id === updatedGame.id ? updatedGame : g)));
    setSelectedGame(updatedGame);
  };

  const handleAddGame = async (newGame: Partial<Game>) => {
    const gamePayload = {
      name: newGame.name || 'Untitled Game',
      launcher: newGame.launcher || 'STANDALONE',
      executablePath: newGame.executablePath,
      installPath: newGame.installPath,
      coverImage: newGame.coverImage,
      backgroundImage: newGame.backgroundImage,
      description: newGame.description,
      developer: newGame.developer,
      publisher: newGame.publisher,
      genre: newGame.genre,
      isFavorite: false,
      isInstalled: true,
      isManual: true,
      totalPlayTime: 0,
      drive: newGame.drive || 'C:',
    };

    if (window.gameHub?.games) {
      try {
        const created = await window.gameHub.games.add(gamePayload as any);
        setGames((prev) => [created, ...prev]);
      } catch (err: any) {
        console.error('[App] Failed to add game via IPC:', err.message);
        const fallback: Game = { id: Date.now(), ...gamePayload } as Game;
        setGames((prev) => [fallback, ...prev]);
      }
    } else {
      const fallback: Game = { id: Date.now(), ...gamePayload } as Game;
      setGames((prev) => [fallback, ...prev]);
    }

    setCurrentPage('library');
  };

  const handleRescan = async () => {
    // Prevent multiple rapid clicks or starting manual scan during auto-scan
    if (isScanningRef.current || isScanning) {
      console.log('[App] Rescan ignored: scan already actively in progress.');
      return;
    }

    isScanningRef.current = true;
    setIsScanning(true);
    setLaunchMessage('Initializing GameScanner pipeline...');

    try {
      if (window.gameHub?.scanner) {
        const scanRes = await window.gameHub.scanner.start();
        const refreshed = await window.gameHub.games.getAll();
        setGames(refreshed);
        setLaunchMessage(
          scanRes.newGamesAdded > 0
            ? `Scan finished: Discovered and indexed ${scanRes.newGamesAdded} new game(s)!`
            : 'Scan complete. Library is up to date.'
        );
      } else if (window.gameHub?.games) {
        const scanRes = await window.gameHub.games.scan();
        const refreshed = await window.gameHub.games.getAll();
        setGames(refreshed);
        setLaunchMessage(
          scanRes.newGamesCount > 0
            ? `Scan finished: Added ${scanRes.newGamesCount} game(s)!`
            : 'Scan complete. Library is up to date.'
        );
      } else {
        setTimeout(() => {
          setLaunchMessage('Scan complete. Library is up to date.');
        }, 1200);
      }
    } catch (err: any) {
      console.error('[App] Scanner error:', err.message);
      setLaunchMessage('Scan encountered an error: ' + err.message);
    } finally {
      isScanningRef.current = false;
      setIsScanning(false);
      setTimeout(() => {
        setLaunchMessage(null);
      }, 4000);
    }
  };

  // Listen to System Tray events (e.g. Rescan, Recently Played navigation)
  useEffect(() => {
    const unsubNav = window.gameHub?.tray?.onNavigate?.((page) => {
      if (
        page === 'recently-played' ||
        page === 'library' ||
        page === 'home' ||
        page === 'favorites' ||
        page === 'drives' ||
        page === 'settings'
      ) {
        setCurrentPage(page as PageRoute);
      }
    });

    const unsubRescan = window.gameHub?.tray?.onRescan?.(() => {
      handleRescan();
    });

    return () => {
      unsubNav?.();
      unsubRescan?.();
    };
  }, []);

  // State reference for global keyboard shortcuts (Phase 30)
  const stateRef = useRef({
    selectedGame,
    isAddGameOpen,
    focusedGame,
    searchQuery,
    games,
    currentPage,
    handleLaunch,
    handleRescan,
  });

  useEffect(() => {
    stateRef.current = {
      selectedGame,
      isAddGameOpen,
      focusedGame,
      searchQuery,
      games,
      currentPage,
      handleLaunch,
      handleRescan,
    };
  });

  // Global Keyboard Shortcuts: Ctrl+K (Search), Ctrl+R (Rescan), Escape (Close Modal), Enter (Launch)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const {
        selectedGame,
        isAddGameOpen,
        focusedGame,
        searchQuery,
        games,
        currentPage,
        handleLaunch,
        handleRescan,
      } = stateRef.current;

      // Ctrl + K / Cmd + K: Focus global search
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (currentPage !== 'library' && currentPage !== 'home') {
          setCurrentPage('library');
        }
        const searchInput = document.getElementById('global-search-input') as HTMLInputElement | null;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
        return;
      }

      // Ctrl + R / Cmd + R: Trigger library rescan (intercepts browser reload)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        handleRescan();
        return;
      }

      // Escape: Close active modal, cancel edit, or clear search
      if (e.key === 'Escape') {
        if (selectedGame) {
          e.preventDefault();
          setSelectedGame(null);
        } else if (isAddGameOpen) {
          e.preventDefault();
          setIsAddGameOpen(false);
        } else if (searchQuery) {
          e.preventDefault();
          setSearchQuery('');
        } else {
          const searchInput = document.getElementById('global-search-input');
          if (document.activeElement === searchInput) {
            searchInput?.blur();
          }
        }
        return;
      }

      // Enter: Launch selected game
      if (e.key === 'Enter') {
        const target = e.target as HTMLElement | null;
        const isEditingInput =
          target &&
          (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') &&
          target.id !== 'global-search-input';

        if (isEditingInput) {
          return; // Let user submit forms or newlines
        }

        // 1. If GameDetailsModal is currently open, launch that game
        if (selectedGame) {
          e.preventDefault();
          handleLaunch(selectedGame);
          return;
        }

        // 2. If focused on global search bar, launch top matching result
        if (target?.id === 'global-search-input' && searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const match = games.find(
            (g) =>
              g.name.toLowerCase().includes(q) ||
              g.developer?.toLowerCase().includes(q) ||
              g.publisher?.toLowerCase().includes(q) ||
              g.genre?.toLowerCase().includes(q)
          );
          if (match) {
            e.preventDefault();
            handleLaunch(match);
            return;
          }
        }

        // 3. If a game card was focused in the grid, launch it
        if (focusedGame) {
          e.preventDefault();
          handleLaunch(focusedGame);
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleNavigate = (page: PageRoute, filter?: LibraryFilter) => {
    setCurrentPage(page);
    if (filter) {
      setCurrentFilter(filter);
    }
  };

  // Memoized game counts for Sidebar badges (single O(N) pass instead of 9 separate iterations)
  const gameCounts = useMemo(() => {
    let installed = 0;
    let available = 0;
    let steam = 0;
    let epic = 0;
    let gog = 0;
    let xbox = 0;
    let ubisoft = 0;
    let standalone = 0;
    let favorites = 0;

    for (const g of games) {
      if (g.isInstalled) installed++;
      if (g.libraryStatus === 'AVAILABLE' || (!g.isInstalled && (g.ownerships?.length ?? 0) > 0)) available++;
      if (g.isFavorite) favorites++;
      switch (g.launcher) {
        case 'STEAM': steam++; break;
        case 'EPIC': epic++; break;
        case 'GOG': gog++; break;
        case 'XBOX': xbox++; break;
        case 'UBISOFT': ubisoft++; break;
        case 'STANDALONE': standalone++; break;
      }
    }

    return {
      total: games.length,
      installed,
      available,
      steam,
      epic,
      gog,
      xbox,
      ubisoft,
      standalone,
      favorites,
    };
  }, [games]);

  // Game counts per launcher account
  const accountGameCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const game of games) {
      if (game.ownerships && game.ownerships.length > 0) {
        for (const o of game.ownerships) {
          counts[o.accountDisplayName] = (counts[o.accountDisplayName] || 0) + 1;
        }
      } else if (game.launcher) {
        counts[game.launcher] = (counts[game.launcher] || 0) + 1;
      }
    }
    return counts;
  }, [games]);

  if (!isDbLoaded) {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-screen bg-surface-900 text-zinc-100 select-none overflow-hidden relative">
        {/* Subtle background ambient glows */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
          <div className="relative">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-teal-500/20 via-zinc-800 to-zinc-900 border border-teal-500/30 flex items-center justify-center shadow-2xl shadow-teal-500/20">
              <Gamepad2 className="w-10 h-10 text-teal-400 animate-pulse" />
            </div>
            <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-zinc-900 border border-zinc-700">
              <Loader2 className="w-4 h-4 text-teal-400 animate-spin" />
            </div>
          </div>

          <div className="space-y-1.5">
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center justify-center gap-2">
              <span>GameHub</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 uppercase tracking-widest">
                v2.0
              </span>
            </h1>
            <p className="text-xs text-zinc-400 font-medium">
              Loading your games and accounts...
            </p>
          </div>

          <div className="w-48 h-1 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-teal-500 to-cyan-400 rounded-full animate-pulse w-2/3" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface-900 text-zinc-100 antialiased font-sans select-none">
      {/* Sidebar Navigation */}
      <Sidebar
        currentPage={currentPage}
        currentFilter={currentFilter}
        onNavigate={handleNavigate}
        onOpenAccounts={() => setIsAccountManagerOpen(true)}
        accounts={accounts}
        accountGameCounts={accountGameCounts}
        gameCounts={gameCounts}
      />

      {/* Main View Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header Bar */}
        <TopBar
          currentPage={currentPage}
          searchQuery={searchQuery}
          onSearchChange={(q) => {
            setSearchQuery(q);
            if (q && currentPage !== 'library') {
              setCurrentPage('library');
            }
          }}
          onSearchSubmit={() => {
            if (searchQuery.trim()) {
              const q = searchQuery.toLowerCase().trim();
              const match = games.find(
                (g) =>
                  g.name.toLowerCase().includes(q) ||
                  g.developer?.toLowerCase().includes(q) ||
                  g.publisher?.toLowerCase().includes(q) ||
                  g.genre?.toLowerCase().includes(q)
              );
              if (match) handleLaunch(match);
            }
          }}
          onNavigate={handleNavigate}
          onRescan={handleRescan}
          onAddGame={() => setIsAddGameOpen(true)}
          onOpenAccounts={() => setIsAccountManagerOpen(true)}
          isScanning={isScanning}
        />

        {/* Dynamic Launch Toast Alert */}
        {launchMessage && (
          <div className="fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl bg-teal-500 text-zinc-950 font-bold text-xs shadow-2xl shadow-teal-500/30 flex items-center gap-3 animate-bounce">
            <span className="w-2 h-2 rounded-full bg-zinc-950 animate-ping" />
            <span>{launchMessage}</span>
          </div>
        )}

        {/* Scrollable Page Body */}
        <main className="flex-1 overflow-y-auto px-8 py-6">
          {currentPage === 'home' && (
            <Home
              games={games}
              onToggleFavorite={handleToggleFavorite}
              onLaunch={handleLaunch}
              onInstall={handleInstallGame}
              onNavigate={handleNavigate}
              onSelectGame={(g) => {
                setFocusedGame(g);
                setSelectedGame(g);
              }}
              onFocusGame={setFocusedGame}
              onLocate={handleLocateGame}
              onRemove={handleRemoveGame}
              onHide={handleHideGame}
            />
          )}

          {currentPage === 'library' && (
            <Library
              games={games}
              currentFilter={currentFilter}
              onFilterChange={setCurrentFilter}
              searchQuery={searchQuery}
              onToggleFavorite={handleToggleFavorite}
              onLaunch={handleLaunch}
              onInstall={handleInstallGame}
              onSelectGame={(g) => {
                setFocusedGame(g);
                setSelectedGame(g);
              }}
              onFocusGame={setFocusedGame}
              onLocate={handleLocateGame}
              onRemove={handleRemoveGame}
              onHide={handleHideGame}
              accounts={accounts}
              accountGameCounts={accountGameCounts}
              onOpenAccounts={() => setIsAccountManagerOpen(true)}
            />
          )}

          {currentPage === 'favorites' && (
            <Favorites
              games={games}
              onToggleFavorite={handleToggleFavorite}
              onLaunch={handleLaunch}
              onNavigate={handleNavigate}
              onSelectGame={setSelectedGame}
              onLocate={handleLocateGame}
              onRemove={handleRemoveGame}
              onHide={handleHideGame}
            />
          )}

          {currentPage === 'recently-played' && (
            <RecentlyPlayed
              games={games}
              onLaunch={handleLaunch}
              onNavigate={handleNavigate}
              onLocate={handleLocateGame}
              onSelectGame={setSelectedGame}
            />
          )}

          {currentPage === 'drives' && <Drives games={games} />}

          {currentPage === 'help' && (
            <Help
              onNavigate={handleNavigate}
              onOpenAccounts={() => setIsAccountManagerOpen(true)}
            />
          )}

          {currentPage === 'settings' && (
            <Settings
              games={games}
              onLibraryUpdated={() => {
                loadGames();
                loadAccounts();
              }}
              onNavigate={handleNavigate}
            />
          )}
        </main>
      </div>

      {/* Add Game Modal */}
      <AddGameModal
        isOpen={isAddGameOpen}
        onClose={() => setIsAddGameOpen(false)}
        onAdd={handleAddGame}
      />

      {/* Multi-Account Manager Modal */}
      <AccountManagerModal
        isOpen={isAccountManagerOpen}
        onClose={() => setIsAccountManagerOpen(false)}
        onAccountsUpdated={() => {
          loadGames();
          loadAccounts();
        }}
      />

      {/* Full Game Details Modal */}
      <GameDetailsModal
        game={selectedGame}
        onClose={() => setSelectedGame(null)}
        onLaunch={handleLaunch}
        onInstall={handleInstallGame}
        onToggleFavorite={handleToggleFavorite}
        onUpdateGame={handleUpdateGame}
        onLocate={handleLocateGame}
        onRemove={handleRemoveGame}
        onHide={handleHideGame}
      />

      {/* Sleek Dark-Themed Alert & Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmModalState.isOpen}
        title={confirmModalState.title}
        message={confirmModalState.message}
        subMessage={confirmModalState.subMessage}
        confirmLabel={confirmModalState.confirmLabel}
        cancelLabel={confirmModalState.cancelLabel}
        type={confirmModalState.type}
        icon={confirmModalState.icon}
        onConfirm={confirmModalState.onConfirm}
        onCancel={() => setConfirmModalState((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

export default App;
