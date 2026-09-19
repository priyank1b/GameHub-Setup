export type GameLauncher =
  | 'STEAM'
  | 'EPIC'
  | 'GOG'
  | 'XBOX'
  | 'EA'
  | 'UBISOFT'
  | 'BATTLE_NET'
  | 'ROCKSTAR'
  | 'STANDALONE'
  | 'UNKNOWN';

export interface LauncherInfo {
  id: GameLauncher;
  name: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

export const LAUNCHER_CONFIG: Record<GameLauncher, LauncherInfo> = {
  STEAM: {
    id: 'STEAM',
    name: 'Steam',
    color: 'text-sky-400',
    bgColor: 'bg-sky-500/10',
    borderColor: 'border-sky-500/30',
  },
  EPIC: {
    id: 'EPIC',
    name: 'Epic Games',
    color: 'text-zinc-200',
    bgColor: 'bg-zinc-800/80',
    borderColor: 'border-zinc-600/40',
  },
  GOG: {
    id: 'GOG',
    name: 'GOG',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
  },
  XBOX: {
    id: 'XBOX',
    name: 'Xbox',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
  },
  EA: {
    id: 'EA',
    name: 'EA App',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
  },
  UBISOFT: {
    id: 'UBISOFT',
    name: 'Ubisoft',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
  },
  BATTLE_NET: {
    id: 'BATTLE_NET',
    name: 'Battle.net',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/30',
  },
  ROCKSTAR: {
    id: 'ROCKSTAR',
    name: 'Rockstar',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
  },
  STANDALONE: {
    id: 'STANDALONE',
    name: 'Standalone',
    color: 'text-teal-400',
    bgColor: 'bg-teal-500/10',
    borderColor: 'border-teal-500/30',
  },
  UNKNOWN: {
    id: 'UNKNOWN',
    name: 'Other',
    color: 'text-zinc-400',
    bgColor: 'bg-zinc-800/50',
    borderColor: 'border-zinc-700/30',
  },
};
