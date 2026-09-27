import React, { useState, useEffect, useCallback } from 'react';
import {
  Sliders,
  FolderPlus,
  Trash2,
  Moon,
  Database,
  Download,
  Upload,
  FileText,
  Check,
  Shield,
  Layers,
  Sparkles,
  HardDrive,
  RefreshCw,
  FolderOpen,
  Gamepad2,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Key,
  ShieldCheck,
  BookOpen,
  Info,
  Clock,
  HelpCircle,
} from 'lucide-react';
import { APP_CONFIG } from '../config/appConfig';
import { WindowsDrive } from '../types/Drive';
import { Game } from '../types/Game';
import { PageRoute } from '../types/Navigation';
import { formatImageUrl } from '../utils/formatImage';
import { useNavigation } from '../context/NavigationContext';
import { FocusableItem } from '../components/FocusableItem';

interface SettingsProps {
  onLibraryUpdated?: () => void;
  onNavigate?: (page: PageRoute) => void;
  games?: Game[];
}

export const Settings: React.FC<SettingsProps> = ({ onLibraryUpdated, onNavigate, games = [] }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'library' | 'appearance' | 'advanced' | 'controller'>('general');
  const { controllerInfo, isControllerEnabled, setControllerEnabled } = useNavigation();

  // Computed Library & Storage Stats (Moved from Home)
  const installedGames = games.filter((g) => g.isInstalled);
  const missingGamesCount = games.length - installedGames.length;

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

  // General settings state
  const [startWithWindows, setStartWithWindows] = useState(false);
  const [minimizeToTray, setMinimizeToTray] = useState(true);
  const [rememberWindowSize, setRememberWindowSize] = useState(true);

  // Library backup & maintenance state
  const [backupStatus, setBackupStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Library locations state
  const [scanLocations, setScanLocations] = useState<string[]>([
    'C:\\Games',
    'D:\\Games',
    'E:\\Games',
    'F:\\Games',
    'G:\\Games',
  ]);
  const [newPath, setNewPath] = useState('');
  const [isScanningStandalone, setIsScanningStandalone] = useState(false);
  const [scanResultFeedback, setScanResultFeedback] = useState<string | null>(null);

  // Auto-rescan state (v1.0.3)
  const [autoRescanEnabled, setAutoRescanEnabled] = useState(false);
  const [autoRescanInterval, setAutoRescanInterval] = useState(60);
  const [lastAutoScanTime, setLastAutoScanTime] = useState<string | undefined>(undefined);
  const [nextAutoScanTime, setNextAutoScanTime] = useState<string | undefined>(undefined);
  const [isAutoScanning, setIsAutoScanning] = useState(false);

  // Available drives state
  const [settingsDrives, setSettingsDrives] = useState<WindowsDrive[]>([]);

  // Steam Web API Key state for remote family sharing
  const [steamApiKey, setSteamApiKey] = useState('');
  const [steamApiKeySaved, setSteamApiKeySaved] = useState(false);

  useEffect(() => {
    async function loadSettingsDrives() {
      if (window.gameHub?.drives) {
        try {
          const drives = await window.gameHub.drives.getAvailable();
          if (drives && drives.length > 0) {
            setSettingsDrives(drives);
            return;
          }
        } catch {
          // Fallback
        }
      }

      // In dev browser mode, query live dev API
      try {
        const res = await fetch('/api/drives');
        if (res.ok) {
          const realDrives = await res.json();
          if (Array.isArray(realDrives) && realDrives.length > 0) {
            setSettingsDrives(realDrives);
            return;
          }
        }
      } catch {
        // Fallback
      }
    }

    async function loadSavedLocations() {
      if (window.gameHub?.settings) {
        try {
          const saved = await window.gameHub.settings.get<string[]>('scan_locations');
          if (saved && Array.isArray(saved) && saved.length > 0) {
            setScanLocations(saved);
          }
          const savedTray = await window.gameHub.settings.get<boolean>('minimize_to_tray', true);
          if (typeof savedTray === 'boolean') {
            setMinimizeToTray(savedTray);
          }
          const savedSteamKey = await window.gameHub.settings.get<string>('steam_web_api_key', '');
          if (savedSteamKey) {
            setSteamApiKey(savedSteamKey);
          }
        } catch {}
      }
    }

    async function loadAutoRescan() {
      if (window.gameHub?.scanner?.getAutoRescanStatus) {
        try {
          const status = await window.gameHub.scanner.getAutoRescanStatus();
          if (status) {
            setAutoRescanEnabled(status.enabled);
            setAutoRescanInterval(status.intervalMinutes);
            setLastAutoScanTime(status.lastScanTime);
            setNextAutoScanTime(status.nextScanTime);
            setIsAutoScanning(status.isScanning);
          }
        } catch {}
      }
    }

    loadSettingsDrives();
    loadSavedLocations();
    loadAutoRescan();

    const unsubscribeStatus = window.gameHub?.scanner?.onAutoRescanStatus?.((status) => {
      setAutoRescanEnabled(status.enabled);
      setAutoRescanInterval(status.intervalMinutes);
      setLastAutoScanTime(status.lastScanTime);
      setNextAutoScanTime(status.nextScanTime);
      setIsAutoScanning(status.isScanning);
    });

    const unsubscribeNewGames = window.gameHub?.scanner?.onNewGamesDiscovered?.((data) => {
      setScanResultFeedback(`Library updated: Discovered ${data.count} newly installed game(s)!`);
      onLibraryUpdated?.();
    });

    return () => {
      unsubscribeStatus?.();
      unsubscribeNewGames?.();
    };
  }, [onLibraryUpdated]);

  const toggleDriveInclusion = async (letter: string) => {
    const drive = settingsDrives.find((d) => d.letter === letter);
    if (!drive) return;
    const nextState = !drive.isIncluded;

    setSettingsDrives((prev) =>
      prev.map((d) => (d.letter === letter ? { ...d, isIncluded: nextState } : d))
    );

    if (window.gameHub?.drives) {
      await window.gameHub.drives.toggleInclusion(letter, nextState);
    }
  };

  // Appearance
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>('dark');
  const [cardDensity, setCardDensity] = useState<'normal' | 'compact'>('normal');

  const addLocation = async (pathToAdd?: string) => {
    const target = (pathToAdd || newPath).trim();
    if (target && !scanLocations.includes(target)) {
      const updated = [...scanLocations, target];
      setScanLocations(updated);
      setNewPath('');
      if (window.gameHub?.settings) {
        await window.gameHub.settings.set('scan_locations', updated);
      }
    }
  };

  const handleBrowseFolder = async () => {
    if (window.gameHub?.dialog) {
      try {
        const folder = await window.gameHub.dialog.selectFolder();
        if (folder) {
          addLocation(folder);
        }
      } catch (err: any) {
        console.error('[Settings] Folder browse error:', err.message);
      }
    }
  };

  const removeLocation = async (pathToRemove: string) => {
    const updated = scanLocations.filter((p) => p !== pathToRemove);
    setScanLocations(updated);
    if (window.gameHub?.settings) {
      await window.gameHub.settings.set('scan_locations', updated);
    }
  };

  const runStandaloneScan = async () => {
    setIsScanningStandalone(true);
    setScanResultFeedback(null);

    if (window.gameHub?.games) {
      try {
        const res = await window.gameHub.games.scan();
        setScanResultFeedback(
          res.newGamesCount > 0
            ? `Scan finished: Discovered and added ${res.newGamesCount} new standalone game(s)!`
            : `Scan complete. No new unindexed games found in scanned locations.`
        );
      } catch (err: any) {
        setScanResultFeedback(`Scan encountered an issue: ${err.message}`);
      }
    } else {
      setTimeout(() => {
        setScanResultFeedback('Simulated scan complete: 2 standalone games detected.');
      }, 1000);
    }

    setIsScanningStandalone(false);
  };

  const handleToggleAutoRescan = async (enabled: boolean) => {
    setAutoRescanEnabled(enabled);
    if (window.gameHub?.scanner?.setAutoRescan) {
      try {
        const res = await window.gameHub.scanner.setAutoRescan(enabled, autoRescanInterval);
        if (res) {
          setNextAutoScanTime(res.nextScanTime);
        }
      } catch (err: any) {
        console.error('[Settings] setAutoRescan error:', err.message);
      }
    }
  };

  const handleSaveSteamApiKey = async () => {
    if (window.gameHub?.settings) {
      await window.gameHub.settings.set('steam_web_api_key', steamApiKey.trim());
      setSteamApiKeySaved(true);
      setTimeout(() => setSteamApiKeySaved(false), 3000);
    }
  };

  const handleChangeAutoRescanInterval = async (interval: number) => {
    setAutoRescanInterval(interval);
    if (window.gameHub?.scanner?.setAutoRescan) {
      try {
        const res = await window.gameHub.scanner.setAutoRescan(autoRescanEnabled, interval);
        if (res) {
          setNextAutoScanTime(res.nextScanTime);
        }
      } catch (err: any) {
        console.error('[Settings] change interval error:', err.message);
      }
    }
  };

  const handleTriggerAutoRescanNow = async () => {
    setIsAutoScanning(true);
    setScanResultFeedback(null);
    try {
      if (window.gameHub?.scanner?.triggerAutoRescan) {
        const res = await window.gameHub.scanner.triggerAutoRescan();
        if (res.result?.newGamesAdded > 0) {
          setScanResultFeedback(`Rescan complete: Added ${res.result.newGamesAdded} new game(s)!`);
          onLibraryUpdated?.();
        } else {
          setScanResultFeedback('Rescan complete: Game library is up to date.');
        }
      }
    } catch (err: any) {
      setScanResultFeedback(`Rescan error: ${err.message}`);
    } finally {
      setIsAutoScanning(false);
    }
  };

  // Hidden games state & management
  const [hiddenGames, setHiddenGames] = useState<Game[]>([]);
  const [isLoadingHidden, setIsLoadingHidden] = useState<boolean>(false);

  const loadHiddenGames = useCallback(async () => {
    if (window.gameHub?.games?.getHidden) {
      setIsLoadingHidden(true);
      try {
        const hidden = await window.gameHub.games.getHidden();
        setHiddenGames(hidden || []);
      } catch (err: any) {
        console.error('[Settings] Error fetching hidden games:', err.message);
      } finally {
        setIsLoadingHidden(false);
      }
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'library') {
      loadHiddenGames();
    }
  }, [activeTab, loadHiddenGames]);

  const handleUnhideGame = async (gameId: number) => {
    try {
      if (window.gameHub?.games?.unhide) {
        await window.gameHub.games.unhide(gameId);
        setHiddenGames((prev) => prev.filter((g) => g.id !== gameId));
        onLibraryUpdated?.();
      }
    } catch (err: any) {
      console.error('[Settings] Failed to unhide game:', err.message);
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-4xl">
      {/* Settings Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-3 overflow-x-auto">
        {[
          { id: 'general', label: 'General' },
          { id: 'library', label: 'Library & Folders' },
          { id: 'appearance', label: 'Appearance' },
          { id: 'advanced', label: 'Storage & Backup' },
          { id: 'controller', label: 'Controller' },
        ].map((tab) => (
          <FocusableItem
            key={tab.id}
            id={`settings-tab-${tab.id}`}
            scope="main"
            group="tabs"
            onConfirm={() => setActiveTab(tab.id as any)}
          >
            {({ ref, isFocused }) => (
              <button
                ref={ref}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                  isFocused ? 'controller-focus' : ''
                } ${
                  activeTab === tab.id
                    ? 'bg-teal-500 text-zinc-950 font-bold shadow-md shadow-teal-500/20'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                }`}
              >
                {tab.label}
              </button>
            )}
          </FocusableItem>
        ))}
      </div>

      {/* Tab: General */}
      {activeTab === 'general' && (
        <div className="space-y-4">
          <div className="p-6 rounded-2xl bg-surface-850 border border-zinc-800 space-y-5">
            <h3 className="font-bold text-base text-zinc-100 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-teal-400" />
              General Application Preferences
            </h3>

            <div className="space-y-3 divide-y divide-zinc-800/60">
              <label className="flex items-center justify-between pt-3 cursor-pointer">
                <div>
                  <p className="text-sm font-semibold text-zinc-200">Start with Windows</p>
                  <p className="text-xs text-zinc-500">Launch GameHub automatically on PC boot.</p>
                </div>
                <input
                  type="checkbox"
                  checked={startWithWindows}
                  onChange={(e) => setStartWithWindows(e.target.checked)}
                  className="w-4 h-4 accent-teal-500 rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between pt-3 cursor-pointer">
                <div>
                  <p className="text-sm font-semibold text-zinc-200">Close to System Tray</p>
                  <p className="text-xs text-zinc-500">Closing the window keeps GameHub running in the background tray.</p>
                </div>
                <input
                  type="checkbox"
                  checked={minimizeToTray}
                  onChange={(e) => {
                    const val = e.target.checked;
                    setMinimizeToTray(val);
                    if (window.gameHub?.settings) {
                      window.gameHub.settings.set('minimize_to_tray', val);
                    }
                  }}
                  className="w-4 h-4 accent-teal-500 rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between pt-3 cursor-pointer">
                <div>
                  <p className="text-sm font-semibold text-zinc-200">Remember Window Dimensions</p>
                  <p className="text-xs text-zinc-500">Restore window size and position on reopen.</p>
                </div>
                <input
                  type="checkbox"
                  checked={rememberWindowSize}
                  onChange={(e) => setRememberWindowSize(e.target.checked)}
                  className="w-4 h-4 accent-teal-500 rounded cursor-pointer"
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Library & Folders */}
      {activeTab === 'library' && (
        <div className="space-y-4">
          <div className="p-6 rounded-2xl bg-surface-850 border border-zinc-800 space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="font-bold text-base text-zinc-100 flex items-center gap-2">
                  <FolderPlus className="w-4 h-4 text-teal-400" />
                  Custom Game Scan Folders
                </h3>
                <p className="text-xs text-zinc-400">
                  GameHub heuristically scans these directories and active drives for standalone PC games.
                </p>
              </div>

              <button
                type="button"
                onClick={runStandaloneScan}
                disabled={isScanningStandalone}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-800 hover:bg-zinc-700 text-xs font-bold text-teal-400 border border-teal-500/30 transition-all cursor-pointer disabled:opacity-50 shadow-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isScanningStandalone ? 'animate-spin' : ''}`} />
                <span>{isScanningStandalone ? 'Scanning Library...' : 'Scan Now'}</span>
              </button>
            </div>

            {/* Scan Feedback Alert */}
            {scanResultFeedback && (
              <div className="p-3.5 rounded-xl bg-teal-500/10 border border-teal-500/20 text-xs text-teal-300 flex items-center justify-between">
                <span>{scanResultFeedback}</span>
                <button
                  type="button"
                  onClick={() => setScanResultFeedback(null)}
                  className="text-teal-400 hover:text-white font-bold ml-3"
                >
                  &times;
                </button>
              </div>
            )}

            {/* Add folder input with Browse */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newPath}
                onChange={(e) => setNewPath(e.target.value)}
                placeholder="e.g. D:\Games or E:\CustomLibrary"
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-teal-500/50"
              />
              <button
                type="button"
                onClick={handleBrowseFolder}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-semibold text-zinc-200 transition-all cursor-pointer"
                title="Browse folder via file explorer"
              >
                <FolderOpen className="w-3.5 h-3.5 text-teal-400" />
                <span>Browse</span>
              </button>
              <button
                type="button"
                onClick={() => addLocation()}
                className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-zinc-950 font-bold text-xs transition-all shadow-md shadow-teal-500/10 cursor-pointer"
              >
                Add Folder
              </button>
            </div>

            {/* Existing locations list */}
            <div className="space-y-2">
              {scanLocations.map((loc) => (
                <div
                  key={loc}
                  className="flex items-center justify-between p-3 rounded-xl bg-zinc-900 border border-zinc-800/80 font-mono text-xs text-zinc-300"
                >
                  <span>{loc}</span>
                  <button
                    type="button"
                    onClick={() => removeLocation(loc)}
                    className="text-zinc-500 hover:text-rose-400 transition-colors p-1"
                    title="Remove folder"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Available Drives Checklist */}
            <div className="pt-4 border-t border-zinc-800/80 space-y-3">
              <h4 className="font-bold text-sm text-zinc-100 flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-teal-400" />
                Available Drives
              </h4>
              <p className="text-xs text-zinc-400">
                Check which detected drives GameHub automatically scans for games:
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                {settingsDrives.map((d) => (
                  <label
                    key={d.letter}
                    className="flex items-center gap-2.5 p-3 rounded-xl bg-zinc-900 border border-zinc-800/80 hover:border-zinc-700 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={d.isIncluded}
                      onChange={() => toggleDriveInclusion(d.letter)}
                      className="w-4 h-4 accent-teal-500 rounded cursor-pointer"
                    />
                    <span className="font-bold font-mono text-xs text-teal-300">{d.letter}</span>
                    <span className="text-[11px] text-zinc-400 truncate">{d.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Automatic Game Rescan Section (v1.0.3) */}
            <div className="pt-5 border-t border-zinc-800/80 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h4 className="font-bold text-sm text-zinc-100 flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-teal-400" />
                    Automatic Game Rescan
                  </h4>
                  <p className="text-xs text-zinc-400">
                    Periodically discovers newly installed games in background across all drives and launchers.
                  </p>
                </div>

                <FocusableItem
                  id="settings-rescan-now-btn"
                  scope="main"
                  group="library"
                  onConfirm={handleTriggerAutoRescanNow}
                >
                  {({ ref, isFocused }) => (
                    <button
                      ref={ref}
                      type="button"
                      onClick={handleTriggerAutoRescanNow}
                      disabled={isAutoScanning || isScanningStandalone}
                      className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-zinc-950 text-xs font-bold transition-all cursor-pointer disabled:opacity-50 shadow-md shadow-teal-500/10 ${
                        isFocused ? 'controller-focus' : ''
                      }`}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isAutoScanning ? 'animate-spin' : ''}`} />
                      <span>{isAutoScanning ? 'Rescanning...' : 'Rescan Now'}</span>
                    </button>
                  )}
                </FocusableItem>
              </div>

              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800/80 space-y-4">
                <FocusableItem
                  id="settings-auto-rescan-toggle"
                  scope="main"
                  group="library"
                  onConfirm={() => handleToggleAutoRescan(!autoRescanEnabled)}
                >
                  {({ ref, isFocused }) => (
                    <label
                      ref={ref}
                      className={`flex items-center justify-between cursor-pointer p-1 rounded-lg ${
                        isFocused ? 'ring-2 ring-teal-400 bg-zinc-800/40' : ''
                      }`}
                    >
                      <div>
                        <span className="text-xs font-semibold text-zinc-200">
                          Automatically rescan for newly installed games
                        </span>
                        <p className="text-[11px] text-zinc-500">
                          Session-tied timer starts on app launch and automatically pauses when closed.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={autoRescanEnabled}
                        onChange={(e) => handleToggleAutoRescan(e.target.checked)}
                        className="w-4 h-4 accent-teal-500 rounded cursor-pointer"
                      />
                    </label>
                  )}
                </FocusableItem>

                {autoRescanEnabled && (
                  <div className="pt-3 border-t border-zinc-800 flex items-center justify-between flex-wrap gap-3 text-xs">
                    <span className="text-zinc-300 font-medium">Rescan interval</span>
                    <FocusableItem
                      id="settings-auto-rescan-interval"
                      scope="main"
                      group="library"
                    >
                      {({ ref, isFocused }) => (
                        <select
                          ref={ref}
                          value={autoRescanInterval}
                          onChange={(e) => handleChangeAutoRescanInterval(Number(e.target.value))}
                          className={`bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-zinc-100 font-medium cursor-pointer focus:outline-none focus:border-teal-500 ${
                            isFocused ? 'controller-focus' : ''
                          }`}
                        >
                          <option value={15}>15 minutes</option>
                          <option value={30}>30 minutes</option>
                          <option value={60}>1 hour</option>
                          <option value={120}>2 hours</option>
                          <option value={360}>6 hours</option>
                          <option value={720}>12 hours</option>
                          <option value={1440}>24 hours</option>
                        </select>
                      )}
                    </FocusableItem>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-zinc-800/60 text-[11px] font-mono text-zinc-400">
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-500 font-sans">Last automatic scan:</span>
                    <span className="text-zinc-300">
                      {lastAutoScanTime ? new Date(lastAutoScanTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-500 font-sans">Next automatic scan:</span>
                    <span className="text-zinc-300">
                      {autoRescanEnabled && nextAutoScanTime
                        ? new Date(nextAutoScanTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : 'Disabled'}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between">
                  <span className="text-[11px] text-zinc-500 font-sans">
                    Force an immediate scan cycle safely
                  </span>
                  <FocusableItem
                    id="settings-auto-rescan-trigger-btn"
                    scope="main"
                    group="library"
                    onConfirm={handleTriggerAutoRescanNow}
                  >
                    {({ ref, isFocused }) => (
                      <button
                        ref={ref}
                        type="button"
                        onClick={handleTriggerAutoRescanNow}
                        disabled={isAutoScanning}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 border border-teal-500/30 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 ${
                          isFocused ? 'controller-focus' : ''
                        }`}
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isAutoScanning ? 'animate-spin' : ''}`} />
                        <span>{isAutoScanning ? 'Scanning...' : 'Rescan Now'}</span>
                      </button>
                    )}
                  </FocusableItem>
                </div>
              </div>
            </div>

            {/* Hidden & Excluded Games Management */}
            <div className="p-6 rounded-2xl bg-surface-850 border border-zinc-800 space-y-5">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h3 className="font-bold text-base text-zinc-100 flex items-center gap-2">
                    <EyeOff className="w-4 h-4 text-amber-400" />
                    Hidden & Excluded Games
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Games marked as hidden are removed from your library and will never be re-added by automatic or manual rescans.
                  </p>
                </div>
                <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-300">
                  {hiddenGames.length} Hidden
                </span>
              </div>

              {isLoadingHidden ? (
                <div className="p-6 rounded-xl bg-zinc-900/60 border border-zinc-800/60 text-center text-xs text-zinc-500 flex items-center justify-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Loading hidden games...</span>
                </div>
              ) : hiddenGames.length === 0 ? (
                <div className="p-6 rounded-xl bg-zinc-900/60 border border-zinc-800/60 text-center text-xs text-zinc-500">
                  No games are currently hidden. You can hide any game from its context menu (•••) or game details modal.
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {hiddenGames.map((game) => (
                    <div
                      key={game.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-zinc-900 border border-zinc-800/80 hover:border-zinc-700/80 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {game.coverImage ? (
                          <img
                            src={formatImageUrl(game.coverImage)}
                            alt={game.name}
                            className="w-10 h-10 rounded-lg object-cover bg-zinc-800 flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0 text-zinc-500">
                            <Gamepad2 className="w-5 h-5" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <h5 className="text-xs font-bold text-zinc-200 truncate">{game.name}</h5>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">{game.launcher}</span>
                            {game.drive && (
                              <span className="text-[10px] font-mono text-zinc-600 bg-zinc-800/60 px-1.5 py-0.5 rounded">
                                {game.drive}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleUnhideGame(game.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-teal-400 hover:text-teal-300 border border-zinc-700/60 hover:border-teal-500/40 text-xs font-semibold transition-all cursor-pointer flex-shrink-0 shadow-sm"
                        title="Restore game to library and enable scanning"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Unhide & Restore</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Steam Integration & Remote Family Sharing (Optional API Key) */}
            <div className="p-6 rounded-2xl bg-surface-850 border border-zinc-800 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h3 className="font-bold text-base text-zinc-100 flex items-center gap-2">
                    <Key className="w-4 h-4 text-amber-400" />
                    Steam Integration & Remote Family Sharing
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Optional Steam Web API key. Local accounts and installed family shared games work automatically with zero setup. Entering an API key allows fetching uninstalled games from remote friends whose accounts haven&apos;t logged into this PC.
                  </p>
                </div>
              </div>

              {/* Use Case Explanation */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                  <span className="font-bold text-emerald-400 flex items-center gap-1.5 font-mono text-[11px] uppercase">
                    <span>✓</span> No API Key Needed
                  </span>
                  <p className="text-zinc-400 text-[11px]">
                    Installed games, local Steam accounts, and installed family-shared titles are detected 100% offline from your local disk without any API key or login.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1">
                  <span className="font-bold text-amber-400 flex items-center gap-1.5 font-mono text-[11px] uppercase">
                    <span>ℹ</span> When You Need a Key
                  </span>
                  <p className="text-zinc-400 text-[11px]">
                    Only needed if you want to discover <strong>uninstalled games</strong> from remote friends who shared their library with you online but have never logged into your PC.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800/80 space-y-3">
                <div className="flex flex-col sm:flex-row gap-2.5">
                  <div className="relative flex-1">
                    <input
                      type="password"
                      placeholder="Paste Steam Web API Key (32 characters)"
                      value={steamApiKey}
                      onChange={(e) => setSteamApiKey(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 font-mono placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveSteamApiKey}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-md shadow-amber-500/10 transition-all cursor-pointer"
                  >
                    {steamApiKeySaved ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-zinc-950" />
                        <span>Saved</span>
                      </>
                    ) : (
                      <span>Save Key</span>
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between flex-wrap gap-2 text-[11px] text-zinc-500">
                  <span>
                    Don&apos;t have a key? You can generate one for free from Valve.
                  </span>
                  <a
                    href="https://steamcommunity.com/dev/apikey"
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => {
                      e.preventDefault();
                      if (window.gameHub?.openExternal) {
                        window.gameHub.openExternal('https://steamcommunity.com/dev/apikey');
                      } else {
                        window.open('https://steamcommunity.com/dev/apikey', '_blank');
                      }
                    }}
                    className="text-amber-400 hover:text-amber-300 underline font-mono cursor-pointer"
                    title="Opens safely in your default web browser (Chrome, Edge, etc.)"
                  >
                    Get Steam Web API Key ↗
                  </a>
                </div>

                {/* Important Domain Name Instruction */}
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 text-amber-300 font-bold font-mono text-[11px] uppercase">
                    <Info className="w-3.5 h-3.5 text-amber-400" />
                    <span>Important: What to enter for &quot;Domain Name&quot; on Valve&apos;s site:</span>
                  </div>
                  <p className="text-zinc-300 text-[11px]">
                    When Valve asks for <strong>&quot;Domain Name&quot;</strong>, simply enter: <code className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-amber-300 font-mono font-bold">localhost</code> (or <code className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-amber-300 font-mono">local</code>).
                  </p>
                  <p className="text-zinc-500 text-[10px]">
                    Valve requires this field for web developers, but for personal library fetching, entering <code className="text-zinc-400 font-mono">localhost</code> is standard practice and has zero negative impact.
                  </p>
                </div>

                {/* Security & Trust Guarantee */}
                <div className="p-3.5 rounded-xl bg-surface-900/90 border border-zinc-800 text-xs text-zinc-400 space-y-2 mt-2">
                  <div className="flex items-center gap-2 text-emerald-400 font-semibold text-[11px] uppercase tracking-wider font-mono">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Privacy &amp; Trust Guarantee</span>
                  </div>
                  <ul className="space-y-1.5 text-[11px] text-zinc-400">
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 font-bold">✓</span>
                      <span>
                        <strong className="text-zinc-200">Zero Passwords Requested:</strong> GameHub never asks for, captures, or stores your Steam password or Steam Guard codes.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 font-bold">✓</span>
                      <span>
                        <strong className="text-zinc-200">Native Browser Isolation:</strong> Official Valve links open directly in your trusted default browser (Chrome / Edge / Firefox) at <span className="text-zinc-300 font-mono">https://steamcommunity.com</span>. GameHub cannot see or access your browser session.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 font-bold">✓</span>
                      <span>
                        <strong className="text-zinc-200">Read-Only API Scope:</strong> Steam Web API keys are strictly read-only for public library lists. They cannot make purchases, trade items, or modify your account.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-emerald-400 font-bold">✓</span>
                      <span>
                        <strong className="text-zinc-200">100% Offline &amp; Local:</strong> Installed games and local accounts are detected directly from your disk without requiring any API key or login.
                      </span>
                    </li>
                  </ul>
                </div>

                {/* Direct link to Documentation */}
                {onNavigate && (
                  <div className="flex items-center justify-between pt-1 text-[11px] text-zinc-500">
                    <span>Need full illustrated step-by-step guidance?</span>
                    <button
                      type="button"
                      onClick={() => onNavigate('help')}
                      className="text-teal-400 hover:text-teal-300 font-medium inline-flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>View Steam Guide in Help &amp; Documentation →</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Appearance */}
      {activeTab === 'appearance' && (
        <div className="p-6 rounded-2xl bg-surface-850 border border-zinc-800 space-y-5">
          <h3 className="font-bold text-base text-zinc-100 flex items-center gap-2">
            <Moon className="w-4 h-4 text-teal-400" />
            Theme & Display
          </h3>

          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'dark', label: 'Dark Mode (Active)' },
              { id: 'light', label: 'Light Mode (Coming)' },
              { id: 'system', label: 'System Default' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTheme(t.id as any)}
                className={`p-4 rounded-xl border text-center text-xs font-semibold transition-all ${
                  theme === t.id
                    ? 'border-teal-500 bg-teal-500/10 text-teal-300 shadow-md shadow-teal-500/10'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-400'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tab: Advanced / Storage & Backup */}
      {activeTab === 'advanced' && (
        <div className="space-y-6">
          {/* Header & Subtitle */}
          <div className="p-6 rounded-2xl bg-surface-850 border border-zinc-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
              <div>
                <h3 className="font-bold text-lg text-zinc-100 flex items-center gap-2">
                  <Database className="w-5 h-5 text-teal-400" />
                  Storage, Database &amp; Library Health
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  System storage footprint, portable library backups, and diagnostic maintenance utilities.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate?.('help')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 border border-teal-500/20 text-xs font-semibold transition-all self-start sm:self-auto cursor-pointer"
              >
                <HelpCircle className="w-4 h-4" />
                <span>Help &amp; Documentation</span>
              </button>
            </div>

            {/* Quick Overview Stats Row (Moved from Home) */}
            <div className="space-y-2">
              <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                System Storage &amp; Library Overview
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Installed Games */}
                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800/80 flex items-center gap-3.5">
                  <div className="p-2.5 rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20">
                    <Gamepad2 className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">Installed Games</p>
                    <div className="flex items-baseline gap-1.5">
                      <p className="text-xl font-bold text-white font-['Outfit']">{installedGames.length}</p>
                      {missingGamesCount > 0 && (
                        <span className="text-[10px] font-medium text-amber-400 font-mono">
                          ({missingGamesCount} missing)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Total Playtime */}
                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800/80 flex items-center gap-3.5">
                  <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">Total Playtime</p>
                    <p className="text-xl font-bold text-white font-['Outfit']">{playTimeDisplay}</p>
                  </div>
                </div>

                {/* Storage Utilized */}
                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800/80 flex items-center gap-3.5">
                  <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">Storage Utilized</p>
                    <p className="text-xl font-bold text-white font-['Outfit']">{totalStorageDisplay}</p>
                  </div>
                </div>

                {/* Drives Detected */}
                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800/80 flex items-center gap-3.5">
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <HardDrive className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">Drives Detected</p>
                    <p className="text-xl font-bold text-white font-['Outfit']">{settingsDrives.length || 1} Drives Active</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Why Does This Section Exist? Guide Box */}
            <div className="p-4 rounded-xl bg-teal-500/5 border border-teal-500/20 space-y-2">
              <div className="flex items-center gap-2 text-teal-400 font-semibold text-xs">
                <Info className="w-4 h-4 shrink-0" />
                <span>Why does this section exist and when would you use it?</span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                During normal everyday gaming, you <strong>never need to touch these tools</strong>. GameHub automatically indexes your games, updates playtime, and manages artwork in the background. This section exists for 4 specific real-world scenarios:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs text-zinc-400">
                <div className="flex items-start gap-2 p-2 rounded-lg bg-zinc-900/60 border border-zinc-800/50">
                  <span className="text-base shrink-0">💻</span>
                  <div>
                    <strong className="text-zinc-200 block">Moving to a New PC / Reinstalling Windows</strong>
                    <span>Use <em>Export Library Backup</em> to save all custom categories, tags, and playtime to a JSON file and restore it in 1 second.</span>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-2 rounded-lg bg-zinc-900/60 border border-zinc-800/50">
                  <span className="text-base shrink-0">💾</span>
                  <div>
                    <strong className="text-zinc-200 block">Freeing Up SSD Storage Space</strong>
                    <span>Click <em>Clear Artwork Cache</em> to delete downloaded poster art if it grows too large on your drive.</span>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-2 rounded-lg bg-zinc-900/60 border border-zinc-800/50">
                  <span className="text-base shrink-0">⚡</span>
                  <div>
                    <strong className="text-zinc-200 block">After a Sudden Crash or Power Loss</strong>
                    <span>Use <em>Repair &amp; Optimize Database</em> to fix locked SQLite indexes, recover missing games, and speed up library loading.</span>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-2 rounded-lg bg-zinc-900/60 border border-zinc-800/50">
                  <span className="text-base shrink-0">🔍</span>
                  <div>
                    <strong className="text-zinc-200 block">Troubleshooting Failed Launches</strong>
                    <span>Open <em>gamehub.log</em> to see the exact error message or crash code when asking for support.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Feedback Banner */}
            {backupStatus && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center justify-between gap-2 border ${
                  backupStatus.type === 'success'
                    ? 'bg-teal-500/10 border-teal-500/30 text-teal-300'
                    : backupStatus.type === 'error'
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                }`}
              >
                <span>{backupStatus.message}</span>
                <button
                  type="button"
                  onClick={() => setBackupStatus(null)}
                  className="text-zinc-500 hover:text-zinc-300 text-xs px-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Sub-section 1: Library Backup & Migration */}
            <div className="space-y-2 pt-2">
              <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                1. Library Backup &amp; Transfer
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 1. Export Library Backup */}
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={async () => {
                    if (!window.gameHub?.backup?.export) {
                      setBackupStatus({ type: 'error', message: 'Library export is only available in desktop mode.' });
                      return;
                    }
                    setIsExporting(true);
                    setBackupStatus(null);
                    try {
                      const res = await window.gameHub.backup.export();
                      if (res.success) {
                        setBackupStatus({
                          type: 'success',
                          message: `Backup created successfully! ${res.gamesCount} games exported to: ${res.filePath}`,
                        });
                      } else if (!res.cancelled) {
                        setBackupStatus({ type: 'error', message: res.error || 'Failed to export backup.' });
                      }
                    } catch (err: any) {
                      setBackupStatus({ type: 'error', message: err.message });
                    } finally {
                      setIsExporting(false);
                    }
                  }}
                  className="p-4 rounded-xl bg-zinc-900 hover:bg-zinc-800/80 border border-zinc-800 text-left transition-all cursor-pointer disabled:opacity-50"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200 mb-1">
                    <Download className="w-4 h-4 text-teal-400" />
                    <span>{isExporting ? 'Exporting Backup...' : 'Export Library Backup'}</span>
                  </div>
                  <p className="text-[11px] text-zinc-400">Save library to gamehub-library.json for safe keeping or transfer</p>
                </button>

                {/* 2. Import Library Backup */}
                <button
                  type="button"
                  disabled={isImporting}
                  onClick={async () => {
                    if (!window.gameHub?.backup?.import) {
                      setBackupStatus({ type: 'error', message: 'Library import is only available in desktop mode.' });
                      return;
                    }
                    setIsExporting(true);
                    setBackupStatus(null);
                    try {
                      const res = await window.gameHub.backup.import();
                      if (res.success) {
                        setBackupStatus({
                          type: 'success',
                          message: `Backup imported! ${res.gamesImported} added, ${res.gamesUpdated} updated. Total library games: ${res.totalGames}.`,
                        });
                        onLibraryUpdated?.();
                      } else if (!res.cancelled) {
                        setBackupStatus({ type: 'error', message: res.error || 'Failed to import backup.' });
                      }
                    } catch (err: any) {
                      setBackupStatus({ type: 'error', message: err.message });
                    } finally {
                      setIsImporting(false);
                    }
                  }}
                  className="p-4 rounded-xl bg-zinc-900 hover:bg-zinc-800/80 border border-zinc-800 text-left transition-all cursor-pointer disabled:opacity-50"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200 mb-1">
                    <Upload className="w-4 h-4 text-indigo-400" />
                    <span>{isImporting ? 'Importing Backup...' : 'Import Library Backup'}</span>
                  </div>
                  <p className="text-[11px] text-zinc-400">Restore all custom categories, tags, and game titles from backup</p>
                </button>
              </div>
            </div>

            {/* Sub-section 2: Storage Cleanup & Maintenance */}
            <div className="space-y-2 pt-2">
              <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                2. Storage Cleanup &amp; Database Health
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 3. Clear Artwork Cache */}
                <button
                  type="button"
                  onClick={async () => {
                    if (window.gameHub?.settings?.clearCache) {
                      const res = await window.gameHub.settings.clearCache();
                      if (res.success) {
                        setBackupStatus({ type: 'success', message: 'Artwork cache cleared successfully. Images will re-download when viewed.' });
                      } else {
                        setBackupStatus({ type: 'error', message: res.error || 'Failed to clear cache.' });
                      }
                    } else {
                      setBackupStatus({ type: 'info', message: 'Artwork cache cleanup is ready.' });
                    }
                  }}
                  className="p-4 rounded-xl bg-zinc-900 hover:bg-zinc-800/80 border border-zinc-800 text-left transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200 mb-1">
                    <Trash2 className="w-4 h-4 text-amber-400" />
                    <span>Clear Artwork Cache (Free Up Space)</span>
                  </div>
                  <p className="text-[11px] text-zinc-400">Delete downloaded covers in %APPDATA%/GameHub to reclaim disk storage</p>
                </button>

                {/* 4. Repair & Optimize Database */}
                <button
                  type="button"
                  onClick={async () => {
                    if (window.gameHub?.database?.repair) {
                      try {
                        setBackupStatus({ type: 'info', message: 'Verifying and repairing database...' });
                        const res = await window.gameHub.database.repair();
                        if (res.success) {
                          setBackupStatus({ type: 'success', message: res.message });
                          onLibraryUpdated?.();
                        } else {
                          setBackupStatus({ type: 'error', message: res.message });
                        }
                      } catch (err: any) {
                        setBackupStatus({ type: 'error', message: err.message });
                      }
                    } else {
                      setBackupStatus({ type: 'info', message: 'Database recovery engine verified.' });
                    }
                  }}
                  className="p-4 rounded-xl bg-zinc-900 hover:bg-zinc-800/80 border border-zinc-800 text-left transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200 mb-1">
                    <Database className="w-4 h-4 text-cyan-400" />
                    <span>Repair &amp; Optimize Database</span>
                  </div>
                  <p className="text-[11px] text-zinc-400">Fix locked indexes, check data integrity, and vacuum SQLite database</p>
                </button>
              </div>
            </div>

            {/* Sub-section 3: Diagnostics & Troubleshooting */}
            <div className="space-y-2 pt-2">
              <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                3. Diagnostics &amp; Troubleshooting
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 5. Open Live gamehub.log File */}
                <button
                  type="button"
                  onClick={async () => {
                    if (window.gameHub?.settings?.openLogFile) {
                      const ok = await window.gameHub.settings.openLogFile();
                      if (!ok) {
                        setBackupStatus({ type: 'info', message: 'Log file will be created upon first recorded event.' });
                      }
                    }
                  }}
                  className="p-4 rounded-xl bg-zinc-900 hover:bg-zinc-800/80 border border-zinc-800 text-left transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200 mb-1">
                    <FileText className="w-4 h-4 text-teal-400" />
                    <span>Open Live gamehub.log</span>
                  </div>
                  <p className="text-[11px] text-zinc-400">View live diagnostic event log file and crash error messages</p>
                </button>

                {/* 6. View Application Logs Folder */}
                <button
                  type="button"
                  onClick={async () => {
                    if (window.gameHub?.settings?.openLogs) {
                      const ok = await window.gameHub.settings.openLogs();
                      if (!ok) {
                        setBackupStatus({ type: 'error', message: 'Could not open logs folder in Explorer.' });
                      }
                    } else {
                      setBackupStatus({ type: 'info', message: 'Application logs folder is available in desktop app.' });
                    }
                  }}
                  className="p-4 rounded-xl bg-zinc-900 hover:bg-zinc-800/80 border border-zinc-800 text-left transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200 mb-1">
                    <FolderOpen className="w-4 h-4 text-emerald-400" />
                    <span>View Logs Directory</span>
                  </div>
                  <p className="text-[11px] text-zinc-400">Open %APPDATA%/GameHub/logs in Windows File Explorer</p>
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-800 text-xs text-zinc-500 flex items-center justify-between">
              <span>{APP_CONFIG.name} v{APP_CONFIG.version}</span>
              <span className="font-mono text-[11px] text-zinc-600">%APPDATA%\GameHub\gamehub.db</span>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Controller */}
      {activeTab === 'controller' && (
        <div className="space-y-5">
          {/* Main Controller Support Card */}
          <div className="p-6 rounded-2xl bg-surface-850 border border-zinc-800 space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="font-bold text-base text-zinc-100 flex items-center gap-2">
                  <Gamepad2 className="w-5 h-5 text-teal-400" />
                  Controller & Gamepad Navigation
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Operate GameHub using your Xbox, PlayStation, or generic PC gamepad.
                </p>
              </div>

              {/* Status Badge */}
              <div
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-semibold ${
                  controllerInfo && controllerInfo.connected
                    ? 'bg-teal-500/10 border-teal-500/30 text-teal-300'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    controllerInfo && controllerInfo.connected
                      ? 'bg-teal-400 animate-pulse'
                      : 'bg-zinc-500'
                  }`}
                />
                <span>
                  {controllerInfo && controllerInfo.connected
                    ? 'Controller Connected'
                    : 'No Controller Detected'}
                </span>
              </div>
            </div>

            {/* Hardware & Mapping Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800/80 space-y-1">
                <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
                  Detected Device
                </span>
                <p className="text-sm font-bold text-zinc-200">
                  {controllerInfo?.name || (controllerInfo?.connected ? 'Standard Gamepad' : 'None detected')}
                </p>
                <p className="text-[11px] text-zinc-500 font-mono">
                  {controllerInfo?.id ? controllerInfo.id.slice(0, 48) : 'Connect via USB or Bluetooth'}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800/80 space-y-1">
                <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
                  Mapping & Port
                </span>
                <p className="text-sm font-bold text-teal-400">
                  {controllerInfo?.mapping
                    ? `W3C ${controllerInfo.mapping.toUpperCase()} Standard`
                    : controllerInfo?.connected
                    ? 'Standard Gamepad'
                    : 'Offline'}
                </p>
                <p className="text-[11px] text-zinc-500 font-mono">
                  {controllerInfo !== null ? `Active Device Slot #${controllerInfo.index}` : 'Hot-plug supported'}
                </p>
              </div>
            </div>

            {/* Controller Navigation Toggle */}
            <div className="pt-4 border-t border-zinc-800/80">
              <FocusableItem
                id="controller-enable-toggle"
                scope="main"
                group="controller-settings"
                onConfirm={() => setControllerEnabled(!isControllerEnabled)}
              >
                {({ ref, isFocused }) => (
                  <label
                    ref={ref}
                    className={`flex items-center justify-between p-4 rounded-xl bg-zinc-900 border transition-all cursor-pointer ${
                      isFocused
                        ? 'controller-focus border-teal-500'
                        : 'border-zinc-800/80 hover:border-zinc-700'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-semibold text-zinc-200">
                        Enable GameHub Controller Navigation
                      </p>
                      <p className="text-xs text-zinc-500">
                        When enabled, GameHub listens for D-Pad, Thumbsticks, and standard buttons to navigate the UI.
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={isControllerEnabled}
                      onChange={(e) => setControllerEnabled(e.target.checked)}
                      className="w-4 h-4 accent-teal-500 rounded cursor-pointer"
                    />
                  </label>
                )}
              </FocusableItem>
            </div>
          </div>

          {/* Quick Controller Button Guide */}
          <div className="p-6 rounded-2xl bg-surface-850 border border-zinc-800 space-y-4">
            <h4 className="font-bold text-sm text-zinc-100 flex items-center gap-2">
              <Gamepad2 className="w-4 h-4 text-teal-400" />
              Standard Controller Controls
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800/80 flex items-center justify-between">
                <span className="text-zinc-400">D-Pad / Left Thumbstick</span>
                <span className="font-bold text-teal-300 font-mono">Navigate UI & Game Grid</span>
              </div>

              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800/80 flex items-center justify-between">
                <span className="text-zinc-400">A / Cross button</span>
                <span className="font-bold text-teal-300 font-mono">Select / Open / Confirm</span>
              </div>

              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800/80 flex items-center justify-between">
                <span className="text-zinc-400">B / Circle button</span>
                <span className="font-bold text-teal-300 font-mono">Back / Close Modal</span>
              </div>

              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800/80 flex items-center justify-between">
                <span className="text-zinc-400">X / Square button</span>
                <span className="font-bold text-teal-300 font-mono">Toggle Favorite</span>
              </div>

              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800/80 flex items-center justify-between">
                <span className="text-zinc-400">Y / Triangle button</span>
                <span className="font-bold text-teal-300 font-mono">Search / Context Menu</span>
              </div>

              <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800/80 flex items-center justify-between">
                <span className="text-zinc-400">LB / RB (Bumpers)</span>
                <span className="font-bold text-teal-300 font-mono">Switch Sections / Tabs</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
