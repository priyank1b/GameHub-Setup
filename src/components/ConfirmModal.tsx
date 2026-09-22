import React, { useEffect } from 'react';
import { AlertTriangle, Trash2, EyeOff, Info, X } from 'lucide-react';
import { FocusableItem } from './FocusableItem';

export type ConfirmModalType = 'danger' | 'warning' | 'info';

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  subMessage?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  type?: ConfirmModalType;
  icon?: 'trash' | 'eye-off' | 'alert' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  subMessage,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  type = 'warning',
  icon,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        onConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel, onConfirm]);

  if (!isOpen) return null;

  const renderIcon = () => {
    const chosenIcon = icon || (type === 'danger' ? 'trash' : type === 'warning' ? 'eye-off' : 'info');
    switch (chosenIcon) {
      case 'trash':
        return <Trash2 className="w-5 h-5" />;
      case 'eye-off':
        return <EyeOff className="w-5 h-5" />;
      case 'alert':
        return <AlertTriangle className="w-5 h-5" />;
      case 'info':
      default:
        return <Info className="w-5 h-5" />;
    }
  };

  const getIconWrapperClasses = () => {
    switch (type) {
      case 'danger':
        return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
      case 'warning':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
      case 'info':
      default:
        return 'bg-teal-500/10 text-teal-400 border border-teal-500/20';
    }
  };

  const getConfirmBtnClasses = (isFocused = false) => {
    const focusRing = isFocused ? 'ring-2 ring-white scale-105' : '';
    switch (type) {
      case 'danger':
        return `bg-rose-500 hover:bg-rose-400 text-zinc-950 font-bold shadow-lg shadow-rose-500/20 ${focusRing}`;
      case 'warning':
        return `bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold shadow-lg shadow-amber-500/20 ${focusRing}`;
      case 'info':
      default:
        return `bg-teal-500 hover:bg-teal-400 text-zinc-950 font-bold shadow-lg shadow-teal-500/20 ${focusRing}`;
    }
  };

  return (
    <div
      onClick={onCancel}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md select-none animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-3xl bg-surface-850 border border-zinc-800 shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-2xl flex-shrink-0 ${getIconWrapperClasses()}`}>
              {renderIcon()}
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-['Outfit'] leading-tight">
                {title}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="p-1 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="space-y-3">
          <p className="text-xs text-zinc-200 leading-relaxed font-medium">
            {message}
          </p>

          {subMessage && (
            <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800/80 text-[11px] text-zinc-400 leading-relaxed whitespace-pre-line">
              {subMessage}
            </div>
          )}
        </div>

        {/* Actions Footer */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-800/80">
          <FocusableItem
            id="confirm-modal-cancel-btn"
            scope="modal"
            group="confirm-modal"
            onConfirm={onCancel}
          >
            {({ ref, isFocused }) => (
              <button
                ref={ref}
                type="button"
                onClick={onCancel}
                className={`px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-semibold border border-zinc-700/60 transition-all cursor-pointer ${
                  isFocused ? 'controller-focus' : ''
                }`}
              >
                {cancelLabel}
              </button>
            )}
          </FocusableItem>

          <FocusableItem
            id="confirm-modal-confirm-btn"
            scope="modal"
            group="confirm-modal"
            onConfirm={onConfirm}
          >
            {({ ref, isFocused }) => (
              <button
                ref={ref}
                type="button"
                onClick={onConfirm}
                className={`px-4 py-2 rounded-xl text-xs transition-all cursor-pointer ${getConfirmBtnClasses(
                  isFocused
                )}`}
              >
                {confirmLabel}
              </button>
            )}
          </FocusableItem>
        </div>
      </div>
    </div>
  );
};
