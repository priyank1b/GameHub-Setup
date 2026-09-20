export type ControllerAction =
  | 'NAV_UP'
  | 'NAV_DOWN'
  | 'NAV_LEFT'
  | 'NAV_RIGHT'
  | 'CONFIRM'
  | 'BACK'
  | 'SECONDARY'
  | 'MENU'
  | 'PAGE_UP'
  | 'PAGE_DOWN'
  | 'TAB_PREV'
  | 'TAB_NEXT'
  | 'SEARCH'
  | 'PLAY';

export interface GamepadInfo {
  index: number;
  id: string;
  connected: boolean;
  mapping: string;
  name: string;
}

export interface ControllerConfig {
  enabled: boolean;
  deadZone: number;
  repeatDelay: number;
  repeatInterval: number;
}
