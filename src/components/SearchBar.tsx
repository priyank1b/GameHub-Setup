import React from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  className?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  onSubmit,
  placeholder = 'Search games by title, developer, publisher, or genre...',
  className = '',
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (value) {
        onChange('');
      } else {
        (e.target as HTMLInputElement).blur();
      }
    } else if (e.key === 'Enter') {
      if (onSubmit) {
        onSubmit();
      }
    }
  };

  return (
    <div className={`relative flex items-center w-full max-w-md no-drag ${className}`}>
      <Search className="absolute left-3.5 w-4 h-4 text-zinc-500 pointer-events-none" />
      <input
        id="global-search-input"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full pl-10 pr-20 py-2 rounded-xl bg-surface-850/90 border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-teal-500/60 focus:ring-2 focus:ring-teal-500/20 transition-all"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-3 p-1 text-zinc-500 hover:text-zinc-300 rounded-md transition-colors"
          title="Clear search"
        >
          <X className="w-4 h-4" />
        </button>
      ) : (
        <div className="absolute right-3 flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-zinc-800/80 border border-zinc-700 text-[10px] font-mono text-zinc-400 pointer-events-none">
          <span>Ctrl</span>
          <span>+</span>
          <span>K</span>
        </div>
      )}
    </div>
  );
};
