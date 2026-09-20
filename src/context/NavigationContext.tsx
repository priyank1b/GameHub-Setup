import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { ControllerManager } from '../controllers/ControllerManager';
import { ControllerAction, GamepadInfo } from '../controllers/types';

export interface FocusableElement {
  id: string;
  scope: string; // 'main' | modalId
  group?: string; // 'sidebar' | 'topbar' | 'grid' | 'tabs' | 'modal'
  row?: number;
  col?: number;
  ref?: React.RefObject<HTMLElement>;
  onConfirm?: () => void;
  onSecondary?: () => void;
  onMenu?: () => void;
  onBack?: () => void;
  disabled?: boolean;
}

interface NavigationContextType {
  focusedId: string | null;
  focusMode: 'controller' | 'mouse';
  controllerInfo: GamepadInfo | null;
  isControllerEnabled: boolean;
  setControllerEnabled: (enabled: boolean) => void;
  setFocus: (id: string | null) => void;
  registerFocusable: (element: FocusableElement) => () => void;
  pushModal: (modalId: string, initialFocusId?: string) => void;
  popModal: (modalId: string) => void;
  onTabChange?: (direction: 'PREV' | 'NEXT') => void;
  setOnTabChange: (handler: (direction: 'PREV' | 'NEXT') => void) => void;
}

