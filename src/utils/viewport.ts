export type LockMode = 'none' | 'ccw90' | 'cw90';

export interface Point2D {
  readonly x: number;
  readonly y: number;
}

export interface LockableOrientation {
  readonly angle?: number;
  lock?: (orientation: 'portrait') => Promise<void>;
}

export interface LockableScreen {
  readonly width?: number;
  readonly height?: number;
  readonly orientation?: LockableOrientation;
}

export interface ViewportWindowLike {
  readonly innerWidth: number;
  readonly innerHeight: number;
  readonly orientation?: number;
  readonly screen?: LockableScreen;
  readonly matchMedia?: (query: string) => Pick<MediaQueryList, 'matches'>;
}

export interface ViewportNavigatorLike {
  readonly standalone?: unknown;
  readonly maxTouchPoints?: number;
}

export interface ViewportState {
  readonly innerW: number;
  readonly innerH: number;
  readonly isStandalone: boolean;
  readonly isTouchLandscape: boolean;
  readonly lockMode: LockMode;
  readonly chinFixPx: number;
}

export function tryLockPortraitOrientation(scr: LockableScreen | null = window.screen): void {
  const orientation = scr?.orientation;
  const lockFn = orientation?.lock;
  if (typeof lockFn !== 'function') {
    return;
  }
  // iOS WebKit and non-fullscreen browsers reject orientation.lock; CSS portrait rotation handles fallback.
  void lockFn.call(orientation, 'portrait').catch(() => {
    return;
  });
}

export function syncViewportState(
  shell: HTMLElement,
  win: ViewportWindowLike = window,
  nav: ViewportNavigatorLike = navigator,
  docEl: HTMLElement = document.documentElement
): ViewportState {
  const innerW = win.innerWidth || 400;
  const innerH = win.innerHeight || 844;
  const screenW = win.screen?.width || innerW;
  const screenH = win.screen?.height || innerH;

  const isDisplayModeStandalone =
    typeof win.matchMedia === 'function' && win.matchMedia('(display-mode: standalone)').matches;
  const isIosStandalone = nav.standalone === true;
  const isStandalone = isDisplayModeStandalone || isIosStandalone;
  const isPortrait = innerW <= innerH;

  let chinFixPx = 0;
  if (isStandalone && isPortrait) {
    const screenPortraitH = Math.max(screenW, screenH);
    const gapPx = screenPortraitH - innerH;
    if (gapPx > 0 && gapPx <= 60) {
      chinFixPx = gapPx;
    }
  }
  docEl.style.setProperty('--ios-chin-fix', `${chinFixPx}px`);

  const touchPointCount = nav.maxTouchPoints ?? 0;
  const isCoarsePointer =
    typeof win.matchMedia === 'function' && win.matchMedia('(pointer: coarse)').matches;
  const isTouchDevice = touchPointCount > 0 || isCoarsePointer;
  const isTouchLandscape = innerW > innerH && Math.min(innerW, innerH) <= 540 && isTouchDevice;

  let lockMode: LockMode = 'none';
  if (isTouchLandscape) {
    const angle = win.screen?.orientation?.angle ?? win.orientation ?? 90;
    lockMode = angle === 270 || angle === -90 ? 'cw90' : 'ccw90';
  }

  shell.classList.toggle('is-landscape-locked', isTouchLandscape);
  docEl.style.setProperty('--app-h', isTouchLandscape ? `${innerW}px` : '100vh');
  docEl.style.setProperty('--lock-w', `${innerH}px`);
  docEl.style.setProperty('--lock-h', `${innerW}px`);
  docEl.style.setProperty('--lock-rot', lockMode === 'cw90' ? '90deg' : '-90deg');

  return {
    innerW,
    innerH,
    isStandalone,
    isTouchLandscape,
    lockMode,
    chinFixPx
  };
}

export function mapPointerToStage(
  clientX: number,
  clientY: number,
  innerW: number,
  innerH: number,
  lockMode: LockMode
): Point2D {
  if (lockMode === 'ccw90') {
    return { x: innerH - clientY, y: clientX };
  }
  if (lockMode === 'cw90') {
    return { x: clientY, y: innerW - clientX };
  }
  return { x: clientX, y: clientY };
}
