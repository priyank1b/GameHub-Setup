import React from 'react';
import { GameLauncher, LAUNCHER_CONFIG } from '../types/Launcher';

interface LauncherBadgeProps {
  launcher: GameLauncher;
  size?: 'sm' | 'md';
}

export const LauncherBadge: React.FC<LauncherBadgeProps> = ({ launcher, size = 'sm' }) => {
  const config = LAUNCHER_CONFIG[launcher] || LAUNCHER_CONFIG.UNKNOWN;

  const sizeClasses = size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1';

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border backdrop-blur-md font-mono tracking-wide ${config.bgColor} ${config.color} ${config.borderColor} ${sizeClasses}`}
    >
      {config.name}
    </span>
  );
};