const NavigationContext = createContext<NavigationContextType | null>(null);

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [focusMode, setFocusMode] = useState<'controller' | 'mouse'>('mouse');
  const [controllerInfo, setControllerInfo] = useState<GamepadInfo | null>(null);
  const [isControllerEnabled, setIsControllerEnabled] = useState<boolean>(true);

  // Ref tracking to prevent stale closures during rapid gamepad polling
  const focusedIdRef = useRef<string | null>(null);
  focusedIdRef.current = focusedId;

  // Focusable elements registry
  const elementsRef = useRef<Map<string, FocusableElement>>(new Map());

  // Modal focus trap stack & restoration stack
  const modalStackRef = useRef<string[]>([]);
  const restoreFocusStackRef = useRef<(string | null)[]>([]);

  // Tab navigation handler (LB / RB)
  const onTabChangeRef = useRef<((dir: 'PREV' | 'NEXT') => void) | null>(null);

  const manager = useRef(ControllerManager.getInstance());

  const registerFocusable = useCallback((element: FocusableElement) => {
    elementsRef.current.set(element.id, element);

    // Auto-focus first visible game-card or hero item if nothing is focused yet in main scope
    if (!focusedIdRef.current && modalStackRef.current.length === 0) {
      if (element.id.startsWith('game-card-') || element.id.startsWith('hero-resume-game')) {
        focusedIdRef.current = element.id;
        setFocusedId(element.id);
      }
    }

    return () => {
      // Only delete if the registered element is still the current one (not replaced)
      if (elementsRef.current.get(element.id) === element) {
        elementsRef.current.delete(element.id);
        if (focusedIdRef.current === element.id) {
          focusedIdRef.current = null;
          setFocusedId(null);
        }
      }
    };
  }, []);

  const pushModal = useCallback((modalId: string, initialFocusId?: string) => {
    restoreFocusStackRef.current.push(focusedIdRef.current);
    focusedIdRef.current = initialFocusId ?? null;
    setFocusedId(initialFocusId ?? null);
    modalStackRef.current.push(modalId);
  }, []);

  const popModal = useCallback((modalId: string) => {
    const idx = modalStackRef.current.lastIndexOf(modalId);
    if (idx !== -1) {
      modalStackRef.current.splice(idx, 1);
    }
    const previousFocus = restoreFocusStackRef.current.pop() ?? null;
    focusedIdRef.current = previousFocus;
    setFocusedId(previousFocus);
  }, []);

  const getActiveScope = useCallback((): string => {
    if (modalStackRef.current.length > 0) {
      return modalStackRef.current[modalStackRef.current.length - 1];
    }
    return 'main';
  }, []);

  const getActiveScrollContainer = useCallback((): HTMLElement | null => {
    // 1. If inside a modal, find the modal's scroll container
    if (modalStackRef.current.length > 0) {
      const modalScrollables = document.querySelectorAll(
        '[data-testid*="modal"] .overflow-y-auto, .overflow-y-auto, [role="dialog"]'
      );
      for (let i = 0; i < modalScrollables.length; i++) {
        const el = modalScrollables[i] as HTMLElement;
        if (el.scrollHeight > el.clientHeight + 5) {
          return el;
        }
      }
    }

    // 2. Focused element scrollable parent
    const currentId = focusedIdRef.current;
    if (currentId) {
      const el = elementsRef.current.get(currentId);
      let p = el?.ref?.current?.parentElement;
      while (p && p !== document.body) {
        const style = window.getComputedStyle(p);
        if (
          (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
          p.scrollHeight > p.clientHeight + 10
        ) {
          return p;
        }
        p = p.parentElement;
      }
    }

    // 3. Fallback to main content container
    const mainEl = document.querySelector('main');
    if (mainEl && mainEl.scrollHeight > mainEl.clientHeight + 10) {
      return mainEl;
    }

    return (document.scrollingElement as HTMLElement) || document.documentElement;
  }, []);

  const getValidElementsForCurrentScope = useCallback((): FocusableElement[] => {
    const activeScope = getActiveScope();
    const valid: FocusableElement[] = [];

    elementsRef.current.forEach((el) => {
      if (el.disabled) return;
      if (activeScope === 'main') {
        if (el.scope === 'main' || el.scope === 'sidebar' || el.scope === 'topbar') {
          valid.push(el);
        }
      } else {
        if (el.scope === activeScope) {
          valid.push(el);
        }
      }
    });

    return valid;
  }, [getActiveScope]);

  // Spatial Navigation Algorithm
  const navigateSpatial = useCallback(
    (direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT') => {
      setFocusMode('controller');
      const validElements = getValidElementsForCurrentScope();
      if (validElements.length === 0) return;

      const currentId = focusedIdRef.current;
      if (!currentId || !elementsRef.current.has(currentId)) {
        // Priority auto-focus: prefer first visible game card, then hero banner, then first valid element
        const target =
          validElements.find((el) => el.id.startsWith('game-card-')) ||
          validElements.find((el) => el.id.startsWith('hero-')) ||
          validElements[0];
        if (target) {
          focusedIdRef.current = target.id;
          setFocusedId(target.id);
          target.ref?.current?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
          target.ref?.current?.focus();
        }
        return;
      }

      const currentEl = elementsRef.current.get(currentId);
      if (!currentEl || !currentEl.ref?.current) {
        const target = validElements.find((el) => el.id.startsWith('game-card-')) || validElements[0];
        if (target) {
          focusedIdRef.current = target.id;
          setFocusedId(target.id);
          target.ref?.current?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
        }
        return;
      }

      const currentRect = currentEl.ref.current.getBoundingClientRect();
      const currentCenterX = currentRect.left + currentRect.width / 2;
      const currentCenterY = currentRect.top + currentRect.height / 2;

      let bestCandidate: FocusableElement | null = null;
      let minDistance = Infinity;

      for (const candidate of validElements) {
        if (candidate.id === currentId || !candidate.ref?.current) continue;

        const candRect = candidate.ref.current.getBoundingClientRect();
        if (candRect.width === 0 && candRect.height === 0) continue;

        const candCenterX = candRect.left + candRect.width / 2;
        const candCenterY = candRect.top + candRect.height / 2;

        const deltaX = candCenterX - currentCenterX;
        const deltaY = candCenterY - currentCenterY;

        let isDirectionallyValid = false;
        let primaryDist = 0;
        let secondaryDist = 0;

        switch (direction) {
          case 'LEFT':
            if (deltaX < -5) {
              isDirectionallyValid = true;
              primaryDist = Math.abs(deltaX);
              secondaryDist = Math.abs(deltaY);
            }
            break;
          case 'RIGHT':
            if (deltaX > 5) {
              isDirectionallyValid = true;
              primaryDist = Math.abs(deltaX);
              secondaryDist = Math.abs(deltaY);
            }
            break;
          case 'UP':
            if (deltaY < -5) {
              isDirectionallyValid = true;
              primaryDist = Math.abs(deltaY);
              secondaryDist = Math.abs(deltaX);
            }
            break;
          case 'DOWN':
            if (deltaY > 5) {
              isDirectionallyValid = true;
              primaryDist = Math.abs(deltaY);
              secondaryDist = Math.abs(deltaX);
            }
            break;
        }

        if (isDirectionallyValid) {
          const isSameGroup = Boolean(candidate.group && currentEl.group && candidate.group === currentEl.group);
          const groupWeight = isSameGroup ? 1.0 : 1.7;
          // Weighted distance prioritizing movement along primary axis and within same group
          const distance = (primaryDist + secondaryDist * 2.0) * groupWeight;
          if (distance < minDistance) {
            minDistance = distance;
            bestCandidate = candidate;
          }
        }
      }

      if (bestCandidate) {
        focusedIdRef.current = bestCandidate.id;
        setFocusedId(bestCandidate.id);
        bestCandidate.ref?.current?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
        bestCandidate.ref?.current?.focus();
      } else {
        // Boundary scroll: when at edge of focusables, scroll the active container
        const container = getActiveScrollContainer();
        if (container) {
          if (direction === 'DOWN' && container.scrollTop + container.clientHeight < container.scrollHeight - 5) {
            container.scrollBy({ top: 160, behavior: 'smooth' });
          } else if (direction === 'UP' && container.scrollTop > 5) {
            container.scrollBy({ top: -160, behavior: 'smooth' });
          }
        }
      }
    },
    [getValidElementsForCurrentScope, getActiveScrollContainer]
  );

  // Controller Actions Handler
  const handleControllerAction = useCallback(
    (action: ControllerAction) => {
      setFocusMode('controller');

      switch (action) {
        case 'NAV_UP':
          navigateSpatial('UP');
          break;
        case 'NAV_DOWN':
          navigateSpatial('DOWN');
          break;
        case 'NAV_LEFT':
          navigateSpatial('LEFT');
          break;
        case 'NAV_RIGHT':
          navigateSpatial('RIGHT');
          break;
        case 'PAGE_UP': {
          const container = getActiveScrollContainer();
          if (container) {
            container.scrollBy({ top: -260, behavior: 'smooth' });
          }
          break;
        }
        case 'PAGE_DOWN': {
          const container = getActiveScrollContainer();
          if (container) {
            container.scrollBy({ top: 260, behavior: 'smooth' });
          }
          break;
        }
        case 'PLAY':
        case 'CONFIRM': {
          let currentId = focusedIdRef.current;
          if (!currentId || !elementsRef.current.has(currentId)) {
            const valid = getValidElementsForCurrentScope();
            const target =
              valid.find((el) => el.id.startsWith('game-card-')) ||
              valid.find((el) => el.id.startsWith('hero-')) ||
              valid[0];
            if (target) {
              currentId = target.id;
              focusedIdRef.current = target.id;
              setFocusedId(target.id);
            }
          }

          if (currentId) {
            const el = elementsRef.current.get(currentId);
            if (el?.onConfirm) {
              el.onConfirm();
            } else if (el?.ref?.current) {
              el.ref.current.click();
            }
          }
          break;
        }
        case 'BACK': {
          const currentId = focusedIdRef.current;
          if (currentId) {
            const el = elementsRef.current.get(currentId);
            if (el?.onBack) {
              el.onBack();
              return;
            }
          }
          if (modalStackRef.current.length > 0) {
            const topModal = modalStackRef.current[modalStackRef.current.length - 1];
            popModal(topModal);
          }
          break;
        }
        case 'SECONDARY': {
          const currentId = focusedIdRef.current;
          if (currentId) {
            const el = elementsRef.current.get(currentId);
            el?.onSecondary?.();
          }
          break;
        }
        case 'MENU': {
          const currentId = focusedIdRef.current;
          if (currentId) {
            const el = elementsRef.current.get(currentId);
            el?.onMenu?.();
          }
          break;
        }
        case 'TAB_PREV':
          onTabChangeRef.current?.('PREV');
          break;
        case 'TAB_NEXT':
          onTabChangeRef.current?.('NEXT');
          break;
        case 'SEARCH': {
          const searchEl = document.getElementById('global-search-input');
          if (searchEl) {
            searchEl.focus();
            searchEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }
          break;
        }
        default:
          break;
      }
    },
    [navigateSpatial, popModal, getValidElementsForCurrentScope, getActiveScrollContainer]
  );

  // Stable action handler ref to prevent loop restarts
  const actionHandlerRef = useRef(handleControllerAction);
  useEffect(() => {
    actionHandlerRef.current = handleControllerAction;
  }, [handleControllerAction]);

  // Initialize ControllerManager & listeners once on mount
  useEffect(() => {
    const ctrl = manager.current;
    ctrl.start();

    const unsubAction = ctrl.onAction((act) => actionHandlerRef.current(act));
    const unsubStatus = ctrl.onStatusChange((info) => setControllerInfo(info));
    const unsubScroll = ctrl.onScroll((deltaY) => {
      const container = getActiveScrollContainer();
      if (container) {
        container.scrollBy({ top: deltaY, behavior: 'auto' });
      }
    });

    // Mouse movement listener: ignore synthetic events, only switch on genuine physical movement
    let lastMousePos = { x: -1, y: -1 };
    const handleMouseMove = (e: MouseEvent) => {
      if (lastMousePos.x === -1 && lastMousePos.y === -1) {
        lastMousePos = { x: e.clientX, y: e.clientY };
        return;
      }
      const dist = Math.hypot(e.clientX - lastMousePos.x, e.clientY - lastMousePos.y);
      if (dist > 12) {
        lastMousePos = { x: e.clientX, y: e.clientY };
        setFocusMode('mouse');
      }
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    return () => {
      unsubAction();
      unsubStatus();
      unsubScroll();
      ctrl.stop();
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [getActiveScrollContainer]);

  const setControllerEnabled = (enabled: boolean) => {
    setIsControllerEnabled(enabled);
    manager.current.setEnabled(enabled);
  };

  const setOnTabChange = (handler: (direction: 'PREV' | 'NEXT') => void) => {
    onTabChangeRef.current = handler;
  };

  const setFocus = useCallback((id: string | null) => {
    focusedIdRef.current = id;
    setFocusedId(id);
  }, []);

  return (
    <NavigationContext.Provider
      value={{
        focusedId,
        focusMode,
        controllerInfo,
        isControllerEnabled,
        setControllerEnabled,
        setFocus: setFocusedId,
        registerFocusable,
        pushModal,
        popModal,
        onTabChange: onTabChangeRef.current ?? undefined,
        setOnTabChange,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = (): NavigationContextType => {
  const ctx = useContext(NavigationContext);
  if (!ctx) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return ctx;
};
