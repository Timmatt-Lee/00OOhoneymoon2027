import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadHoneymoonData } from './loader';
import { mountStageDOM } from './renderer';
import { mountTimelineRail } from './timeline';
import { mountParallaxScenes } from './parallax';
import { bindGesturesAndPhysics } from './gestures';

describe('bindGesturesAndPhysics', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.location.hash = '';
    document.documentElement.style.removeProperty('--sky-top-color');
    Object.defineProperty(window, 'CSS', {
      value: {
        supports: vi.fn(() => false)
      },
      configurable: true
    });
    document.body.innerHTML = `
      <meta id="theme-color-meta" content="#000000" />
      <div id="app-shell" class="theme-dark">
        <div id="sky-stack"></div>
        <div id="stage-frame">
          <header id="top-header"><nav id="story-bar-track"></nav></header>
          <div id="day-live-status"></div>
          <div id="timeline-rail"><div id="timeline-line"></div><div id="timeline-nodes-container"></div></div>
          <main id="schedule-stage"></main>
        </div>
        <footer id="cityscape-footer">
          <div id="scene-groups-container"></div>
          <div id="snow-ground-slot"></div>
          <a id="cityscape-map-link" href="#"></a>
        </footer>
      </div>
    `;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function setupEngine(isReducedMotion = false, initialHash = '') {
    window.location.hash = initialHash;
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn().mockReturnValue({ matches: isReducedMotion }),
      configurable: true
    });

    const shell = document.getElementById('app-shell');
    const stageFrame = document.getElementById('stage-frame');
    const track = document.getElementById('story-bar-track');
    if (!shell || !stageFrame || !track) {
      throw new Error('Expected stage elements');
    }

    Object.defineProperty(shell, 'clientWidth', { value: 400, configurable: true });
    Object.defineProperty(stageFrame, 'clientWidth', { value: 400, configurable: true });
    vi.spyOn(shell, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 400,
      height: 844,
      right: 400,
      bottom: 844,
      x: 0,
      y: 0,
      toJSON: () => ({})
    });
    vi.spyOn(stageFrame, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 400,
      height: 844,
      right: 400,
      bottom: 844,
      x: 0,
      y: 0,
      toJSON: () => ({})
    });
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue({
      left: 16,
      top: 12,
      width: 368,
      height: 40,
      right: 384,
      bottom: 52,
      x: 16,
      y: 12,
      toJSON: () => ({})
    });

    const { daysData, sceneGroups } = loadHoneymoonData();
    const renderer = mountStageDOM(daysData);
    const timeline = mountTimelineRail(daysData);
    const parallax = mountParallaxScenes(daysData, sceneGroups);
    const gestures = bindGesturesAndPhysics(
      daysData,
      renderer,
      timeline,
      parallax,
      new Date('2026-11-11T00:00:00Z')
    );

    return { shell, stageFrame, track, renderer, gestures };
  }

  it('handles story bar scrubbing, multi-pointer guards, keyboard navigation, roving focus, and URL hash canonicalization', () => {
    // Out-of-bounds initial hash #day-99 canonicalizes immediately to #day-1
    const { shell, stageFrame, track, renderer, gestures } = setupEngine(false, '#day-99');
    expect(gestures.getCurrentDayFloat()).toBe(0);
    expect(window.location.hash).toBe('#day-1');
    expect(document.querySelectorAll('.sky-layer.is-gpu-staged')).toHaveLength(2);
    expect(document.querySelectorAll('.day-schedule-panel.is-gpu-staged')).toHaveLength(2);
    expect(renderer.schedulePanelEls[1].style.opacity).toBe('0.000');

    // Spy on geometry getters AFTER mount to prove zero reflow reads during pointer interactions
    const frameRectSpy = vi.spyOn(stageFrame, 'getBoundingClientRect');
    const trackRectSpy = vi.spyOn(track, 'getBoundingClientRect');
    frameRectSpy.mockClear();
    trackRectSpy.mockClear();

    // Scrub on story bar track
    const slot2 = track.querySelector<HTMLElement>('[data-day="2"]');
    if (!slot2) throw new Error('Expected slot 2');
    slot2.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 80, pointerId: 1 })
    );
    expect(gestures.getCurrentDayFloat()).toBe(2);

    // Secondary pointerdown and non-primary mouse button are ignored while scrubId === 1 is active
    slot2.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 10, pointerId: 2 })
    );
    slot2.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, button: 1, clientX: 10, pointerId: 3 })
    );
    expect(gestures.getCurrentDayFloat()).toBe(2);

    // Mismatched pointerId on move/up/cancel is ignored; same-day scrub short-circuits cleanly
    track.dispatchEvent(new PointerEvent('pointermove', { clientX: 200, pointerId: 99 }));
    track.dispatchEvent(new PointerEvent('pointermove', { clientX: 90, pointerId: 1 }));
    track.dispatchEvent(new PointerEvent('pointermove', { clientX: 200, pointerId: 1 }));
    expect(gestures.getCurrentDayFloat()).toBeGreaterThan(3);

    // Scrubbing onto targetDayIdx while a glide timer is active cancels the glide cleanly
    gestures.glideToDay(5);
    expect(shell.classList.contains('is-gliding')).toBe(true);
    track.dispatchEvent(new PointerEvent('pointermove', { clientX: 185, pointerId: 1 }));
    expect(shell.classList.contains('is-gliding')).toBe(false);

    track.dispatchEvent(new PointerEvent('pointerup', { pointerId: 99 }));
    track.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));

    // Also verify pointercancel ends an active track scrub
    slot2.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 80, pointerId: 4 })
    );
    track.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 99 }));
    track.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 4 }));

    expect(frameRectSpy).not.toHaveBeenCalled();
    expect(trackRectSpy).not.toHaveBeenCalled();

    // Keyboard Enter/Space on story-slot triggers click with detail === 0
    const slot4 = track.querySelector<HTMLElement>('[data-day="4"]');
    if (!slot4) throw new Error('Expected slot 4');
    slot4.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
    expect(gestures.getCurrentDayFloat()).toBe(4);
    slot4.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));

    // Interior Day 5 (index 4) pre-stages 3-day GPU window (3, 4, 5) with 0.000 neighbor opacity
    expect(document.querySelectorAll('.sky-layer.is-gpu-staged')).toHaveLength(3);
    expect(document.querySelectorAll('.day-schedule-panel.is-gpu-staged')).toHaveLength(3);
    expect(renderer.skyLayerEls[3].style.visibility).toBe('visible');
    expect(renderer.skyLayerEls[3].style.opacity).toBe('0');
    expect(renderer.schedulePanelEls[3].style.opacity).toBe('0.000');
    expect(renderer.schedulePanelEls[4].style.opacity).toBe('1.000');
    expect(renderer.schedulePanelEls[5].style.opacity).toBe('0.000');
    expect(renderer.schedulePanelEls[0].style.visibility).toBe('hidden');
    expect(renderer.schedulePanelEls[0].style.opacity).toBe('0');

    const themeMeta = document.getElementById('theme-color-meta');
    expect(themeMeta?.getAttribute('content')).toBe('#FBCFE8');
    expect(document.documentElement.style.getPropertyValue('--sky-top-color')).toBe('');

    // Focus inside #story-bar-track syncs roving focus on ArrowRight, ArrowLeft, Home, End
    renderer.storySlotEls[4].focus();
    const rightEv = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true });
    window.dispatchEvent(rightEv);
    expect(rightEv.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(renderer.storySlotEls[5]);
    // System bar tint sync is deferred during active .is-gliding frame 0
    expect(themeMeta?.getAttribute('content')).toBe('#FBCFE8');

    // Rapid consecutive ArrowRight advances across pairs cleanly while glideTimerId is active
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(document.activeElement).toBe(renderer.storySlotEls[6]);
    // Reversing within the same pair (6 -> 5 -> 6 -> 5) reverses CoreAnimation mid-flight
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    vi.advanceTimersByTime(350);
    expect(shell.classList.contains('is-gliding')).toBe(false);
    expect(gestures.getCurrentDayFloat()).toBe(6);
    expect(themeMeta?.getAttribute('content')).toBe('#090A10');
    expect(document.documentElement.style.getPropertyValue('--sky-top-color')).toBe('');
    expect(renderer.schedulePanelEls[6].classList.contains('is-gpu-staged')).toBe(true);

    // Home jumps to Day 1 (index 0); End jumps to Day 12 (index 11)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));
    expect(gestures.getCurrentDayFloat()).toBe(0);
    expect(document.activeElement).toBe(renderer.storySlotEls[0]);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
    expect(gestures.getCurrentDayFloat()).toBe(11);
    expect(document.activeElement).toBe(renderer.storySlotEls[11]);
    expect(themeMeta?.getAttribute('content')).toBe('#FDBA74');
    expect(document.documentElement.style.getPropertyValue('--sky-top-color')).toBe('');

    // Modifier shortcuts, defaultPrevented events, unrelated keys, and editable inputs are ignored
    renderer.storySlotEls[11].blur();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', metaKey: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', altKey: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', ctrlKey: true }));
    const prePrevented = new KeyboardEvent('keydown', { key: 'ArrowLeft', cancelable: true });
    prePrevented.preventDefault();
    window.dispatchEvent(prePrevented);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(gestures.getCurrentDayFloat()).toBe(11);

    const inputEl = document.createElement('input');
    document.body.appendChild(inputEl);
    inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(gestures.getCurrentDayFloat()).toBe(11);

    // ArrowLeft when focus is outside #story-bar-track glides backward from settled highIdx (11 -> 10)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(shell.classList.contains('is-gliding')).toBe(true);
    vi.advanceTimersByTime(350);
    expect(gestures.getCurrentDayFloat()).toBe(10);

    // URL hashchange: valid jump, matching no-op, invalid hash restoration, and empty hash
    window.location.hash = '#day-3';
    window.dispatchEvent(new Event('hashchange'));
    expect(gestures.getCurrentDayFloat()).toBe(2);
    window.dispatchEvent(new Event('hashchange'));

    window.location.hash = '#day-0';
    window.dispatchEvent(new Event('hashchange'));
    expect(window.location.hash).toBe('#day-3');

    window.location.hash = '';
    window.dispatchEvent(new Event('hashchange'));

    // Resize refreshes layout metrics and re-renders
    window.dispatchEvent(new Event('resize'));
  });

  it('drives 60Hz CoreAnimation glides, Porter-Duff sky layers, mid-glide touch interruption, pointercancel abort, and native map links', () => {
    const rafCallbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    let nowMs = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => nowMs);

    const { shell, renderer, gestures } = setupEngine(false, '#day-1');
    const skyStack = document.getElementById('sky-stack');
    expect(skyStack?.style.background).toBe('');

    // Ignore secondary button or story-bar target on shell pointerdown
    shell.dispatchEvent(new PointerEvent('pointerdown', { button: 2, clientX: 100, pointerId: 1 }));
    renderer.storySlotEls[0].dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, button: 2, clientX: 20, pointerId: 2 })
    );

    // Rubber-band swipe past left edge (Day 1 -> dx > 0 -> raw < 0) and release back
    shell.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: 100, clientY: 300, pointerId: 10 })
    );
    // Second finger touching mid-swipe is ignored (multi-pointer guard)
    shell.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: 320, clientY: 300, pointerId: 11 })
    );
    shell.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 200, clientY: 300, pointerId: 99 })
    );
    shell.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 102, clientY: 340, pointerId: 10 })
    );
    shell.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 220, clientY: 300, pointerId: 10 })
    );
    // Coalesce second pointermove before rAF fires
    shell.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 230, clientY: 300, pointerId: 10 })
    );
    rafCallbacks.shift()?.(1016);
    expect(shell.classList.contains('is-swiping')).toBe(true);

    // Drag left to 50% between Day 1 and Day 2: verify opaque lower skyLayer[0] = '1' & upper skyLayer[1] = t
    shell.dispatchEvent(
      new PointerEvent('pointermove', { clientX: -100, clientY: 300, pointerId: 10 })
    );
    rafCallbacks.shift()?.(1032);
    expect(renderer.skyLayerEls[0].style.opacity).toBe('1');
    expect(Number(renderer.skyLayerEls[1].style.opacity)).toBeCloseTo(0.5, 2);
    expect(skyStack?.style.background).toBe('');

    // Release swipe with pending dragRafId -> cancels dragRafId and starts .is-gliding to Day 2
    shell.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 20, clientY: 300, pointerId: 10 })
    );
    shell.dispatchEvent(
      new PointerEvent('pointerup', { clientX: 20, clientY: 300, pointerId: 10 })
    );
    shell.dispatchEvent(
      new PointerEvent('pointerup', { clientX: 20, clientY: 300, pointerId: 99 })
    );
    expect(shell.classList.contains('is-gliding')).toBe(true);

    // Next click after horizontal drag is suppressed
    const suppressedClick = new MouseEvent('click', { bubbles: true, cancelable: true });
    shell.dispatchEvent(suppressedClick);
    expect(suppressedClick.defaultPrevented).toBe(true);
    // Subsequent normal click is not suppressed
    const normalClick = new MouseEvent('click', { bubbles: true, cancelable: true });
    shell.dispatchEvent(normalClick);
    expect(normalClick.defaultPrevented).toBe(false);

    // Interrupt active 320ms glide halfway (160ms) with a new pointerdown!
    nowMs += 160;
    shell.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: 200, clientY: 300, pointerId: 12 })
    );
    expect(shell.classList.contains('is-gliding')).toBe(false);
    expect(gestures.getCurrentDayFloat()).toBeGreaterThan(0.2);
    expect(gestures.getCurrentDayFloat()).toBeLessThan(1);

    // pointercancel aborts gesture cleanly back to nearest dragStart without triggering tap navigation
    shell.dispatchEvent(
      new PointerEvent('pointercancel', { clientX: 380, clientY: 300, pointerId: 99 })
    );
    shell.dispatchEvent(
      new PointerEvent('pointercancel', { clientX: 380, clientY: 300, pointerId: 12 })
    );
    vi.advanceTimersByTime(350);
    expect(gestures.getCurrentDayFloat()).toBe(1);

    // Small horizontal wiggle (6px..30px) snaps to nearest currentPos
    shell.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: 200, clientY: 300, pointerId: 13 })
    );
    shell.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 185, clientY: 300, pointerId: 13 })
    );
    shell.dispatchEvent(
      new PointerEvent('pointerup', { clientX: 185, clientY: 300, pointerId: 13 })
    );
    vi.advanceTimersByTime(350);

    // Horizontal swipe right (dx > 36) glides back to Day 1
    shell.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: 100, clientY: 300, pointerId: 14 })
    );
    shell.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 180, clientY: 300, pointerId: 14 })
    );
    shell.dispatchEvent(
      new PointerEvent('pointerup', { clientX: 180, clientY: 300, pointerId: 14 })
    );
    vi.advanceTimersByTime(350);
    expect(gestures.getCurrentDayFloat()).toBe(0);

    // Right tap, Left tap, Center tap, and vertical non-tap movement
    nowMs += 500;
    shell.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: 350, clientY: 300, pointerId: 15 })
    );
    shell.dispatchEvent(
      new PointerEvent('pointerup', { button: 0, clientX: 350, clientY: 300, pointerId: 15 })
    );
    vi.advanceTimersByTime(350);
    expect(gestures.getCurrentDayFloat()).toBe(1);

    nowMs += 500;
    shell.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: 50, clientY: 300, pointerId: 16 })
    );
    shell.dispatchEvent(
      new PointerEvent('pointerup', { button: 0, clientX: 50, clientY: 300, pointerId: 16 })
    );
    vi.advanceTimersByTime(350);
    expect(gestures.getCurrentDayFloat()).toBe(0);

    nowMs += 500;
    shell.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: 200, clientY: 300, pointerId: 17 })
    );
    shell.dispatchEvent(
      new PointerEvent('pointerup', { button: 0, clientX: 200, clientY: 300, pointerId: 17 })
    );

    nowMs += 500;
    shell.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: 200, clientY: 300, pointerId: 18 })
    );
    shell.dispatchEvent(
      new PointerEvent('pointerup', { button: 0, clientX: 200, clientY: 350, pointerId: 18 })
    );

    // Tapping #cityscape-map-link or inline .is-map-link uses native <a href> Universal Links (zero window.open)
    const footerLink = renderer.cityscapeMapLinkEl;
    expect(footerLink.href).toContain('Sapporo%20Station');
    footerLink.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        button: 0,
        clientX: 350,
        clientY: 780,
        pointerId: 19
      })
    );
    footerLink.dispatchEvent(
      new PointerEvent('pointerup', {
        bubbles: true,
        button: 0,
        clientX: 350,
        clientY: 780,
        pointerId: 19
      })
    );
    expect(gestures.getCurrentDayFloat()).toBe(0);
    expect(openSpy).not.toHaveBeenCalled();

    const mapAnchor = renderer.schedulePanelEls[0].querySelector<HTMLElement>('a.is-map-link');
    mapAnchor?.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        button: 0,
        clientX: 150,
        clientY: 200,
        pointerId: 20
      })
    );
    mapAnchor?.dispatchEvent(
      new PointerEvent('pointerup', {
        bubbles: true,
        button: 0,
        clientX: 150,
        clientY: 200,
        pointerId: 20
      })
    );

    // Rubber-band past Day 12 (maxIdx = 11) in normal motion + reduced motion mode
    const endEngine = setupEngine(false, '#day-12');
    endEngine.shell.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: 300, clientY: 300, pointerId: 21 })
    );
    endEngine.shell.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 270, clientY: 300, pointerId: 21 })
    );
    endEngine.shell.dispatchEvent(
      new PointerEvent('pointerup', { clientX: 270, clientY: 300, pointerId: 21 })
    );
    vi.advanceTimersByTime(350);
    expect(endEngine.gestures.getCurrentDayFloat()).toBe(11);
    expect(endEngine.renderer.skyLayerEls[11].style.opacity).toBe('1');

    const rm = setupEngine(true, '#day-12');
    rm.shell.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: 300, clientY: 300, pointerId: 22 })
    );
    rm.shell.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 150, clientY: 300, pointerId: 22 })
    );
    rm.shell.dispatchEvent(
      new PointerEvent('pointerup', { clientX: 150, clientY: 300, pointerId: 22 })
    );
    expect(rm.gestures.getCurrentDayFloat()).toBe(11);
  });

  it('falls back gracefully when matchMedia, stage-frame, theme-color-meta, or clientWidth are absent', () => {
    Reflect.deleteProperty(window, 'matchMedia');
    document.getElementById('theme-color-meta')?.remove();
    const frame = document.getElementById('stage-frame');
    frame?.replaceWith(...Array.from(frame.childNodes));

    const { daysData, sceneGroups } = loadHoneymoonData();
    const renderer = mountStageDOM(daysData);
    const timeline = mountTimelineRail(daysData);
    const parallax = mountParallaxScenes(daysData, sceneGroups);
    const gestures = bindGesturesAndPhysics(daysData, renderer, timeline, parallax);

    const shell = document.getElementById('app-shell');
    const track = document.getElementById('story-bar-track');
    if (!shell || !track) throw new Error('Expected shell and track');

    window.dispatchEvent(new Event('resize'));
    track.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));

    let nowMs = 5000;
    vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
    shell.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: 350, clientY: 5, pointerId: 30 })
    );
    shell.dispatchEvent(
      new PointerEvent('pointerup', { button: 0, clientX: 350, clientY: 5, pointerId: 30 })
    );
    vi.advanceTimersByTime(350);

    gestures.glideToDay(1);
    expect(window.location.hash).toBe('#day-2');

    // Toggling reduced-motion mid-glide cancels glideTimerId cleanly
    const mediaState = { matches: false };
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn().mockReturnValue(mediaState),
      configurable: true
    });
    const g2 = bindGesturesAndPhysics(daysData, renderer, timeline, parallax);
    g2.glideToDay(1);
    mediaState.matches = true;
    nowMs += 500;
    g2.glideToDay(2);
    expect(shell.classList.contains('is-gliding')).toBe(false);

    // Falls back cleanly when theme-color-meta exists and window.CSS or CSS.supports is absent
    const originalCss = window.CSS;
    const restoredMeta = document.createElement('meta');
    restoredMeta.id = 'theme-color-meta';
    restoredMeta.content = '#000000';
    document.head.appendChild(restoredMeta);
    Reflect.deleteProperty(window, 'CSS');
    bindGesturesAndPhysics(daysData, renderer, timeline, parallax);
    expect(document.getElementById('theme-color-meta')).toBe(restoredMeta);
    expect(restoredMeta.content).toBe('#0B1024');

    Object.defineProperty(window, 'CSS', { value: {}, configurable: true });
    bindGesturesAndPhysics(daysData, renderer, timeline, parallax);
    expect(document.getElementById('theme-color-meta')).toBe(restoredMeta);

    // Removes #theme-color-meta on iOS/iPadOS WebKit (-webkit-touch-callout: none) so Safari bottom bar never tints to sky colors
    Object.defineProperty(window, 'CSS', {
      value: {
        supports: vi.fn(
          (prop: string, val: string) => prop === '-webkit-touch-callout' && val === 'none'
        )
      },
      configurable: true
    });
    const gIos = bindGesturesAndPhysics(daysData, renderer, timeline, parallax);
    expect(document.getElementById('theme-color-meta')).toBeNull();
    gIos.glideToDay(4);
    expect(document.getElementById('theme-color-meta')).toBeNull();

    Object.defineProperty(window, 'CSS', { value: originalCss, configurable: true });
  });
});
