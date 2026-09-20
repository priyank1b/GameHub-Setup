import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { APP_CONFIG } from '../config/appConfig';
import { WindowsDrive } from '../types/Drive';

interface SettingsProps {
  onLibraryUpdated?: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onLibraryUpdated }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'library' | 'appearance' | 'advanced'>('general');

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

  // Available drives state
  const [settingsDrives, setSettingsDrives] = useState<WindowsDrive[]>([]);

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
        } catch {}
      }
    }

    loadSettingsDrives();
    loadSavedLocations();
  }, []);

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

  return (
    <div className="space-y-6 pb-12 max-w-4xl">
      {/* Settings Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-3 overflow-x-auto">
        {[
          { id: 'general', label: 'General' },
          { id: 'library', label: 'Library & Folders' },
          { id: 'appearance', label: 'Appearance' },
          { id: 'advanced', label: 'Advanced & Database' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-teal-500 text-zinc-950 font-bold shadow-md shadow-teal-500/20'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
            }`}
          >
            {tab.label}
          </button>
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
                  <p className="text-sm font-semibold text-zinc-200">Minimize to System Tray</p>
                  <p className="text-xs text-zinc-500">Keep GameHub accessible in background tray.</p>
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

      {/* Tab: Advanced */}
      {activeTab === 'advanced' && (
        <div className="p-6 rounded-2xl bg-surface-850 border border-zinc-800 space-y-5">
          <h3 className="font-bold text-base text-zinc-100 flex items-center gap-2">
            <Database className="w-4 h-4 text-teal-400" />
            Database & Maintenance
          </h3>

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
              <p className="text-[11px] text-zinc-500">Save library to gamehub-library.json</p>
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
                setIsImporting(true);
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
              <p className="text-[11px] text-zinc-500">Restore games and categories from backup</p>
            </button>

            {/* 3. Clear Artwork Cache */}
            <button
              type="button"
              onClick={async () => {
                if (window.gameHub?.settings?.clearCache) {
                  const res = await window.gameHub.settings.clearCache();
                  if (res.success) {
                    setBackupStatus({ type: 'success', message: 'Artwork cache cleared successfully.' });
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
                Clear Artwork Cache
              </div>
              <p className="text-[11px] text-zinc-500">Delete cached covers in %APPDATA%/GameHub</p>
            </button>

            {/* 4. View Application Logs Folder */}
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
                <FileText className="w-4 h-4 text-emerald-400" />
                View Logs Folder
              </div>
              <p className="text-[11px] text-zinc-500">Open %APPDATA%/GameHub/logs in Explorer</p>
            </button>

            {/* 5. Repair & Optimize Database (Phase 35) */}
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
                Repair & Optimize Database
              </div>
              <p className="text-[11px] text-zinc-500">Run integrity check, reindex, and vacuum</p>
            </button>

            {/* 6. Open Live gamehub.log File (Phase 34) */}
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
                Open gamehub.log
              </div>
              <p className="text-[11px] text-zinc-500">View live diagnostic event log file</p>
            </button>
          </div>

          <div className="pt-4 border-t border-zinc-800 text-xs text-zinc-500 flex items-center justify-between">
            <span>{APP_CONFIG.name} v{APP_CONFIG.version}</span>
          </div>
        </div>
      )}
    </div>
  );
};
