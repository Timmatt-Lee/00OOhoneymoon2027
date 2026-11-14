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
    document.documentElement.removeAttribute('style');
    Object.defineProperty(window, 'innerWidth', { value: 400, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 844, configurable: true });
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 5, configurable: true });
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
      value: vi.fn((query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)' ? isReducedMotion : false
      })),
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
    Object.defineProperty(track, 'offsetLeft', { value: 16, configurable: true });
    Object.defineProperty(track, 'offsetWidth', { value: 368, configurable: true });

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
    const { shell, stageFrame, track, renderer, gestures } = setupEngine(false, '#day-99');
    expect(gestures.getCurrentDayFloat()).toBe(0);
    expect(window.location.hash).toBe('#day-1');
    expect(document.querySelectorAll('.sky-layer.is-gpu-staged')).toHaveLength(2);
    expect(document.querySelectorAll('.day-schedule-panel.is-gpu-staged')).toHaveLength(2);
    expect(renderer.schedulePanelEls[1].style.opacity).toBe('0.000');

    // Spy on getBoundingClientRect AFTER mount to prove zero reflow bounding-box reads during pointer interactions
    const frameRectSpy = vi.spyOn(stageFrame, 'getBoundingClientRect');
    const trackRectSpy = vi.spyOn(track, 'getBoundingClientRect');

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

    // Scrubbing onto targetDayIdx while a glide rAF is active cancels the glide cleanly
    gestures.glideToDay(5);
    expect(shell.classList.contains('is-moving')).toBe(true);
    track.dispatchEvent(new PointerEvent('pointermove', { clientX: 185, pointerId: 1 }));
    expect(shell.classList.contains('is-moving')).toBe(false);

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
    track.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));

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

    // Focus inside #story-bar-track syncs roving focus on ArrowRight, ArrowLeft, Home, End
    renderer.storySlotEls[4].focus();
    const rightEv = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true });
    window.dispatchEvent(rightEv);
    expect(rightEv.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(renderer.storySlotEls[5]);
    // System bar tint sync is deferred while exponential glide rAF is active
    expect(themeMeta?.getAttribute('content')).toBe('#FBCFE8');

    // Rapid consecutive ArrowRight chains smoothly across multiple days while glideRafId is active
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(document.activeElement).toBe(renderer.storySlotEls[6]);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    vi.advanceTimersByTime(500);
    expect(shell.classList.contains('is-moving')).toBe(false);
    expect(gestures.getCurrentDayFloat()).toBe(6);
    expect(themeMeta?.getAttribute('content')).toBe('#090A10');
    expect(renderer.schedulePanelEls[6].classList.contains('is-gpu-staged')).toBe(true);

    // Home glides smoothly to Day 1 (index 0); End glides smoothly to Day 12 (index 11)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));
    expect(document.activeElement).toBe(renderer.storySlotEls[0]);
    vi.advanceTimersByTime(600);
    expect(gestures.getCurrentDayFloat()).toBe(0);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
    expect(document.activeElement).toBe(renderer.storySlotEls[11]);
    vi.advanceTimersByTime(600);
    expect(gestures.getCurrentDayFloat()).toBe(11);
    expect(themeMeta?.getAttribute('content')).toBe('#FDBA74');

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

    // ArrowLeft when focus is outside #story-bar-track glides backward (11 -> 10)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(shell.classList.contains('is-moving')).toBe(true);
    vi.advanceTimersByTime(500);
    expect(gestures.getCurrentDayFloat()).toBe(10);

    // URL hashchange: valid glide, matching no-op, invalid hash restoration, and empty hash
    window.location.hash = '#day-3';
    window.dispatchEvent(new Event('hashchange'));
    vi.advanceTimersByTime(600);
    expect(gestures.getCurrentDayFloat()).toBe(2);
    window.dispatchEvent(new Event('hashchange'));

    window.location.hash = '#day-0';
    window.dispatchEvent(new Event('hashchange'));
    expect(window.location.hash).toBe('#day-3');

    window.location.hash = '';
    window.dispatchEvent(new Event('hashchange'));

    // Resize and orientationchange refresh layout metrics and re-render
    window.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('orientationchange'));
  });

  it('drives dt-normalized exponential glides, Porter-Duff sky layers, 0px-jitter catch, velocity flicks, rapid 5-flick chaining, and native map links', () => {
    const rafCallbacks = new Map<number, FrameRequestCallback>();
    let nextRafId = 1;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      const id = nextRafId++;
      rafCallbacks.set(id, cb);
      return id;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
      rafCallbacks.delete(id);
    });
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    let nowMs = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => nowMs);

    const stepFrames = (frameCount: number, dtPerFrameMs = 16): void => {
      for (let f = 0; f < frameCount; f++) {
        nowMs += dtPerFrameMs;
        const firstEntry = rafCallbacks.entries().next().value;
        if (!firstEntry) break;
        const [id, cb] = firstEntry;
        rafCallbacks.delete(id);
        cb(nowMs);
      }
    };

    const { shell, renderer, gestures } = setupEngine(false, '#day-1');
    const skyStack = document.getElementById('sky-stack');
    expect(skyStack?.style.background).toBe('');
    const updateTopBarSpy = vi.spyOn(renderer, 'updateTopStoryBar');

    // Ignore secondary button or story-bar target on shell pointerdown
    shell.dispatchEvent(new PointerEvent('pointerdown', { button: 2, clientX: 100, pointerId: 1 }));
    renderer.storySlotEls[0].dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, button: 2, clientX: 20, pointerId: 2 })
    );

    // Rubber-band swipe past left edge (Day 1 -> dx > 0 -> raw < 0) and drag left to 50% between Day 1 & Day 2
    shell.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: 100, clientY: 300, pointerId: 10 })
    );
    shell.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: 320, clientY: 300, pointerId: 11 })
    );
    shell.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 200, clientY: 300, pointerId: 99 })
    );
    shell.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 102, clientY: 340, pointerId: 10 })
    );
    nowMs += 35;
    shell.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 220, clientY: 300, pointerId: 10 })
    );
    nowMs += 35;
    shell.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 230, clientY: 300, pointerId: 10 })
    );
    stepFrames(1, 16);
    expect(shell.classList.contains('is-moving')).toBe(true);

    // Drag left past 60% between Day 1 and Day 2: visual pill flips at t > 0.5 while panel.inert stays deferred
    updateTopBarSpy.mockClear();
    shell.dispatchEvent(
      new PointerEvent('pointermove', { clientX: -140, clientY: 300, pointerId: 10 })
    );
    stepFrames(1, 16);
    expect(updateTopBarSpy).toHaveBeenCalledWith(1, true, false);
    expect(renderer.storySlotEls[1].classList.contains('is-active')).toBe(true);
    expect(renderer.schedulePanelEls[0].inert).toBe(false);
    expect(renderer.schedulePanelEls[1].inert).toBe(true);
    expect(renderer.skyLayerEls[0].style.opacity).toBe('1');
    expect(Number(renderer.skyLayerEls[1].style.opacity)).toBeCloseTo(0.6, 2);

    // Pause > 90ms mid-drag to reset stale velocity anchor, pull back to pos = 0.2, then release
    nowMs += 120;
    shell.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 20, clientY: 300, pointerId: 10 })
    );
    stepFrames(1, 16);
    expect(renderer.storySlotEls[0].classList.contains('is-active')).toBe(true);
    updateTopBarSpy.mockClear();
    shell.dispatchEvent(
      new PointerEvent('pointerup', { clientX: 20, clientY: 300, pointerId: 10 })
    );
    shell.dispatchEvent(
      new PointerEvent('pointerup', { clientX: 20, clientY: 300, pointerId: 99 })
    );
    expect(shell.classList.contains('is-moving')).toBe(true);
    // glideToDay does NOT prematurely flip pill/theme or rebuild inert on frame 0 (before t = 0.5)
    expect(updateTopBarSpy).not.toHaveBeenCalled();
    expect(renderer.storySlotEls[0].classList.contains('is-active')).toBe(true);

    // Next click after horizontal drag is suppressed; subsequent normal click is allowed
    const suppressedClick = new MouseEvent('click', { bubbles: true, cancelable: true });
    shell.dispatchEvent(suppressedClick);
    expect(suppressedClick.defaultPrevented).toBe(true);
    const normalClick = new MouseEvent('click', { bubbles: true, cancelable: true });
    shell.dispatchEvent(normalClick);
    expect(normalClick.defaultPrevented).toBe(false);

    // Catch active glide mid-flight with 0.00px jitter!
    stepFrames(4, 16);
    const posBeforeCatch = gestures.getCurrentDayFloat();
    expect(posBeforeCatch).toBeGreaterThan(0.4);
    expect(posBeforeCatch).toBeLessThan(1);
    shell.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: 200, clientY: 300, pointerId: 12 })
    );
    expect(gestures.getCurrentDayFloat()).toBe(posBeforeCatch);

    // pointercancel aborts gesture cleanly back to nearest dragStart
    shell.dispatchEvent(
      new PointerEvent('pointercancel', { clientX: 380, clientY: 300, pointerId: 99 })
    );
    shell.dispatchEvent(
      new PointerEvent('pointercancel', { clientX: 380, clientY: 300, pointerId: 12 })
    );
    stepFrames(30, 16);
    expect(shell.classList.contains('is-moving')).toBe(false);
    expect(gestures.getCurrentDayFloat()).toBe(1);

    // Slow small drag (< 28px after > 90ms hold) snaps cleanly to Math.round(currentPos)
    shell.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: 200, clientY: 300, pointerId: 13 })
    );
    shell.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 185, clientY: 300, pointerId: 13 })
    );
    nowMs += 120;
    shell.dispatchEvent(
      new PointerEvent('pointerup', { clientX: 185, clientY: 300, pointerId: 13 })
    );
    stepFrames(30, 16);
    expect(gestures.getCurrentDayFloat()).toBe(1);

    // Short high-velocity flick RIGHT (< 28px, dx = +18px in 25ms => vx = +0.72 px/ms) glides back to Day 1!
    shell.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: 200, clientY: 300, pointerId: 14 })
    );
    nowMs += 25;
    shell.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 218, clientY: 300, pointerId: 14 })
    );
    nowMs += 2;
    shell.dispatchEvent(
      new PointerEvent('pointerup', { clientX: 218, clientY: 300, pointerId: 14 })
    );
    stepFrames(30, 16);
    expect(gestures.getCurrentDayFloat()).toBe(0);

    // 5 rapid short flicks LEFT (-18px each in 24ms, spaced 50ms apart = < 400ms total) chain Day 1 -> 2 -> 3 -> 4 -> 5 -> 6!
    for (let flickIdx = 0; flickIdx < 5; flickIdx++) {
      const pid = 40 + flickIdx;
      shell.dispatchEvent(
        new PointerEvent('pointerdown', { button: 0, clientX: 250, clientY: 300, pointerId: pid })
      );
      nowMs += 24;
      shell.dispatchEvent(
        new PointerEvent('pointermove', { clientX: 232, clientY: 300, pointerId: pid })
      );
      nowMs += 2;
      shell.dispatchEvent(
        new PointerEvent('pointerup', { clientX: 232, clientY: 300, pointerId: pid })
      );
      stepFrames(3, 16);
    }
    stepFrames(35, 16);
    expect(shell.classList.contains('is-moving')).toBe(false);
    expect(gestures.getCurrentDayFloat()).toBe(5);
    expect(window.location.hash).toBe('#day-6');

    // Chained rapid flicks RIGHT (Day 6 -> Day 5 -> Day 4) while interrupting backward glide
    for (let flickIdx = 0; flickIdx < 2; flickIdx++) {
      const pid = 50 + flickIdx;
      shell.dispatchEvent(
        new PointerEvent('pointerdown', { button: 0, clientX: 150, clientY: 300, pointerId: pid })
      );
      nowMs += 24;
      shell.dispatchEvent(
        new PointerEvent('pointermove', { clientX: 170, clientY: 300, pointerId: pid })
      );
      nowMs += 2;
      shell.dispatchEvent(
        new PointerEvent('pointerup', { clientX: 170, clientY: 300, pointerId: pid })
      );
      stepFrames(3, 16);
    }
    stepFrames(35, 16);
    expect(gestures.getCurrentDayFloat()).toBe(3);

    // Catching an active glide by tapping on #cityscape-map-link suppresses accidental map navigation and settles cleanly
    gestures.glideToDay(0);
    stepFrames(3, 16);
    const footerLink = renderer.cityscapeMapLinkEl;
    footerLink.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        button: 0,
        clientX: 200,
        clientY: 780,
        pointerId: 60
      })
    );
    footerLink.dispatchEvent(
      new PointerEvent('pointerup', {
        bubbles: true,
        button: 0,
        clientX: 200,
        clientY: 780,
        pointerId: 60
      })
    );
    const caughtMapClick = new MouseEvent('click', { bubbles: true, cancelable: true });
    footerLink.dispatchEvent(caughtMapClick);
    expect(caughtMapClick.defaultPrevented).toBe(true);
    stepFrames(35, 16);

    // Jump to Day 1 and verify Right tap (including rapid chained Right tap), Left tap, Center tap, and vertical non-tap
    renderer.storySlotEls[0].dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
    nowMs += 500;
    shell.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: 350, clientY: 300, pointerId: 61 })
    );
    shell.dispatchEvent(
      new PointerEvent('pointerup', { button: 0, clientX: 350, clientY: 300, pointerId: 61 })
    );
    stepFrames(4, 16);
    nowMs += 250;
    shell.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: 350, clientY: 300, pointerId: 62 })
    );
    shell.dispatchEvent(
      new PointerEvent('pointerup', { button: 0, clientX: 350, clientY: 300, pointerId: 62 })
    );
    stepFrames(35, 16);
    expect(gestures.getCurrentDayFloat()).toBe(2);

    nowMs += 500;
    shell.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: 50, clientY: 300, pointerId: 63 })
    );
    shell.dispatchEvent(
      new PointerEvent('pointerup', { button: 0, clientX: 50, clientY: 300, pointerId: 63 })
    );
    stepFrames(35, 16);
    expect(gestures.getCurrentDayFloat()).toBe(1);

    nowMs += 500;
    shell.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: 200, clientY: 300, pointerId: 64 })
    );
    shell.dispatchEvent(
      new PointerEvent('pointerup', { button: 0, clientX: 200, clientY: 300, pointerId: 64 })
    );

    nowMs += 500;
    shell.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: 200, clientY: 300, pointerId: 65 })
    );
    shell.dispatchEvent(
      new PointerEvent('pointerup', { button: 0, clientX: 212, clientY: 350, pointerId: 65 })
    );

    // 2-frame (~30ms) fast flick with ZERO pointermove events on #cityscape-map-link advances to Day 2 AND suppresses click
    renderer.storySlotEls[0].dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
    expect(gestures.getCurrentDayFloat()).toBe(0);
    nowMs += 500;
    footerLink.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        button: 0,
        clientX: 300,
        clientY: 780,
        pointerId: 70
      })
    );
    nowMs += 30;
    footerLink.dispatchEvent(
      new PointerEvent('pointerup', {
        bubbles: true,
        button: 0,
        clientX: 265,
        clientY: 780,
        pointerId: 70
      })
    );
    const fastFlickMapClick = new MouseEvent('click', { bubbles: true, cancelable: true });
    footerLink.dispatchEvent(fastFlickMapClick);
    expect(fastFlickMapClick.defaultPrevented).toBe(true);
    stepFrames(35, 16);
    expect(gestures.getCurrentDayFloat()).toBe(1);
    expect(window.location.hash).toBe('#day-2');

    // Settled tap on #cityscape-map-link or inline .is-map-link preserves native <a href> Universal Links
    renderer.storySlotEls[0].dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
    expect(footerLink.href).toContain('Sapporo%20Station');
    footerLink.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        button: 0,
        clientX: 350,
        clientY: 780,
        pointerId: 66
      })
    );
    footerLink.dispatchEvent(
      new PointerEvent('pointerup', {
        bubbles: true,
        button: 0,
        clientX: 350,
        clientY: 780,
        pointerId: 66
      })
    );
    const settledMapClick = new MouseEvent('click', { bubbles: true, cancelable: true });
    footerLink.dispatchEvent(settledMapClick);
    expect(settledMapClick.defaultPrevented).toBe(false);
    expect(gestures.getCurrentDayFloat()).toBe(0);
    expect(openSpy).not.toHaveBeenCalled();

    const mapAnchor = renderer.schedulePanelEls[0].querySelector<HTMLElement>('a.is-map-link');
    mapAnchor?.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        button: 0,
        clientX: 150,
        clientY: 200,
        pointerId: 67
      })
    );
    mapAnchor?.dispatchEvent(
      new PointerEvent('pointerup', {
        bubbles: true,
        button: 0,
        clientX: 150,
        clientY: 200,
        pointerId: 67
      })
    );

    // Rubber-band past Day 12 (maxIdx = 11) in normal motion + reduced motion mode
    const endEngine = setupEngine(false, '#day-12');
    endEngine.shell.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: 300, clientY: 300, pointerId: 68 })
    );
    endEngine.shell.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 260, clientY: 300, pointerId: 68 })
    );
    endEngine.shell.dispatchEvent(
      new PointerEvent('pointerup', { clientX: 260, clientY: 300, pointerId: 68 })
    );
    stepFrames(35, 16);
    expect(endEngine.gestures.getCurrentDayFloat()).toBe(11);
    expect(endEngine.renderer.skyLayerEls[11].style.opacity).toBe('1');

    const rm = setupEngine(true, '#day-12');
    rm.shell.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: 300, clientY: 300, pointerId: 69 })
    );
    rm.shell.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 150, clientY: 300, pointerId: 69 })
    );
    rm.shell.dispatchEvent(
      new PointerEvent('pointerup', { clientX: 150, clientY: 300, pointerId: 69 })
    );
    expect(rm.gestures.getCurrentDayFloat()).toBe(11);
  });

  it('maps rotated landscape-locked touch swipes and story-bar scrubs seamlessly and handles missing DOM fallbacks', () => {
    // 1. Simulate iPhone 14 Pro landscape (852x393, ccw90) and verify rotated swipe + story-bar scrub
    Object.defineProperty(window, 'innerWidth', { value: 852, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 393, configurable: true });
    const { shell, track, gestures } = setupEngine(true, '#day-1');
    expect(shell.classList.contains('is-landscape-locked')).toBe(true);

    // In ccw90, stage X = innerH (393) - clientY: moving clientY from 73 -> 293 moves stage X from 320 -> 100 (dx = -220 -> Day 2)
    shell.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: 400, clientY: 73, pointerId: 80 })
    );
    shell.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 400, clientY: 293, pointerId: 80 })
    );
    shell.dispatchEvent(
      new PointerEvent('pointerup', { clientX: 400, clientY: 293, pointerId: 80 })
    );
    expect(gestures.getCurrentDayFloat()).toBe(1);

    // Scrubbing #story-bar-track in ccw90 uses mapped stage X
    track.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: 30, clientY: 196, pointerId: 81 })
    );
    expect(gestures.getCurrentDayFloat()).toBeGreaterThanOrEqual(4);
    track.dispatchEvent(new PointerEvent('pointerup', { pointerId: 81 }));

    // 2. Fallback paths when matchMedia, stage-frame, theme-color-meta, or clientWidth are absent
    Object.defineProperty(window, 'innerWidth', { value: 400, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 844, configurable: true });
    Reflect.deleteProperty(window, 'matchMedia');
    document.getElementById('theme-color-meta')?.remove();
    const frame = document.getElementById('stage-frame');
    frame?.replaceWith(...Array.from(frame.childNodes));
    Object.defineProperty(shell, 'clientWidth', { value: 0, configurable: true });
    Object.defineProperty(track, 'offsetLeft', { value: 0, configurable: true });
    Object.defineProperty(track, 'offsetWidth', { value: 0, configurable: true });

    const { daysData, sceneGroups } = loadHoneymoonData();
    const renderer = mountStageDOM(daysData);
    const timeline = mountTimelineRail(daysData);
    const parallax = mountParallaxScenes(daysData, sceneGroups);
    const fallbackGestures = bindGesturesAndPhysics(daysData, renderer, timeline, parallax);

    window.dispatchEvent(new Event('resize'));
    track.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));

    let nowMs = 5000;
    vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
    shell.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: 350, clientY: 5, pointerId: 90 })
    );
    shell.dispatchEvent(
      new PointerEvent('pointerup', { button: 0, clientX: 350, clientY: 5, pointerId: 90 })
    );
    vi.advanceTimersByTime(500);

    fallbackGestures.glideToDay(1);
    expect(window.location.hash).toBe('#day-2');

    // Toggling reduced-motion mid-glide jumps immediately on the next glide frame
    const mediaState = { matches: false };
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn().mockReturnValue(mediaState),
      configurable: true
    });
    const g2 = bindGesturesAndPhysics(daysData, renderer, timeline, parallax);
    g2.glideToDay(3);
    expect(shell.classList.contains('is-moving')).toBe(true);
    mediaState.matches = true;
    nowMs += 16;
    vi.advanceTimersByTime(20);
    expect(shell.classList.contains('is-moving')).toBe(false);
    expect(g2.getCurrentDayFloat()).toBe(3);

    // Falls back cleanly when theme-color-meta exists and window.CSS or CSS.supports is absent
    const originalCss = window.CSS;
    const restoredMeta = document.createElement('meta');
    restoredMeta.id = 'theme-color-meta';
    restoredMeta.content = '#000000';
    document.head.appendChild(restoredMeta);
    Reflect.deleteProperty(window, 'CSS');
    bindGesturesAndPhysics(daysData, renderer, timeline, parallax);
    expect(document.getElementById('theme-color-meta')).toBe(restoredMeta);
    expect(restoredMeta.content).toBe('#BAE6FD');

    Object.defineProperty(window, 'CSS', { value: {}, configurable: true });
    bindGesturesAndPhysics(daysData, renderer, timeline, parallax);
    expect(document.getElementById('theme-color-meta')).toBe(restoredMeta);

    // Removes #theme-color-meta on iOS/iPadOS WebKit (-webkit-touch-callout: none)
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
