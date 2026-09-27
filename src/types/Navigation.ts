import { GameLauncher } from './Launcher';

export type PageRoute = 
  | 'home' 
  | 'library' 
  | 'favorites' 
  | 'recently-played' 
  | 'drives' 
  | 'settings'
  | 'help';

export type LibraryFilter =
  | 'ALL'
  | 'INSTALLED'
  | 'AVAILABLE'
  | GameLauncher
  | 'MISSING'
  | 'FAVORITES'
  | (string & {});


export type SortOption = 'name-asc' | 'name-desc' | 'recent' | 'playtime' | 'size' | 'recently-added';
