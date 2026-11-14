import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  mapPointerToStage,
  syncViewportState,
  tryLockPortraitOrientation,
  type ViewportNavigatorLike,
  type ViewportWindowLike
} from './viewport';

describe('viewport utilities', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app-shell"></div>';
    document.documentElement.removeAttribute('style');
  });

  it('safely attempts screen.orientation.lock("portrait") and swallows unsupported rejections', async () => {
    expect(() => {
      tryLockPortraitOrientation(null);
      tryLockPortraitOrientation({});
      tryLockPortraitOrientation({ orientation: {} });
    }).not.toThrow();

    const lockResolved = vi.fn().mockResolvedValue(undefined);
    tryLockPortraitOrientation({ orientation: { lock: lockResolved } });
    expect(lockResolved).toHaveBeenCalledWith('portrait');

    const lockRejected = vi.fn().mockRejectedValue(new Error('NotSupportedError'));
    tryLockPortraitOrientation({ orientation: { lock: lockRejected } });
    expect(lockRejected).toHaveBeenCalledWith('portrait');
    await Promise.resolve();

    // Also exercise default window.screen parameter
    tryLockPortraitOrientation();
  });

  it('computes --ios-chin-fix in standalone portrait mode and resets to 0px outside bounds or in browser mode', () => {
    const shell = document.getElementById('app-shell');
    if (!shell) throw new Error('Expected #app-shell');

    // 1. iPhone 14 Pro WebClip standalone (innerH = 818, screenH = 852 -> gapPx = 34px) via navigator.standalone
    const iosStandaloneWin: ViewportWindowLike = {
      innerWidth: 393,
      innerHeight: 818,
      screen: { width: 393, height: 852 }
    };
    const iosNav: ViewportNavigatorLike = { standalone: true, maxTouchPoints: 5 };
    const state1 = syncViewportState(shell, iosStandaloneWin, iosNav);
    expect(state1.isStandalone).toBe(true);
    expect(state1.chinFixPx).toBe(34);
    expect(document.documentElement.style.getPropertyValue('--ios-chin-fix')).toBe('34px');
    expect(document.documentElement.style.getPropertyValue('--app-h')).toBe('100vh');
    expect(shell.classList.contains('is-landscape-locked')).toBe(false);

    // 2. Standalone via display-mode media query when screen dimensions are reported swapped (852x393)
    const displayModeWin: ViewportWindowLike = {
      innerWidth: 393,
      innerHeight: 818,
      screen: { width: 852, height: 393 },
      matchMedia: (query: string) => ({ matches: query === '(display-mode: standalone)' })
    };
    const state2 = syncViewportState(shell, displayModeWin, { maxTouchPoints: 5 });
    expect(state2.isStandalone).toBe(true);
    expect(state2.chinFixPx).toBe(34);

    // 3. Gap === 0 (already full height 852) or gap > 60 (e.g. split-screen / keyboard 300px) -> 0px
    const fullHeightState = syncViewportState(
      shell,
      { innerWidth: 393, innerHeight: 852, screen: { width: 393, height: 852 } },
      iosNav
    );
    expect(fullHeightState.chinFixPx).toBe(0);
    expect(document.documentElement.style.getPropertyValue('--ios-chin-fix')).toBe('0px');

    const hugeGapState = syncViewportState(
      shell,
      { innerWidth: 393, innerHeight: 500, screen: { width: 393, height: 852 } },
      iosNav
    );
    expect(hugeGapState.chinFixPx).toBe(0);

    // 4. Regular browser tab + zero/missing innerWidth/innerHeight/screen fallbacks + default parameters
    const fallbackState = syncViewportState(shell, { innerWidth: 0, innerHeight: 0 }, {});
    expect(fallbackState.innerW).toBe(400);
    expect(fallbackState.innerH).toBe(844);
    expect(fallbackState.isStandalone).toBe(false);
    expect(fallbackState.chinFixPx).toBe(0);

    const defaultState = syncViewportState(shell);
    expect(defaultState.chinFixPx).toBe(0);
  });

  it('locks phone touch landscape into ccw90 or cw90 while leaving desktop and mouse viewports untouched', () => {
    const shell = document.getElementById('app-shell');
    if (!shell) throw new Error('Expected #app-shell');

    // 1. iPhone 14 Pro landscape tilted left (angle 90 -> ccw90, -90deg)
    const ccwState = syncViewportState(
      shell,
      {
        innerWidth: 852,
        innerHeight: 393,
        screen: { width: 852, height: 393, orientation: { angle: 90 } }
      },
      { standalone: true, maxTouchPoints: 5 }
    );
    expect(ccwState.isTouchLandscape).toBe(true);
    expect(ccwState.lockMode).toBe('ccw90');
    expect(ccwState.chinFixPx).toBe(0);
    expect(shell.classList.contains('is-landscape-locked')).toBe(true);
    expect(document.documentElement.style.getPropertyValue('--app-h')).toBe('852px');
    expect(document.documentElement.style.getPropertyValue('--lock-w')).toBe('393px');
    expect(document.documentElement.style.getPropertyValue('--lock-h')).toBe('852px');
    expect(document.documentElement.style.getPropertyValue('--lock-rot')).toBe('-90deg');

    // 1b. iPhone 14 Pro Standalone landscape with 21pt Home Indicator subtracted (innerH = 372, screen short = 393 -> chinFixPx = 21)
    const standaloneChinState = syncViewportState(
      shell,
      {
        innerWidth: 852,
        innerHeight: 372,
        screen: { width: 393, height: 852, orientation: { angle: 90 } }
      },
      { standalone: true, maxTouchPoints: 5 }
    );
    expect(standaloneChinState.isTouchLandscape).toBe(true);
    expect(standaloneChinState.chinFixPx).toBe(21);
    expect(document.documentElement.style.getPropertyValue('--ios-chin-fix')).toBe('21px');
    expect(document.documentElement.style.getPropertyValue('--lock-w')).toBe('393px');
    expect(document.documentElement.style.getPropertyValue('--lock-h')).toBe('852px');

    // 1c. Standalone landscape with gap > 60 (e.g. keyboard/split view) clamps chinFixPx to 0
    const standaloneHugeLandscapeGap = syncViewportState(
      shell,
      {
        innerWidth: 852,
        innerHeight: 300,
        screen: { width: 852, height: 393, orientation: { angle: 90 } }
      },
      { standalone: true, maxTouchPoints: 5 }
    );
    expect(standaloneHugeLandscapeGap.chinFixPx).toBe(0);
    expect(document.documentElement.style.getPropertyValue('--lock-w')).toBe('300px');

    // 2. Phone landscape tilted right via screen.orientation.angle === 270 -> cw90 (+90deg)
    const cw270State = syncViewportState(
      shell,
      {
        innerWidth: 852,
        innerHeight: 393,
        screen: { orientation: { angle: 270 } }
      },
      { maxTouchPoints: 5 }
    );
    expect(cw270State.lockMode).toBe('cw90');
    expect(document.documentElement.style.getPropertyValue('--lock-rot')).toBe('90deg');

    // 3. Legacy window.orientation === -90 + coarse pointer fallback when maxTouchPoints === 0
    const cwLegacyState = syncViewportState(
      shell,
      {
        innerWidth: 852,
        innerHeight: 393,
        orientation: -90,
        matchMedia: (q: string) => ({ matches: q === '(pointer: coarse)' })
      },
      { maxTouchPoints: 0 }
    );
    expect(cwLegacyState.isTouchLandscape).toBe(true);
    expect(cwLegacyState.lockMode).toBe('cw90');

    // 4. Missing both screen.orientation.angle and window.orientation defaults to 90 (ccw90)
    const defaultAngleState = syncViewportState(
      shell,
      { innerWidth: 852, innerHeight: 393 },
      { maxTouchPoints: 5 }
    );
    expect(defaultAngleState.lockMode).toBe('ccw90');

    // 5. Desktop 1280x800 (even on standalone touch laptop) and narrow desktop mouse window 500x400 NEVER lock
    const touchLaptopState = syncViewportState(
      shell,
      { innerWidth: 1280, innerHeight: 800, screen: { width: 1280, height: 820 } },
      { standalone: true, maxTouchPoints: 10 }
    );
    expect(touchLaptopState.isTouchLandscape).toBe(false);
    expect(touchLaptopState.chinFixPx).toBe(0);
    expect(touchLaptopState.lockMode).toBe('none');
    expect(shell.classList.contains('is-landscape-locked')).toBe(false);
    expect(document.documentElement.style.getPropertyValue('--app-h')).toBe('100vh');

    const narrowDesktopMouseState = syncViewportState(
      shell,
      {
        innerWidth: 500,
        innerHeight: 400,
        matchMedia: () => ({ matches: false })
      },
      { maxTouchPoints: 0 }
    );
    expect(narrowDesktopMouseState.isTouchLandscape).toBe(false);
    expect(narrowDesktopMouseState.lockMode).toBe('none');
  });

  it('maps pointer coordinates accurately across none, ccw90, and cw90 stage orientations', () => {
    expect(mapPointerToStage(120, 340, 393, 852, 'none')).toEqual({ x: 120, y: 340 });
    expect(mapPointerToStage(400, 73, 852, 393, 'ccw90')).toEqual({ x: 320, y: 400 });
    expect(mapPointerToStage(400, 320, 852, 393, 'cw90')).toEqual({ x: 320, y: 452 });
  });
});
