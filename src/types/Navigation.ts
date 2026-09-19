import { GameLauncher } from './Launcher';

export type PageRoute = 
  | 'home' 
  | 'library' 
  | 'favorites' 
  | 'recently-played' 
  | 'drives' 
  | 'settings';

export type LibraryFilter = 'ALL' | GameLauncher | 'MISSING' | 'FAVORITES';

export type SortOption = 'name-asc' | 'name-desc' | 'recent' | 'playtime' | 'size' | 'recently-added';
