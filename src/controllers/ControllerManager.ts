import { ControllerAction, GamepadInfo, ControllerConfig } from './types';

export class ControllerManager {
  private static instance: ControllerManager | null = null;

  private config: ControllerConfig = {
    enabled: true,
    deadZone: 0.38,
    repeatDelay: 450,
    repeatInterval: 220,
  };

  private activeIndex: number | null = null;
  private isSuspended = false;
  private animationFrameId: number | null = null;

  // Previous button states to detect edge triggers (press / release)
  private prevButtonStates: boolean[] = [];

  // Directional hold timers for smooth, predictable repeat navigation
  private navRepeatTimers: { [key in 'UP' | 'DOWN' | 'LEFT' | 'RIGHT']?: number } = {};

  // Subscribers
  private actionListeners: Set<(action: ControllerAction) => void> = new Set();
  private statusListeners: Set<(info: GamepadInfo | null) => void> = new Set();
  private scrollListeners: Set<(deltaY: number) => void> = new Set();

  private constructor() {
    this.handleGamepadConnected = this.handleGamepadConnected.bind(this);
    this.handleGamepadDisconnected = this.handleGamepadDisconnected.bind(this);
    this.handleWindowBlur = this.handleWindowBlur.bind(this);
    this.handleWindowFocus = this.handleWindowFocus.bind(this);
    this.poll = this.poll.bind(this);
  }

  public static getInstance(): ControllerManager {
    if (!ControllerManager.instance) {
      ControllerManager.instance = new ControllerManager();
    }
    return ControllerManager.instance;
  }

  public start(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('gamepadconnected', this.handleGamepadConnected);
    window.addEventListener('gamepaddisconnected', this.handleGamepadDisconnected);
    window.addEventListener('blur', this.handleWindowBlur);
    window.addEventListener('focus', this.handleWindowFocus);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    // Look for initially connected gamepads
    this.detectInitialGamepad();

    // Start polling loop
    if (!this.animationFrameId) {
      this.animationFrameId = requestAnimationFrame(this.poll);
    }
  }

  public stop(): void {
    if (typeof window === 'undefined') return;

    window.removeEventListener('gamepadconnected', this.handleGamepadConnected);
    window.removeEventListener('gamepaddisconnected', this.handleGamepadDisconnected);
    window.removeEventListener('blur', this.handleWindowBlur);
    window.removeEventListener('focus', this.handleWindowFocus);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.prevButtonStates = [];
    this.navRepeatTimers = {};
  }

