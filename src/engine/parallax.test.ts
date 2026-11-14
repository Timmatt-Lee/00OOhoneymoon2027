import { describe, it, expect, beforeEach } from 'vitest';
import { mountParallaxScenes, type GroupSvgAssetBundle } from './parallax';
import { loadHoneymoonData } from './loader';

const MINIMAL_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>';

describe('mountParallaxScenes', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <footer id="cityscape-footer">
        <div id="scene-groups-container"></div>
        <div id="snow-ground-slot"></div>
      </footer>
    `;
  });

  it('pre-applies layer widths upfront, pre-stages neighbor groups offscreen at settled boundaries, and drives 0-Cold-Raster cross-group swipes', () => {
    const { daysData, sceneGroups } = loadHoneymoonData();
    const parallax = mountParallaxScenes(daysData, sceneGroups);

    const groups = document.querySelectorAll<HTMLElement>('.scene-group-clip');
    expect(groups).toHaveLength(5);

    // Day 1 (index 0, Group 0) settled at t = 0: Group 0 is onscreen; Day 2 is also Group 0 so Group 1 stays hidden
    parallax.renderParallax(0, 0, 1, 0, 390);
    expect(groups[0].classList.contains('is-visible')).toBe(true);
    expect(groups[1].classList.contains('is-visible')).toBe(false);
    expect(groups[0].style.getPropertyValue('--pan-shift')).toBe('0.0px');
    expect(groups[0].style.getPropertyValue('--clip-x')).toBe('');

    // Re-running identical settled state hits cache guards cleanly
    parallax.renderParallax(0, 0, 1, 0, 390);

    // Mid-swipe within Group 0 (Day 1 -> Day 2 at t = 0.5) updates direct transforms without mutating --pan-shift
    parallax.renderParallax(0.5, 0, 1, 0.5, 390);
    expect(groups[0].querySelector<HTMLElement>('.parallax-fg')?.style.transform).toBe(
      'translate3d(-27.0px, 0, 0)'
    );
    expect(groups[0].style.getPropertyValue('--pan-shift')).toBe('0.0px');

    // Settling at endpoint t = 1 updates --pan-shift even if lastPan was within 0.05px
    parallax.renderParallax(0.9999, 0, 1, 0.9999, 390);
    expect(groups[0].style.getPropertyValue('--pan-shift')).toBe('0.0px');
    parallax.renderParallax(1, 0, 1, 1, 390);
    expect(groups[0].style.getPropertyValue('--pan-shift')).toBe('-54.0px');

    // Settling on Day 3 (idx 2, Group 0 endDay) pre-stages Group 1 offscreen at +viewportWidth with startDay panShift
    parallax.renderParallax(2, 2, 3, 0, 400);
    expect(groups[0].classList.contains('is-visible')).toBe(true);
    expect(groups[1].classList.contains('is-visible')).toBe(true);
    expect(groups[0].style.transform).toBe('translate3d(0.0px, 0, 0)');
    expect(groups[1].style.transform).toBe('translate3d(400.0px, 0, 0)');
    expect(groups[1].style.getPropertyValue('--pan-shift')).toBe('0.0px');

    // Frame 1 & midpoint of cross-group swipe Day 3 -> Day 4 adds ZERO new .is-visible classes
    let visibleMutationCount = 0;
    const obs = new MutationObserver(() => {
      visibleMutationCount++;
    });
    for (const grpEl of groups) {
      obs.observe(grpEl, { attributes: true, attributeFilter: ['class'] });
    }
    parallax.renderParallax(2.02, 2, 3, 0.02, 400);
    parallax.renderParallax(2.5, 2, 3, 0.5, 400);
    obs.disconnect();
    expect(visibleMutationCount).toBe(0);
    expect(groups[0].style.transform).toBe('translate3d(-200.0px, 0, 0)');
    expect(groups[1].style.transform).toBe('translate3d(200.0px, 0, 0)');

    // Settling on Day 4 (idx 3, Group 1 startDay) keeps Group 0 pre-staged offscreen at -400px with endDay panShift (-108px)
    parallax.renderParallax(3, 3, 4, 0, 400);
    expect(groups[0].classList.contains('is-visible')).toBe(true);
    expect(groups[0].style.transform).toBe('translate3d(-400.0px, 0, 0)');
    expect(groups[0].style.getPropertyValue('--pan-shift')).toBe('-108.0px');
    expect(groups[1].style.transform).toBe('translate3d(0.0px, 0, 0)');

    // Settle onto Group 2 (Day 6, idx 5) on a wide 1280px desktop screen: ALL groups pre-apply width upfront
    parallax.renderParallax(5, 5, 6, 0, 1280);
    expect(groups[0].classList.contains('is-visible')).toBe(false);
    expect(groups[1].classList.contains('is-visible')).toBe(true);
    expect(groups[1].style.transform).toBe('translate3d(-1280.0px, 0, 0)');
    expect(groups[1].style.getPropertyValue('--pan-shift')).toBe('-168.0px');
    expect(groups[2].classList.contains('is-visible')).toBe(true);
    expect(groups[2].style.transform).toBe('translate3d(0.0px, 0, 0)');
    expect(groups[3].classList.contains('is-visible')).toBe(true);
    expect(groups[3].style.transform).toBe('translate3d(1280.0px, 0, 0)');
    expect(groups[4].classList.contains('is-visible')).toBe(false);
    expect(groups[2].querySelector<HTMLElement>('.parallax-bg')?.style.width).toBe('1280px');
    expect(groups[4].querySelector<HTMLElement>('.parallax-bg')?.style.width).toBe('2080px');

    // Mid-swipe Day 6 -> Day 7 keeps pre-staged Group 1 parked offscreen (and re-parks cleanly if viewport resizes mid-swipe)
    parallax.renderParallax(5.5, 5, 6, 0.5, 1280);
    expect(groups[1].classList.contains('is-visible')).toBe(true);
    expect(groups[1].style.transform).toBe('translate3d(-1280.0px, 0, 0)');
    parallax.renderParallax(5.5, 5, 6, 0.5, 1440);
    expect(groups[1].style.transform).toBe('translate3d(-1440.0px, 0, 0)');

    // Mid-swipe Day 6 -> Day 5 re-parks pre-staged Group 3 (> groupA) offscreen if viewport resizes mid-swipe
    parallax.renderParallax(4.5, 4, 5, 0.5, 1600);
    expect(groups[3].style.transform).toBe('translate3d(1600.0px, 0, 0)');

    // Multi-group burst mid-motion prunes distant groups (< groupA - 1 or > groupB + 1) so layers never accumulate
    parallax.renderParallax(7.5, 7, 8, 0.5, 1600);
    expect(groups[1].classList.contains('is-visible')).toBe(false);
    expect(groups[2].classList.contains('is-visible')).toBe(false);
    parallax.renderParallax(2.5, 2, 3, 0.5, 1600);
    expect(groups[4].classList.contains('is-visible')).toBe(false);

    // Day 12 (idx 11, Group 4) triggers departing plane trajectory without footer custom properties
    parallax.renderParallax(11, 11, 11, 0, 390);
    const departPlane = document.getElementById('day12-departing-plane');
    expect(departPlane?.style.opacity).toBe('1.000');
    expect(departPlane?.style.transform).toContain('rotate(-11deg)');
    expect(document.getElementById('cityscape-footer')?.style.getPropertyValue('--arrive-p')).toBe(
      ''
    );
  });

  it('handles schedules without plane actions or custom asset bundles without planes gracefully', () => {
    const { daysData, sceneGroups } = loadHoneymoonData();
    const noPlaneDays = daysData.map((d) => ({ ...d, planeAction: 'none' as const }));
    const parallaxNoActions = mountParallaxScenes(noPlaneDays, sceneGroups);
    parallaxNoActions.renderParallax(0, 0, 1, 0, 390);

    const customBundles: readonly GroupSvgAssetBundle[] = sceneGroups.map(() => ({
      bg: MINIMAL_SVG,
      mid: MINIMAL_SVG,
      fg: MINIMAL_SVG
    }));
    const parallaxNoPlaneEls = mountParallaxScenes(daysData, sceneGroups, customBundles);
    parallaxNoPlaneEls.renderParallax(0, 0, 1, 0, 390);
    parallaxNoPlaneEls.renderParallax(11, 11, 11, 0, 390);
    expect(document.getElementById('day1-arriving-plane')).toBeNull();
    expect(document.getElementById('day12-departing-plane')).toBeNull();
  });
});
