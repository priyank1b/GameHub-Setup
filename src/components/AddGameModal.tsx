import React, { useState, useEffect } from 'react';
import { X, Plus, Gamepad2, Folder, Image, Check, AlertCircle } from 'lucide-react';
import { GameLauncher } from '../types/Launcher';
import { Game } from '../types/Game';
import { useNavigation } from '../context/NavigationContext';
import { FocusableItem } from './FocusableItem';

interface AddGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (game: Partial<Game>) => void;
}

export const AddGameModal: React.FC<AddGameModalProps> = ({ isOpen, onClose, onAdd }) => {
  const { pushModal, popModal } = useNavigation();
  const [name, setName] = useState('');
  const [executablePath, setExecutablePath] = useState('');
  const [installPath, setInstallPath] = useState('');
  const [launcher, setLauncher] = useState<GameLauncher>('STANDALONE');
  const [coverImage, setCoverImage] = useState('');
  const [backgroundImage, setBackgroundImage] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      pushModal('add-game-modal', 'add-game-submit-btn');
      return () => {
        popModal('add-game-modal');
      };
    }
  }, [isOpen, pushModal, popModal]);

  if (!isOpen) return null;

  const handleBrowseExe = async () => {
    if (window.gameHub?.dialog) {
      try {
        const result = await window.gameHub.dialog.selectExecutable();
        if (result) {
          setExecutablePath(result.filePath);
          if (!name.trim()) {
            setName(result.suggestedName);
          }
          if (!installPath.trim()) {
            setInstallPath(result.folderPath);
          }
          setValidationError(null);
        }
      } catch (err: any) {
        console.error('[AddGameModal] Failed to open exe picker:', err.message);
      }
    } else {
      // Browser fallback demo
      setExecutablePath('C:\\Games\\SampleGame\\game.exe');
      if (!name.trim()) setName('Sample Game');
      if (!installPath.trim()) setInstallPath('C:\\Games\\SampleGame');
    }
  };

  const handleBrowseFolder = async () => {
    if (window.gameHub?.dialog) {
      try {
        const folder = await window.gameHub.dialog.selectFolder();
        if (folder) {
          setInstallPath(folder);
        }
      } catch (err: any) {
        console.error('[AddGameModal] Failed to open folder picker:', err.message);
      }
    } else {
      setInstallPath('C:\\Games\\SampleGame');
    }
  };

  const handleBrowseCover = async () => {
    if (window.gameHub?.dialog) {
      try {
        const img = await window.gameHub.dialog.selectImage();
        if (img) setCoverImage(img);
      } catch (err: any) {
        console.error('[AddGameModal] Failed to open image picker:', err.message);
      }
    }
  };

  const handleBrowseBackground = async () => {
    if (window.gameHub?.dialog) {
      try {
        const img = await window.gameHub.dialog.selectImage();
        if (img) setBackgroundImage(img);
      } catch (err: any) {
        console.error('[AddGameModal] Failed to open image picker:', err.message);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!name.trim()) {
      setValidationError('Please specify a game name.');
      return;
    }

    if (launcher === 'STANDALONE' && !executablePath.trim()) {
      setValidationError('Executable path is required for standalone games.');
      return;
    }

    if (executablePath.trim() && !executablePath.toLowerCase().endsWith('.exe')) {
      setValidationError('Executable path must point to a valid .exe file.');
      return;
    }

    onAdd({
      name: name.trim(),
      executablePath: executablePath.trim() || undefined,
      installPath: installPath.trim() || undefined,
      launcher,
      coverImage: coverImage.trim() || undefined,
      backgroundImage: backgroundImage.trim() || undefined,
      isFavorite: false,
      isInstalled: true,
      isManual: true,
      totalPlayTime: 0,
      drive: executablePath.match(/^[a-zA-Z]:/)?.[0]?.toUpperCase() || 'C:',
    });

    setName('');
    setExecutablePath('');
    setInstallPath('');
    setCoverImage('');
    setBackgroundImage('');
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-3xl bg-surface-850 border border-zinc-800 shadow-2xl p-6 space-y-6 max-h-[92vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
              <Gamepad2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white font-['Outfit']">Add Game Manually</h3>
              <p className="text-xs text-zinc-400">Register a local game executable into GameHub</p>
            </div>
          </div>
          <FocusableItem
            id="add-game-close-btn"
            scope="add-game-modal"
            group="modal"
            onConfirm={onClose}
            onBack={onClose}
          >
            {({ ref, isFocused }) => (
              <button
                ref={ref}
                type="button"
                onClick={onClose}
                className={`text-zinc-500 hover:text-zinc-200 p-1.5 rounded-lg transition-colors cursor-pointer ${
                  isFocused ? 'controller-focus' : ''
                }`}
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </FocusableItem>
        </div>

        {/* Validation Error Banner */}
        {validationError && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Game Name */}
          <div>
            <label className="block text-zinc-300 font-semibold mb-1">Game Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Half-Life 2 or Grand Theft Auto"
              className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-teal-500/60"
            />
          </div>

          {/* Executable Path */}
          <div>
            <label className="block text-zinc-300 font-semibold mb-1">
              Game Executable (.exe) *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                required={launcher === 'STANDALONE'}
                value={executablePath}
                onChange={(e) => setExecutablePath(e.target.value)}
                placeholder="e.g. C:\Games\MyGame\game.exe"
                className="flex-1 px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder-zinc-500 font-mono text-[11px] focus:outline-none focus:border-teal-500/60"
              />
              <button
                type="button"
                onClick={handleBrowseExe}
                className="px-3.5 py-2 rounded-xl bg-surface-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-semibold transition-all cursor-pointer"
              >
                Browse...
              </button>
            </div>
          </div>

          {/* Installation Folder */}
          <div>
            <label className="block text-zinc-300 font-semibold mb-1">Installation Folder</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={installPath}
                onChange={(e) => setInstallPath(e.target.value)}
                placeholder="e.g. C:\Games\MyGame"
                className="flex-1 px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder-zinc-500 font-mono text-[11px] focus:outline-none focus:border-teal-500/60"
              />
              <button
                type="button"
                onClick={handleBrowseFolder}
                className="px-3.5 py-2 rounded-xl bg-surface-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 font-semibold transition-all cursor-pointer"
              >
                Browse...
              </button>
            </div>
          </div>

          {/* Launcher */}
          <div>
            <label className="block text-zinc-300 font-semibold mb-1">Launcher / Source</label>
            <select
              value={launcher}
              onChange={(e) => setLauncher(e.target.value as GameLauncher)}
              className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 focus:outline-none focus:border-teal-500/60 font-semibold"
            >
              <option value="STANDALONE">Standalone Executable</option>
              <option value="STEAM">Steam</option>
              <option value="EPIC">Epic Games</option>
              <option value="GOG">GOG</option>
              <option value="XBOX">Xbox / Microsoft Store</option>
            </select>
          </div>

          {/* Cover Image */}
          <div>
            <label className="block text-zinc-300 font-semibold mb-1">
              Cover Image (File or URL)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={coverImage}
                onChange={(e) => setCoverImage(e.target.value)}
                placeholder="File path or https://... image URL"
                className="flex-1 px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder-zinc-500 font-mono text-[11px] focus:outline-none focus:border-teal-500/60"
              />
              <button
                type="button"
                onClick={handleBrowseCover}
                className="px-3 py-2 rounded-xl bg-surface-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-all cursor-pointer"
              >
                Browse...
              </button>
            </div>
          </div>

          {/* Background Image */}
          <div>
            <label className="block text-zinc-300 font-semibold mb-1">
              Background Artwork (Optional)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={backgroundImage}
                onChange={(e) => setBackgroundImage(e.target.value)}
                placeholder="File path or https://... image URL"
                className="flex-1 px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder-zinc-500 font-mono text-[11px] focus:outline-none focus:border-teal-500/60"
              />
              <button
                type="button"
                onClick={handleBrowseBackground}
                className="px-3 py-2 rounded-xl bg-surface-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-all cursor-pointer"
              >
                Browse...
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-zinc-800 flex items-center justify-end gap-3">
            <FocusableItem
              id="add-game-cancel-btn"
              scope="add-game-modal"
              group="modal"
              onConfirm={onClose}
              onBack={onClose}
            >
              {({ ref, isFocused }) => (
                <button
                  ref={ref}
                  type="button"
                  onClick={onClose}
                  className={`px-4 py-2 rounded-xl bg-surface-800 hover:bg-zinc-700 text-zinc-300 font-semibold transition-colors cursor-pointer ${
                    isFocused ? 'controller-focus' : ''
                  }`}
                >
                  Cancel
                </button>
              )}
            </FocusableItem>

            <FocusableItem
              id="add-game-submit-btn"
              scope="add-game-modal"
              group="modal"
              onConfirm={() => {
                const submitEvent = new Event('submit', { cancelable: true, bubbles: true });
                document.querySelector('form')?.dispatchEvent(submitEvent);
              }}
              onBack={onClose}
            >
              {({ ref, isFocused }) => (
                <button
                  ref={ref}
                  type="submit"
                  className={`px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-zinc-950 font-bold shadow-lg shadow-teal-500/20 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${
                    isFocused ? 'controller-focus' : ''
                  }`}
                >
                  Add Game
                </button>
              )}
            </FocusableItem>
          </div>
        </form>
      </div>
    </div>
  );
};
