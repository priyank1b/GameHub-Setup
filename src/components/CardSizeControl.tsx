import React, { useState, useRef, useEffect } from 'react';
import { LayoutGrid, RotateCcw, Minus, Plus, ChevronDown, Sliders } from 'lucide-react';
import { useCardSize, MIN_CARD_SIZE, MAX_CARD_SIZE, DEFAULT_CARD_SIZE } from '../context/CardSizeContext';

interface CardSizeControlProps {
  variant?: 'popover' | 'inline' | 'compact';
  className?: string;
}

export const CardSizeControl: React.FC<CardSizeControlProps> = ({
  variant = 'popover',
  className = '',
}) => {
  const { cardSize, setCardSize, resetCardSize, presets } = useCardSize();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleDecrease = () => {
    setCardSize(Math.max(MIN_CARD_SIZE, cardSize - 10));
  };

  const handleIncrease = () => {
    setCardSize(Math.min(MAX_CARD_SIZE, cardSize + 10));
  };

  // Compact +/- inline stepper variant
  if (variant === 'compact') {
    return (
      <div className={`inline-flex items-center gap-1 bg-zinc-900/80 p-1 rounded-xl border border-zinc-800 text-xs ${className}`}>
        <button
          type="button"
          onClick={handleDecrease}
          disabled={cardSize <= MIN_CARD_SIZE}
          className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title={`Smaller cards (${cardSize - 10}px)`}
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <span className="font-mono text-[11px] px-1.5 text-zinc-300 font-semibold min-w-[42px] text-center select-none">
          {cardSize}px
        </span>
        <button
          type="button"
          onClick={handleIncrease}
          disabled={cardSize >= MAX_CARD_SIZE}
          className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title={`Larger cards (${cardSize + 10}px)`}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // Inline full slider variant (e.g. for settings)
  if (variant === 'inline') {
    return (
      <div className={`space-y-3 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-4 h-4 text-teal-400" />
            <span className="text-sm font-semibold text-white">Card Size</span>
          </div>
          <span className="font-mono text-xs text-teal-400 font-bold bg-teal-500/10 px-2 py-0.5 rounded-lg border border-teal-500/20">
            {cardSize}px
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Minus className="w-3.5 h-3.5 text-zinc-500 cursor-pointer" onClick={handleDecrease} />
          <input
            type="range"
            min={MIN_CARD_SIZE}
            max={MAX_CARD_SIZE}
            step={10}
            value={cardSize}
            onChange={(e) => setCardSize(Number(e.target.value))}
            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-teal-400"
          />
          <Plus className="w-3.5 h-3.5 text-zinc-500 cursor-pointer" onClick={handleIncrease} />
        </div>
        <div className="flex items-center justify-between gap-1.5 pt-1">
          {presets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => setCardSize(preset.size)}
              className={`px-2 py-1 rounded-lg text-[11px] font-medium transition-all ${
                cardSize === preset.size
                  ? 'bg-teal-500 text-zinc-950 font-bold shadow-sm'
                  : 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Default: Popover variant for TopBar
  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer shadow-sm active:scale-95 ${
          isOpen
            ? 'bg-teal-500/20 border-teal-500/50 text-teal-300'
            : 'bg-surface-850 hover:bg-zinc-800 border-zinc-800 text-zinc-300 hover:text-white'
        }`}
        title="Adjust Game Card Size (Scale cards smaller or bigger)"
        aria-expanded={isOpen}
      >
        <LayoutGrid className="w-3.5 h-3.5 text-teal-400" />
        <span className="hidden sm:inline">Size</span>
        <span className="font-mono text-[10px] text-zinc-400 bg-zinc-900/80 px-1.5 py-0.5 rounded-md border border-zinc-700/50">
          {cardSize}px
        </span>
        <ChevronDown className={`w-3 h-3 text-zinc-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-teal-400' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-surface-900/95 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-100 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-teal-400" />
              <div>
                <p className="text-xs font-bold text-white">Card Display Size</p>
                <p className="text-[10px] text-zinc-400">Scale cards smaller or bigger</p>
              </div>
            </div>

            {cardSize !== DEFAULT_CARD_SIZE && (
              <button
                type="button"
                onClick={resetCardSize}
                className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-teal-400 transition-colors p-1 rounded-md hover:bg-zinc-800 cursor-pointer"
                title="Reset to default 180px"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>

          {/* Slider and Size Indicators */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400">Card Width</span>
              <span className="font-mono text-teal-400 font-bold text-xs bg-teal-500/10 px-2 py-0.5 rounded-md border border-teal-500/20">
                {cardSize}px
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleDecrease}
                disabled={cardSize <= MIN_CARD_SIZE}
                className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                title="Smaller (-10px)"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>

              <input
                type="range"
                min={MIN_CARD_SIZE}
                max={MAX_CARD_SIZE}
                step={10}
                value={cardSize}
                onChange={(e) => setCardSize(Number(e.target.value))}
                className="flex-1 h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-teal-400"
              />

              <button
                type="button"
                onClick={handleIncrease}
                disabled={cardSize >= MAX_CARD_SIZE}
                className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none transition-colors"
                title="Larger (+10px)"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex justify-between text-[10px] text-zinc-500 font-mono px-0.5">
              <span>{MIN_CARD_SIZE}px (Min)</span>
              <span>{MAX_CARD_SIZE}px (Max)</span>
            </div>

            {/* Dynamic hint based on size */}
            <p className="text-[11px] text-zinc-400 bg-surface-850 p-2 rounded-xl border border-zinc-800/80 text-center">
              {cardSize <= 150 ? (
                <span>⚡ <strong>Compact</strong>: Most cards in a row. Great for high-res monitors.</span>
              ) : cardSize <= 190 ? (
                <span>✨ <strong>Standard</strong>: Balanced view with clean detail.</span>
              ) : cardSize <= 240 ? (
                <span>🎨 <strong>Large</strong>: Rich showcase view with prominent posters.</span>
              ) : (
                <span>🖼️ <strong>Extra Large</strong>: Maximum poster showcase (fewest cards / row).</span>
              )}
            </p>
          </div>

          {/* Quick Presets */}
          <div className="space-y-1.5 pt-1 border-t border-zinc-800/80">
            <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500 font-semibold">
              Presets
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {presets.map((preset) => {
                const isActive = cardSize === preset.size;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setCardSize(preset.size)}
                    className={`flex flex-col items-start p-2 rounded-xl border text-left transition-all cursor-pointer ${
                      isActive
                        ? 'bg-teal-500/15 border-teal-500/50 text-teal-300 shadow-sm'
                        : 'bg-zinc-900 border-zinc-800/80 text-zinc-300 hover:bg-zinc-800 hover:text-white'
                    }`}
                  >
                    <span className="text-xs font-semibold">{preset.label}</span>
                    <span className="text-[10px] font-mono text-zinc-500">{preset.size}px</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