  private handleVisibilityChange = (): void => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      this.resume();
    }
  };

  public setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    if (!enabled) {
      this.prevButtonStates = [];
      this.navRepeatTimers = {};
    }
    this.notifyStatusChange();
  }

  public isEnabled(): boolean {
    return this.config.enabled;
  }

  public suspend(): void {
    this.isSuspended = true;
    this.prevButtonStates = [];
    this.navRepeatTimers = {};
  }

  public resume(): void {
    this.isSuspended = false;
    this.prevButtonStates = [];
    this.navRepeatTimers = {};
    if (!this.animationFrameId) {
      this.animationFrameId = requestAnimationFrame(this.poll);
    }
  }

  public onAction(listener: (action: ControllerAction) => void): () => void {
    this.actionListeners.add(listener);
    return () => this.actionListeners.delete(listener);
  }

  public onStatusChange(listener: (info: GamepadInfo | null) => void): () => void {
    this.statusListeners.add(listener);
    // Emit current status immediately
    listener(this.getActiveGamepadInfo());
    return () => this.statusListeners.delete(listener);
  }

  public onScroll(listener: (deltaY: number) => void): () => void {
    this.scrollListeners.add(listener);
    return () => this.scrollListeners.delete(listener);
  }

  private emitScroll(deltaY: number): void {
    if (this.isSuspended || !this.config.enabled) return;
    for (const listener of this.scrollListeners) {
      try {
        listener(deltaY);
      } catch (err) {
        console.error('[ControllerManager] Scroll listener error:', err);
      }
    }
  }

  public getActiveGamepadInfo(): GamepadInfo | null {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
    const gamepads = navigator.getGamepads();
    if (this.activeIndex !== null && gamepads[this.activeIndex]) {
      const gp = gamepads[this.activeIndex]!;
      return {
        index: gp.index,
        id: gp.id,
        name: this.formatControllerName(gp.id),
        connected: gp.connected,
        mapping: gp.mapping,
      };
    }
    // Fallback to first connected gamepad
    for (let i = 0; i < gamepads.length; i++) {
      const gp = gamepads[i];
      if (gp && gp.connected) {
        return {
          index: gp.index,
          id: gp.id,
          name: this.formatControllerName(gp.id),
          connected: gp.connected,
          mapping: gp.mapping,
        };
      }
    }
    return null;
  }

  private formatControllerName(id: string): string {
    if (!id) return 'Standard Gamepad';
    if (id.toLowerCase().includes('xinput') || id.toLowerCase().includes('xbox')) {
      return 'Xbox Controller (XInput)';
    }
    if (id.toLowerCase().includes('054c') || id.toLowerCase().includes('dualsense') || id.toLowerCase().includes('dualshock')) {
      return 'PlayStation Controller';
    }
    // Clean up vendor ID strings
    const match = id.match(/^(.*?)\s*\(/);
    return match ? match[1].trim() : id.slice(0, 32);
  }

  private handleGamepadConnected(e: GamepadEvent): void {
    if (this.activeIndex === null) {
      this.activeIndex = e.gamepad.index;
    }
    this.notifyStatusChange();
  }

  private handleGamepadDisconnected(e: GamepadEvent): void {
    if (this.activeIndex === e.gamepad.index) {
      this.activeIndex = null;
      this.prevButtonStates = [];
      this.navRepeatTimers = {};
      // Find remaining connected gamepad if any
      this.detectInitialGamepad();
    }
    this.notifyStatusChange();
  }

  private handleWindowBlur(): void {
    // When GameHub loses window focus (e.g., game launches), suspend controller processing
    this.suspend();
  }

  private handleWindowFocus(): void {
    // Resume controller processing when GameHub regains window focus
    this.resume();
  }

  private detectInitialGamepad(): void {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
    const gamepads = navigator.getGamepads();
    for (let i = 0; i < gamepads.length; i++) {
      if (gamepads[i]?.connected) {
        this.activeIndex = i;
        break;
      }
    }
  }

  private notifyStatusChange(): void {
    const info = this.getActiveGamepadInfo();
    for (const listener of this.statusListeners) {
      try {
        listener(info);
      } catch (err) {
        console.error('[ControllerManager] Status listener error:', err);
      }
    }
  }

  private emitAction(action: ControllerAction): void {
    if (this.isSuspended || !this.config.enabled) return;
    for (const listener of this.actionListeners) {
      try {
        listener(action);
      } catch (err) {
        console.error('[ControllerManager] Action listener error:', err);
      }
    }
  }

  private poll(): void {
    if (typeof navigator !== 'undefined' && navigator.getGamepads && !this.isSuspended && this.config.enabled) {
      const gamepads = navigator.getGamepads();
      let activeGp: Gamepad | null = null;

      // Check if any connected gamepad is active or user switched controllers
      for (let i = 0; i < gamepads.length; i++) {
        const gp = gamepads[i];
        if (!gp || !gp.connected) continue;

        // Auto-switch active controller if input detected on any gamepad
        if (this.isGamepadActive(gp)) {
          if (this.activeIndex !== gp.index) {
            this.activeIndex = gp.index;
            this.notifyStatusChange();
          }
          activeGp = gp;
          break;
        }
      }

      if (!activeGp && this.activeIndex !== null && gamepads[this.activeIndex]?.connected) {
        activeGp = gamepads[this.activeIndex];
      }

      // If still no active gamepad, pick the first connected controller immediately
      if (!activeGp) {
        for (let i = 0; i < gamepads.length; i++) {
          if (gamepads[i]?.connected) {
            this.activeIndex = i;
            activeGp = gamepads[i];
            break;
          }
        }
      }

      if (activeGp) {
        this.processGamepadInput(activeGp);
      }
    }

    this.animationFrameId = requestAnimationFrame(this.poll);
  }

  private isGamepadActive(gp: Gamepad): boolean {
    const deadZone = this.config.deadZone;
    for (let i = 0; i < gp.buttons.length; i++) {
      const btn = gp.buttons[i];
      if (btn?.pressed || (btn?.value ?? 0) > 0.5) return true;
    }
    for (let i = 0; i < gp.axes.length; i++) {
      if (Math.abs(gp.axes[i] || 0) > deadZone) return true;
    }
    return false;
  }

  private processGamepadInput(gp: Gamepad): void {
    const now = performance.now();
    const deadZone = this.config.deadZone;

    // Helper to check button state with fallback to analog value
    const isBtnPressed = (idx: number): boolean => {
      const b = gp.buttons[idx];
      return Boolean(b?.pressed || (b?.value !== undefined && b.value > 0.5));
    };

    // --- 1. Directional Navigation (D-Pad + Left Stick + Right Stick fallback) ---
    let axisX = gp.axes[0] ?? 0;
    let axisY = gp.axes[1] ?? 0;

    // Fall back to right stick only if left stick is centered in deadzone
    if (Math.hypot(axisX, axisY) <= deadZone) {
      axisX = gp.axes[2] ?? 0;
      axisY = gp.axes[3] ?? 0;
    }

    const isDpadUp = isBtnPressed(12);
    const isDpadDown = isBtnPressed(13);
    const isDpadLeft = isBtnPressed(14);
    const isDpadRight = isBtnPressed(15);

    let isStickUp = false;
    let isStickDown = false;
    let isStickLeft = false;
    let isStickRight = false;

    const stickMag = Math.hypot(axisX, axisY);
    if (stickMag > deadZone) {
      // Isolate dominant axis to prevent accidental diagonal double-steps
      if (Math.abs(axisX) >= Math.abs(axisY)) {
        if (axisX < -deadZone) isStickLeft = true;
        else if (axisX > deadZone) isStickRight = true;
      } else {
        if (axisY < -deadZone) isStickUp = true;
        else if (axisY > deadZone) isStickDown = true;
      }
    }

    const navUp = isDpadUp || isStickUp;
    const navDown = isDpadDown || isStickDown;
    const navLeft = isDpadLeft || isStickLeft;
    const navRight = isDpadRight || isStickRight;

    this.handleDirectionalInput('UP', navUp, 'NAV_UP', now);
    this.handleDirectionalInput('DOWN', navDown, 'NAV_DOWN', now);
    this.handleDirectionalInput('LEFT', navLeft, 'NAV_LEFT', now);
    this.handleDirectionalInput('RIGHT', navRight, 'NAV_RIGHT', now);

    // --- 2. Action Buttons (Single press edge detection) ---
    // Standard mapping:
    // 0: A/Cross -> CONFIRM
    // 1: B/Circle -> BACK
    // 2: X/Square -> SECONDARY (Favorite)
    // 3: Y/Triangle -> MENU / Context action
    // 4: LB/L1 -> TAB_PREV
    // 5: RB/R1 -> TAB_NEXT
    // 6: LT/L2 -> PAGE_UP
    // 7: RT/R2 -> PAGE_DOWN
    // 8: Select/View/Back -> SEARCH
    // 9: Start/Menu -> PLAY / MENU
    this.handleButtonPress(0, isBtnPressed(0), 'CONFIRM');
    this.handleButtonPress(1, isBtnPressed(1), 'BACK');
    this.handleButtonPress(2, isBtnPressed(2), 'SECONDARY');
    this.handleButtonPress(3, isBtnPressed(3), 'MENU');
    this.handleButtonPress(4, isBtnPressed(4), 'TAB_PREV');
    this.handleButtonPress(5, isBtnPressed(5), 'TAB_NEXT');
    this.handleButtonPress(6, isBtnPressed(6), 'PAGE_UP');
    this.handleButtonPress(7, isBtnPressed(7), 'PAGE_DOWN');
    this.handleButtonPress(8, isBtnPressed(8), 'SEARCH');
    this.handleButtonPress(9, isBtnPressed(9), 'PLAY');

    // --- 3. Right Stick Analog Scrolling ---
    // Right stick vertical axis (axis 3 on Standard Gamepad) provides continuous smooth scrolling
    const rAxisY = gp.axes[3] ?? 0;
    if (Math.abs(rAxisY) > 0.2) {
      // Scale with tilt magnitude: 16px per frame at full deflection (~960px/sec at 60fps)
      this.emitScroll(rAxisY * 16);
    }
  }

  private handleDirectionalInput(
    dir: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT',
    isActive: boolean,
    action: ControllerAction,
    now: number
  ): void {
    if (!isActive) {
      delete this.navRepeatTimers[dir];
      return;
    }

    const nextTriggerTime = this.navRepeatTimers[dir];
    if (nextTriggerTime === undefined) {
      // First press: trigger immediately, schedule repeat delay
      this.emitAction(action);
      this.navRepeatTimers[dir] = now + this.config.repeatDelay;
    } else if (now >= nextTriggerTime) {
      // Repeated hold: trigger and schedule interval
      this.emitAction(action);
      this.navRepeatTimers[dir] = now + this.config.repeatInterval;
    }
  }

  private handleButtonPress(btnIndex: number, isPressed: boolean, action: ControllerAction): void {
    const wasPressed = this.prevButtonStates[btnIndex] ?? false;
    if (isPressed && !wasPressed) {
      // Rising edge trigger: activate once
      this.emitAction(action);
    }
    this.prevButtonStates[btnIndex] = isPressed;
  }
}
