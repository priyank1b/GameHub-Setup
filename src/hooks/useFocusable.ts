import { useEffect, useRef } from 'react';
import { useNavigation, FocusableElement } from '../context/NavigationContext';

export interface UseFocusableOptions {
  id: string;
  scope?: string;
  group?: string;
  row?: number;
  col?: number;
  onConfirm?: () => void;
  onSecondary?: () => void;
  onMenu?: () => void;
  onBack?: () => void;
  disabled?: boolean;
}

export function useFocusable<T extends HTMLElement = HTMLDivElement>({
  id,
  scope = 'main',
  group,
  row,
  col,
  onConfirm,
  onSecondary,
  onMenu,
  onBack,
  disabled = false,
}: UseFocusableOptions) {
  const { focusedId, registerFocusable, setFocus } = useNavigation();
  const ref = useRef<T>(null);
  const isFocused = focusedId === id;

  // Keep latest callbacks in ref to avoid re-registering on every render
  const callbacksRef = useRef({ onConfirm, onSecondary, onMenu, onBack });
  callbacksRef.current = { onConfirm, onSecondary, onMenu, onBack };

  useEffect(() => {
    if (disabled) return;
    return registerFocusable({
      id,
      scope,
      group,
      row,
      col,
      ref: ref as React.RefObject<HTMLElement>,
      onConfirm: () => callbacksRef.current.onConfirm?.(),
      onSecondary: () => callbacksRef.current.onSecondary?.(),
      onMenu: () => callbacksRef.current.onMenu?.(),
      onBack: () => callbacksRef.current.onBack?.(),
      disabled,
    });
  }, [id, scope, group, row, col, disabled, registerFocusable]);

  return {
    ref,
    isFocused,
    setFocus: () => setFocus(id),
  };
}
