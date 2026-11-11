import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadHoneymoonData } from './loader';
import { mountStageDOM } from './renderer';
import { mountTimelineRail } from './timeline';
import { mountParallaxScenes } from './parallax';
import { bindGesturesAndPhysics } from './gestures';

describe('bindGesturesAndPhysics', () => {
  beforeEach(() => {
    window.location.hash = '';
    document.body.innerHTML = `
      <meta id="theme-color-meta" content="#000000" />
      <div id="app-shell" class="theme-dark">
        <div id="sky-stack"></div>
        <div id="stage-frame">
          <header id="top-header"><nav id="story-bar-track"></nav></header>
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

  function setupEngine(isReducedMotion = false, initialHash = '') {
    window.location.hash = initialHash;
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn().mockReturnValue({ matches: isReducedMotion }),
      configurable: true
    });

    const shell = document.getElementById('app-shell') as HTMLElement;
    const track = document.getElementById('story-bar-track') as HTMLElement;
    const footer = document.getElementById('cityscape-footer') as HTMLElement;

    Object.defineProperty(shell, 'clientWidth', { value: 400, configurable: true });
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
    vi.spyOn(footer, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 639,
      width: 400,
      height: 205,
      right: 400,
      bottom: 844,
      x: 0,
      y: 639,
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

    return { shell, track, footer, renderer, gestures };
  }

  it('handles story bar scrubbing, keyboard slot click, arrow keys, hashchange, and resize', () => {
    const rafCallbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    });

    const { track, gestures } = setupEngine(false, '#day-2');
    expect(gestures.getCurrentDayFloat()).toBe(1);

    // Scrub on story bar track
    const slot0 = track.querySelector('[data-day="0"]') as HTMLElement;
    slot0.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 0, pointerId: 1 })
    );
    expect(gestures.getCurrentDayFloat()).toBe(0);

    // Ignore non-primary mouse button on track
    slot0.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, button: 1, clientX: 0, pointerId: 2 })
    );

    // Ignore mismatched pointerId on pointermove, then scrub to middle of bar
    track.dispatchEvent(new PointerEvent('pointermove', { clientX: 200, pointerId: 99 }));
    track.dispatchEvent(new PointerEvent('pointermove', { clientX: 200, pointerId: 1 }));
    expect(gestures.getCurrentDayFloat()).toBeGreaterThan(3);
    track.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }));
    track.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1 }));

    // Keyboard Enter/Space on story-slot triggers click with detail === 0
    const slot4 = track.querySelector('[data-day="4"]') as HTMLElement;
    slot4.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
    expect(gestures.getCurrentDayFloat()).toBe(4);
    // Pointer click (detail === 1) is ignored by keyboard handler
    slot4.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));

    // Keyboard ArrowRight / ArrowLeft + spring convergence
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    let fakeTime = 100;
    while (rafCallbacks.length > 0) {
      const cb = rafCallbacks.shift();
      fakeTime += 20;
      cb?.(fakeTime);
    }
    expect(gestures.getCurrentDayFloat()).toBe(4);

    // URL hashchange navigation
    window.location.hash = '#day-7';
    window.dispatchEvent(new Event('hashchange'));
    while (rafCallbacks.length > 0) {
      const cb = rafCallbacks.shift();
      fakeTime += 25;
      cb?.(fakeTime);
    }
    expect(gestures.getCurrentDayFloat()).toBe(6);

    // Resize recalculates dimensions cleanly
    window.dispatchEvent(new Event('resize'));
  });

  it('handles horizontal swipe rubber-banding, click suppression, left/right/center tap, map links, and reduced motion', () => {
    const rafCallbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    let nowMs = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => nowMs);

    const { shell, renderer } = setupEngine(false);

    // Ignore secondary button or story-bar target on shell pointerdown
    shell.dispatchEvent(new PointerEvent('pointerdown', { button: 2, clientX: 100, pointerId: 1 }));

    // Rubber-band swipe past left edge (Day 1 -> dx > 0 -> raw < 0) and release back
    shell.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: 100, clientY: 300, pointerId: 10 })
    );
    // Ignore other pointerId
    shell.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 200, clientY: 300, pointerId: 99 })
    );
    // Vertical movement does not engage horizontal swipe
    shell.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 102, clientY: 340, pointerId: 10 })
    );
    // Horizontal drag right triggers rubber-band < 0
    shell.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 220, clientY: 300, pointerId: 10 })
    );
    // Run stepSpring while dragging
    rafCallbacks.shift()?.(1016);
    expect(shell.classList.contains('is-swiping')).toBe(true);

    // Drag left to advance to Day 2
    shell.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 20, clientY: 300, pointerId: 10 })
    );
    shell.dispatchEvent(
      new PointerEvent('pointerup', { clientX: 20, clientY: 300, pointerId: 10 })
    );
    // Ignore mismatched pointerup
    shell.dispatchEvent(
      new PointerEvent('pointerup', { clientX: 20, clientY: 300, pointerId: 99 })
    );

    // Next click after horizontal drag is suppressed
    const suppressedClick = new MouseEvent('click', { bubbles: true, cancelable: true });
    shell.dispatchEvent(suppressedClick);
    expect(suppressedClick.defaultPrevented).toBe(true);

    // Settle spring to Day 2
    while (rafCallbacks.length > 0) {
      nowMs += 25;
      rafCallbacks.shift()?.(nowMs);
    }

    // Small horizontal wiggle (6px..30px) snaps to nearest currentPos
    shell.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: 200, clientY: 300, pointerId: 11 })
    );
    shell.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 185, clientY: 300, pointerId: 11 })
    );
    shell.dispatchEvent(
      new PointerEvent('pointerup', { clientX: 185, clientY: 300, pointerId: 11 })
    );

    // Horizontal swipe right (dx > 36) glides to previous day
    shell.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: 100, clientY: 300, pointerId: 111 })
    );
    shell.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 180, clientY: 300, pointerId: 111 })
    );
    shell.dispatchEvent(
      new PointerEvent('pointerup', { clientX: 180, clientY: 300, pointerId: 111 })
    );

    // Right tap, Left tap, Center tap
    nowMs += 500;
    shell.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: 350, clientY: 300, pointerId: 12 })
    );
    shell.dispatchEvent(
      new PointerEvent('pointerup', { button: 0, clientX: 350, clientY: 300, pointerId: 12 })
    );
    nowMs += 500;
    shell.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: 50, clientY: 300, pointerId: 13 })
    );
    shell.dispatchEvent(
      new PointerEvent('pointerup', { button: 0, clientX: 50, clientY: 300, pointerId: 13 })
    );
    nowMs += 500;
    shell.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: 200, clientY: 300, pointerId: 14 })
    );
    shell.dispatchEvent(
      new PointerEvent('pointerup', { button: 0, clientX: 200, clientY: 300, pointerId: 14 })
    );

    // Vertical drag > 10px (not horizontal, dist >= 10) settles cleanly
    nowMs += 500;
    shell.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: 200, clientY: 300, pointerId: 15 })
    );
    shell.dispatchEvent(
      new PointerEvent('pointerup', { button: 0, clientX: 200, clientY: 350, pointerId: 15 })
    );

    // Synthetic footer tap opens Google Maps
    nowMs += 500;
    shell.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: 200, clientY: 780, pointerId: 16 })
    );
    shell.dispatchEvent(
      new PointerEvent('pointerup', { button: 0, clientX: 200, clientY: 780, pointerId: 16 })
    );
    expect(openSpy).toHaveBeenCalled();

    // Direct click on cityscapeMapLinkEl opens Google Maps
    openSpy.mockClear();
    renderer.cityscapeMapLinkEl.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true })
    );
    expect(openSpy).toHaveBeenCalledTimes(1);

    // Tapping an inline map link <a> does not hijack day navigation
    const mapAnchor = renderer.schedulePanelEls[0].querySelector('a.is-map-link') as HTMLElement;
    mapAnchor.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        button: 0,
        clientX: 150,
        clientY: 200,
        pointerId: 17
      })
    );
    mapAnchor.dispatchEvent(
      new PointerEvent('pointerup', {
        bubbles: true,
        button: 0,
        clientX: 150,
        clientY: 200,
        pointerId: 17
      })
    );

    // Reduced motion mode + rubber-band past maxIdx (Day 12)
    const rm = setupEngine(true, '#day-12');
    rm.shell.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: 300, clientY: 300, pointerId: 20 })
    );
    rm.shell.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 150, clientY: 300, pointerId: 20 })
    );
    rm.shell.dispatchEvent(
      new PointerEvent('pointerup', { clientX: 150, clientY: 300, pointerId: 20 })
    );
    expect(rm.gestures.getCurrentDayFloat()).toBe(11);
  });

  it('falls back gracefully when matchMedia or optional DOM elements are absent', () => {
    Reflect.deleteProperty(window, 'matchMedia');
    document.getElementById('theme-color-meta')?.remove();
    document
      .getElementById('stage-frame')
      ?.replaceWith(...Array.from(document.getElementById('stage-frame')?.childNodes ?? []));

    const { daysData, sceneGroups } = loadHoneymoonData();
    const renderer = mountStageDOM(daysData);
    const timeline = mountTimelineRail(daysData);
    const parallax = mountParallaxScenes(daysData, sceneGroups);
    const gestures = bindGesturesAndPhysics(daysData, renderer, timeline, parallax);

    const shell = document.getElementById('app-shell') as HTMLElement;
    const track = document.getElementById('story-bar-track') as HTMLElement;
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

    gestures.glideToDay(2);
    expect(window.location.hash).toBe('#day-3');

    // Also verify reduced-motion canceling an in-flight RAF spring
    const mediaState = { matches: false };
    Object.defineProperty(window, 'matchMedia', {
      value: vi.fn().mockReturnValue(mediaState),
      configurable: true
    });
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 77);
    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    const g2 = bindGesturesAndPhysics(daysData, renderer, timeline, parallax);
    g2.glideToDay(4);
    mediaState.matches = true;
    nowMs += 500;
    g2.glideToDay(6);
    expect(cancelSpy).toHaveBeenCalledWith(77);
  });
});
