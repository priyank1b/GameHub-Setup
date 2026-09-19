import React, { useState, useEffect } from 'react';
import { HardDrive, CheckSquare, Square, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';
import { WindowsDrive } from '../types/Drive';
import { Game } from '../types/Game';

interface DrivesProps {
  games?: Game[];
}

export const Drives: React.FC<DrivesProps> = ({ games = [] }) => {
  const [drives, setDrives] = useState<WindowsDrive[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadDrives = async () => {
    if (window.gameHub?.drives) {
      try {
        const detected = await window.gameHub.drives.getAvailable();
        setDrives(detected);
        setIsLoading(false);
        return;
      } catch (err: any) {
        console.error('[Drives] Failed to load drives via IPC:', err.message);
      }
    }

    // In dev browser mode, query the live dev API
    try {
      const res = await fetch('/api/drives');
      if (res.ok) {
        const realDrives = await res.json();
        setDrives(realDrives);
        setIsLoading(false);
        return;
      }
    } catch {
      // Fallback
    }

    setIsLoading(false);
  };

  useEffect(() => {
    loadDrives();
  }, []);

  const toggleDrive = async (letter: string) => {
    const targetDrive = drives.find((d) => d.letter === letter);
    if (!targetDrive) return;

    const nextIncluded = !targetDrive.isIncluded;

    // Optimistic UI update
    setDrives((prev) =>
      prev.map((d) => (d.letter === letter ? { ...d, isIncluded: nextIncluded } : d))
    );

    // Persist via IPC
    if (window.gameHub?.drives) {
      try {
        await window.gameHub.drives.toggleInclusion(letter, nextIncluded);
      } catch (err: any) {
        console.error('[Drives] Failed to persist toggle via IPC:', err.message);
      }
    }
  };

  const formatGB = (bytes: number) => {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadDrives();
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  };

  const getGameCountForDrive = (driveLetter: string) => {
    return games.filter(
      (g) => g.drive?.toUpperCase() === driveLetter.toUpperCase()
    ).length;
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-surface-850 border border-zinc-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
            <HardDrive className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white font-['Outfit']">Detected Windows Drives</h2>
            <p className="text-xs text-zinc-400">
              Real-time drive discovery. Select which drives GameHub scans for game installations.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 border border-zinc-700 transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-teal-400 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>{isRefreshing ? 'Scanning Drives...' : 'Refresh Drives'}</span>
        </button>
      </div>

      {/* Drives Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {drives.map((drive) => {
          const gameCount = getGameCountForDrive(drive.letter);

          return (
            <div
              key={drive.letter}
              className={`p-5 rounded-2xl border transition-all ${
                drive.isIncluded
                  ? 'bg-surface-850 border-teal-500/40 shadow-lg shadow-teal-500/5'
                  : 'bg-surface-850/50 border-zinc-800/80 opacity-70'
              }`}
            >
              {/* Drive Letter & Toggle */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-black font-mono text-teal-400 bg-teal-500/10 px-3 py-1 rounded-xl border border-teal-500/20">
                    {drive.letter}
                  </span>
                  <div>
                    <h3 className="font-bold text-sm text-zinc-100 line-clamp-1">{drive.name}</h3>
                    <div className="flex items-center gap-2 text-[11px] text-zinc-500 font-mono">
                      <span>{drive.driveType}</span>
                      <span>&bull;</span>
                      <span className="text-teal-400 font-semibold">{gameCount} games indexed</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => toggleDrive(drive.letter)}
                  className="text-zinc-400 hover:text-white p-1 rounded transition-colors cursor-pointer"
                  title={drive.isIncluded ? 'Exclude from scan' : 'Include in scan'}
                >
                  {drive.isIncluded ? (
                    <CheckSquare className="w-5 h-5 text-teal-400" />
                  ) : (
                    <Square className="w-5 h-5 text-zinc-600" />
                  )}
                </button>
              </div>

              {/* Progress Bar Meter */}
              <div className="space-y-1.5 pt-2">
                <div className="w-full h-2 rounded-full bg-zinc-900 overflow-hidden border border-zinc-800">
                  <div
                    className={`h-full transition-all duration-500 ${
                      drive.usedPercent > 90 ? 'bg-rose-500' : 'bg-teal-500'
                    }`}
                    style={{ width: `${drive.usedPercent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                  <span>{formatGB(drive.availableBytes)} free</span>
                  <span>{formatGB(drive.totalBytes)} total</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Disconnected Drive Safety Note */}
      <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-400 flex items-center gap-3">
        <AlertCircle className="w-4 h-4 text-teal-400 flex-shrink-0" />
        <span>
          <strong>Hotplug Resilience</strong>: Removable USB drives and external SSDs are automatically recognized. Disconnecting an external drive will not crash GameHub; associated games will be cleanly marked offline.
        </span>
      </div>
    </div>
  );
};
