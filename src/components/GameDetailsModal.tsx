import React, { useState, useEffect } from 'react';
import { Game } from '../types/Game';
import {
  X,
  Play,
  Star,
  FolderOpen,
  Calendar,
  Clock,
  HardDrive,
  Gamepad2,
  AlertTriangle,
  FolderSearch,
  Trash2,
  Edit3,
  Copy,
  Check,
  Image as ImageIcon,
  Save,
  RotateCcw,
} from 'lucide-react';
import { LauncherBadge } from './LauncherBadge';
import { formatImageUrl } from '../utils/formatImage';
import { useNavigation } from '../context/NavigationContext';
import { FocusableItem } from './FocusableItem';

interface GameDetailsModalProps {
  game: Game | null;
  onClose: () => void;
  onLaunch: (game: Game) => void;
  onToggleFavorite: (id: number) => void;
  onUpdateGame?: (updatedGame: Game) => void;
  onLocate?: (game: Game) => void;
  onRemove?: (game: Game) => void;
}

export const GameDetailsModal: React.FC<GameDetailsModalProps> = ({
  game,
  onClose,
  onLaunch,
  onToggleFavorite,
  onUpdateGame,
  onLocate,
  onRemove,
}) => {
  const { pushModal, popModal } = useNavigation();
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (game) {
      pushModal('game-details-modal', 'modal-play-btn');
      return () => {
        popModal('game-details-modal');
      };
    }
  }, [game, pushModal, popModal]);

  // Edit form state
  const [editForm, setEditForm] = useState({
    name: '',
    genre: '',
    developer: '',
    publisher: '',
    releaseDate: '',
    description: '',
    coverImage: '',
    backgroundImage: '',
  });

  useEffect(() => {
    if (game) {
      setEditForm({
        name: game.name || '',
        genre: game.genre || '',
        developer: game.developer || '',
        publisher: game.publisher || '',
        releaseDate: game.releaseDate || '',
        description: game.description || '',
        coverImage: game.coverImage || '',
        backgroundImage: game.backgroundImage || '',
      });
      setIsEditing(false);
    }
  }, [game]);

  if (!game) return null;

  const isMissing = !game.isInstalled;

  const formatPlayTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours === 0) return `${minutes} minutes`;
    return `${hours} hours ${minutes} minutes`;
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return 'Unknown';
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const formatLastPlayed = (dateString?: string | null) => {
    if (!dateString) return 'Never';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Never';
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Never';
    }
  };

  const handleCopyPath = () => {
    const pathText = game.installPath || game.executablePath || '';
    if (!pathText) return;
    navigator.clipboard.writeText(pathText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSelectLocalImage = async (field: 'coverImage' | 'backgroundImage') => {
    if (window.gameHub?.dialog?.selectImage) {
      const imgPath = await window.gameHub.dialog.selectImage();
      if (imgPath) {
        setEditForm((prev) => ({ ...prev, [field]: imgPath }));
      }
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!game) return;
    setIsSaving(true);
    try {
      if (window.gameHub?.games?.update) {
        const updated = await window.gameHub.games.update(game.id, {
          name: editForm.name.trim() || game.name,
          genre: editForm.genre.trim() || undefined,
          developer: editForm.developer.trim() || undefined,
          publisher: editForm.publisher.trim() || undefined,
          releaseDate: editForm.releaseDate.trim() || undefined,
          description: editForm.description.trim() || undefined,
          coverImage: editForm.coverImage.trim() || undefined,
          backgroundImage: editForm.backgroundImage.trim() || undefined,
        });

        if (updated) {
          onUpdateGame?.(updated);
        }
      }
      setIsEditing(false);
    } catch (err: any) {
      console.error('Failed to update game details:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 bg-black/80 backdrop-blur-md select-none"
      data-testid="game-details-modal"
    >
      <div
        id="game-details-modal-scroll"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl bg-surface-850 border border-zinc-800 shadow-2xl space-y-6"
      >
        {/* Banner with Background Image */}
        <div className="relative h-64 sm:h-72 w-full overflow-hidden bg-zinc-900 rounded-t-3xl">
          <img
            src={formatImageUrl(
              (isEditing ? editForm.backgroundImage : game.backgroundImage) ||
                (isEditing ? editForm.coverImage : game.coverImage)
            )}
            alt={game.name}
            className={`w-full h-full object-cover filter blur-[2px] opacity-40 scale-105 ${
              isMissing ? 'grayscale-[40%]' : ''
            }`}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-surface-850 via-surface-850/60 to-transparent" />

          {/* Close button */}
          <FocusableItem
            id="modal-close-btn"
            scope="game-details-modal"
            group="modal"
            onConfirm={onClose}
            onBack={onClose}
          >
            {({ ref, isFocused }) => (
              <button
                ref={ref}
                type="button"
                onClick={onClose}
                className={`absolute top-4 right-4 p-2 rounded-full bg-black/50 hover:bg-black/80 text-zinc-300 hover:text-white transition-all z-20 cursor-pointer ${
                  isFocused ? 'controller-focus' : ''
                }`}
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </FocusableItem>

          {/* Floating Details Header */}
          <div className="absolute bottom-6 left-6 right-6 flex items-end gap-6 z-10">
            <div className="w-28 h-36 rounded-2xl overflow-hidden shadow-2xl border-2 border-zinc-700/80 bg-zinc-900 flex-shrink-0 relative group">
              {(isEditing ? editForm.coverImage : game.coverImage) ? (
                <img
                  src={formatImageUrl(isEditing ? editForm.coverImage : game.coverImage)}
                  alt={game.name}
                  className={`w-full h-full object-cover ${isMissing ? 'grayscale-[35%]' : ''}`}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-600">
                  <Gamepad2 className="w-10 h-10" />
                </div>
              )}
            </div>

            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <LauncherBadge launcher={game.launcher} />
                {isMissing && (
                  <span className="inline-flex items-center gap-1 bg-amber-500/90 text-zinc-950 font-bold px-2 py-0.5 rounded text-[11px] tracking-wider uppercase shadow-md">
                    <AlertTriangle className="w-3.5 h-3.5 text-zinc-950" />
                    Missing
                  </span>
                )}
                {game.genre && (
                  <span className="text-xs text-zinc-400 font-medium">{game.genre}</span>
                )}
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white font-['Outfit'] line-clamp-2">
                {game.name}
              </h2>
            </div>
          </div>
        </div>

        {/* Missing Game Warning Notice */}
        {isMissing && (
          <div className="mx-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3.5 text-amber-200">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <div className="font-bold text-amber-300 text-sm">Game Files Missing or Moved</div>
              <p className="text-zinc-300 leading-relaxed">
                The game executable or installation folder could not be located at{' '}
                <code className="text-[11px] font-mono bg-zinc-900/80 px-1.5 py-0.5 rounded text-zinc-200 border border-zinc-700/50">
                  {game.executablePath || game.installPath || 'unknown path'}
                </code>
                . If you moved the game, click <span className="text-amber-300 font-semibold">Locate Game</span> to re-link it, or remove it from your library.
              </p>
            </div>
          </div>
        )}

        {/* Action Controls */}
        <div className="px-6 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            {/* Button 1: PLAY */}
            {isMissing ? (
              <FocusableItem
                id="modal-play-btn"
                scope="game-details-modal"
                group="modal-actions"
                onConfirm={() => onLocate?.(game)}
                onBack={onClose}
              >
                {({ ref, isFocused }) => (
                  <button
                    ref={ref}
                    type="button"
                    onClick={() => onLocate?.(game)}
                    className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-sm tracking-wide shadow-lg shadow-amber-500/20 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${
                      isFocused ? 'controller-focus' : ''
                    }`}
                  >
                    <FolderSearch className="w-4 h-4 text-zinc-950" />
                    <span>LOCATE GAME</span>
                  </button>
                )}
              </FocusableItem>
            ) : (
              <FocusableItem
                id="modal-play-btn"
                scope="game-details-modal"
                group="modal-actions"
                onConfirm={() => onLaunch(game)}
                onBack={onClose}
              >
                {({ ref, isFocused }) => (
                  <button
                    ref={ref}
                    type="button"
                    onClick={() => onLaunch(game)}
                    className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-zinc-950 font-bold text-sm tracking-wide shadow-lg shadow-teal-500/20 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${
                      isFocused ? 'controller-focus' : ''
                    }`}
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>PLAY NOW</span>
                  </button>
                )}
              </FocusableItem>
            )}

            {/* Button 2: FAVORITE */}
            <FocusableItem
              id="modal-favorite-btn"
              scope="game-details-modal"
              group="modal-actions"
              onConfirm={() => onToggleFavorite(game.id)}
              onBack={onClose}
            >
              {({ ref, isFocused }) => (
                <button
                  ref={ref}
                  type="button"
                  onClick={() => onToggleFavorite(game.id)}
                  className={`inline-flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-semibold transition-all cursor-pointer ${
                    game.isFavorite
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                      : 'bg-surface-800 border-zinc-700 text-zinc-300 hover:text-white'
                  } ${isFocused ? 'controller-focus' : ''}`}
                >
                  <Star className={`w-4 h-4 ${game.isFavorite ? 'fill-current' : ''}`} />
                  <span>{game.isFavorite ? 'Favorited' : 'Favorite'}</span>
                </button>
              )}
            </FocusableItem>
          </div>

          <div className="flex items-center gap-2">
            {/* Button 3: OPEN FOLDER */}
            {!isMissing && (
              <FocusableItem
                id="modal-open-folder-btn"
                scope="game-details-modal"
                group="modal-actions"
                onConfirm={() => {
                  if (window.gameHub?.games?.openFolder) {
                    window.gameHub.games.openFolder(game.id);
                  }
                }}
                onBack={onClose}
              >
                {({ ref, isFocused }) => (
                  <button
                    ref={ref}
                    type="button"
                    onClick={() => {
                      if (window.gameHub?.games?.openFolder) {
                        window.gameHub.games.openFolder(game.id);
                      }
                    }}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-semibold text-zinc-300 transition-colors cursor-pointer ${
                      isFocused ? 'controller-focus' : ''
                    }`}
                  >
                    <FolderOpen className="w-4 h-4 text-zinc-400" />
                    <span>Open Folder</span>
                  </button>
                )}
              </FocusableItem>
            )}

            {/* Button 4: EDIT */}
            <FocusableItem
              id="modal-edit-btn"
              scope="game-details-modal"
              group="modal-actions"
              onConfirm={() => setIsEditing(!isEditing)}
              onBack={onClose}
            >
              {({ ref, isFocused }) => (
                <button
                  ref={ref}
                  type="button"
                  onClick={() => setIsEditing(!isEditing)}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer ${
                    isEditing
                      ? 'bg-teal-500/20 border-teal-500/40 text-teal-300'
                      : 'bg-surface-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300'
                  } ${isFocused ? 'controller-focus' : ''}`}
                >
                  <Edit3 className="w-4 h-4 text-teal-400" />
                  <span>{isEditing ? 'Cancel Edit' : 'Edit'}</span>
                </button>
              )}
            </FocusableItem>

            {/* Remove from Library */}
            <FocusableItem
              id="modal-remove-btn"
              scope="game-details-modal"
              group="modal-actions"
              onConfirm={() => onRemove?.(game)}
              onBack={onClose}
            >
              {({ ref, isFocused }) => (
                <button
                  ref={ref}
                  type="button"
                  onClick={() => onRemove?.(game)}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-xs font-semibold text-rose-300 transition-colors cursor-pointer ${
                    isFocused ? 'controller-focus' : ''
                  }`}
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Remove</span>
                </button>
              )}
            </FocusableItem>
          </div>
        </div>

        {/* Edit Form Section or View Section */}
        {isEditing ? (
          <form onSubmit={handleSaveEdit} className="px-6 pb-6 space-y-5">
            <div className="p-4 rounded-2xl bg-zinc-900/80 border border-teal-500/30 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-teal-400 flex items-center gap-2">
                  <Edit3 className="w-4 h-4" />
                  Edit Game Details
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="text-zinc-400 block mb-1 font-medium">Game Title</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full bg-surface-850 border border-zinc-700 text-zinc-100 rounded-xl px-3 py-2 focus:outline-none focus:border-teal-500/50"
                    placeholder="Game Name"
                    required
                  />
                </div>

                <div>
                  <label className="text-zinc-400 block mb-1 font-medium">Genre</label>
                  <input
                    type="text"
                    value={editForm.genre}
                    onChange={(e) => setEditForm({ ...editForm, genre: e.target.value })}
                    className="w-full bg-surface-850 border border-zinc-700 text-zinc-100 rounded-xl px-3 py-2 focus:outline-none focus:border-teal-500/50"
                    placeholder="Action, RPG, etc."
                  />
                </div>

                <div>
                  <label className="text-zinc-400 block mb-1 font-medium">Developer</label>
                  <input
                    type="text"
                    value={editForm.developer}
                    onChange={(e) => setEditForm({ ...editForm, developer: e.target.value })}
                    className="w-full bg-surface-850 border border-zinc-700 text-zinc-100 rounded-xl px-3 py-2 focus:outline-none focus:border-teal-500/50"
                    placeholder="Developer Studio"
                  />
                </div>

                <div>
                  <label className="text-zinc-400 block mb-1 font-medium">Publisher</label>
                  <input
                    type="text"
                    value={editForm.publisher}
                    onChange={(e) => setEditForm({ ...editForm, publisher: e.target.value })}
                    className="w-full bg-surface-850 border border-zinc-700 text-zinc-100 rounded-xl px-3 py-2 focus:outline-none focus:border-teal-500/50"
                    placeholder="Publisher Name"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-zinc-400 block mb-1 font-medium">Release Date</label>
                  <input
                    type="text"
                    value={editForm.releaseDate}
                    onChange={(e) => setEditForm({ ...editForm, releaseDate: e.target.value })}
                    className="w-full bg-surface-850 border border-zinc-700 text-zinc-100 rounded-xl px-3 py-2 focus:outline-none focus:border-teal-500/50"
                    placeholder="YYYY-MM-DD or Year"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-zinc-400 block mb-1 font-medium">Cover Image URL / Path</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editForm.coverImage}
                      onChange={(e) => setEditForm({ ...editForm, coverImage: e.target.value })}
                      className="flex-1 bg-surface-850 border border-zinc-700 text-zinc-100 rounded-xl px-3 py-2 focus:outline-none focus:border-teal-500/50"
                      placeholder="https://... or C:\path\to\cover.jpg"
                    />
                    <button
                      type="button"
                      onClick={() => handleSelectLocalImage('coverImage')}
                      className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-xs flex items-center gap-1.5"
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Browse...</span>
                    </button>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-zinc-400 block mb-1 font-medium">Background Image URL / Path</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editForm.backgroundImage}
                      onChange={(e) => setEditForm({ ...editForm, backgroundImage: e.target.value })}
                      className="flex-1 bg-surface-850 border border-zinc-700 text-zinc-100 rounded-xl px-3 py-2 focus:outline-none focus:border-teal-500/50"
                      placeholder="https://... or C:\path\to\background.jpg"
                    />
                    <button
                      type="button"
                      onClick={() => handleSelectLocalImage('backgroundImage')}
                      className="px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-xs flex items-center gap-1.5"
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Browse...</span>
                    </button>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-zinc-400 block mb-1 font-medium">Description</label>
                  <textarea
                    rows={3}
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="w-full bg-surface-850 border border-zinc-700 text-zinc-100 rounded-xl px-3 py-2 focus:outline-none focus:border-teal-500/50 leading-relaxed"
                    placeholder="Overview of the game..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl bg-surface-850 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-zinc-950 font-bold text-xs shadow-md shadow-teal-500/20 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </div>
          </form>
        ) : (
          /* Normal View Details Section */
          <div className="px-6 pb-6 space-y-6">
            {/* Description / About */}
            <FocusableItem
              id="modal-description-section"
              scope="game-details-modal"
              group="modal-body"
              onBack={onClose}
            >
              {({ ref, isFocused }) => (
                <div
                  ref={ref}
                  tabIndex={0}
                  className={`space-y-2 p-3.5 rounded-2xl transition-all focus:outline-none ${
                    isFocused ? 'ring-2 ring-teal-400/80 bg-teal-500/5' : ''
                  }`}
                >
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Description</h4>
                  <p className="text-sm text-zinc-300 leading-relaxed">
                    {game.description || 'No description available for this title.'}
                  </p>
                </div>
              )}
            </FocusableItem>

            {/* Metadata Specification Grid: Developer, Publisher, Genre, Release Date, Installed Size, Playtime, Last Played */}
            <FocusableItem
              id="modal-metadata-grid"
              scope="game-details-modal"
              group="modal-body"
              onBack={onClose}
            >
              {({ ref, isFocused }) => (
                <div
                  ref={ref}
                  tabIndex={0}
                  className={`grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-zinc-900/60 border text-xs transition-all focus:outline-none ${
                    isFocused ? 'border-teal-400/80 ring-2 ring-teal-400/80' : 'border-zinc-800'
                  }`}
                >
                  <div>
                    <span className="text-zinc-500 block mb-0.5">Developer</span>
                    <span className="text-zinc-200 font-medium">{game.developer || 'Unknown'}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block mb-0.5">Publisher</span>
                    <span className="text-zinc-200 font-medium">{game.publisher || 'Unknown'}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block mb-0.5">Genre</span>
                    <span className="text-zinc-200 font-medium">{game.genre || 'Action / Adventure'}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block mb-0.5">Release Date</span>
                    <span className="text-zinc-200 font-medium">{game.releaseDate || 'Unknown'}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block mb-0.5">Playtime</span>
                    <span className="text-teal-400 font-mono font-medium">
                      {formatPlayTime(game.totalPlayTime)}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block mb-0.5">Last Played</span>
                    <span className="text-zinc-300 font-mono font-medium">
                      {formatLastPlayed(game.lastPlayedAt)}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block mb-0.5">Installed Size</span>
                    <span className="text-zinc-200 font-mono font-medium">
                      {formatSize(game.installedSize)}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block mb-0.5">Drive</span>
                    <span className="text-zinc-200 font-mono font-medium">{game.drive || 'C:'}</span>
                  </div>
                </div>
              )}
            </FocusableItem>

            {/* Installation Path & Executable Path Details */}
            <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                  Installation Path
                </span>
                <FocusableItem
                  id="modal-copy-path-btn"
                  scope="game-details-modal"
                  group="modal-body"
                  onConfirm={handleCopyPath}
                  onBack={onClose}
                >
                  {({ ref, isFocused }) => (
                    <button
                      ref={ref}
                      type="button"
                      onClick={handleCopyPath}
                      className={`hover:text-zinc-200 transition-colors inline-flex items-center gap-1.5 text-[11px] text-zinc-400 cursor-pointer p-1 rounded-lg ${
                        isFocused ? 'controller-focus' : ''
                      }`}
                      title="Copy path to clipboard"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3 h-3 text-teal-400" />
                          <span className="text-teal-400 font-medium">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  )}
                </FocusableItem>
              </div>
              <div className="font-mono text-[11px] text-zinc-300 bg-surface-900 px-3 py-2 rounded-xl border border-zinc-800/80 break-all select-all">
                {game.installPath || 'Path not recorded'}
              </div>

              {game.executablePath && (
                <div className="space-y-1 pt-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    Executable File
                  </span>
                  <div className="font-mono text-[11px] text-zinc-400 bg-surface-900 px-3 py-1.5 rounded-xl border border-zinc-800/80 break-all select-all">
                    {game.executablePath}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
