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

  it('drives direct CSSOM transforms without mid-swipe custom-property thrashing and updates --pan-shift on settle', () => {
    const { daysData, sceneGroups } = loadHoneymoonData();
    const parallax = mountParallaxScenes(daysData, sceneGroups);

    const groups = document.querySelectorAll<HTMLElement>('.scene-group-clip');
    expect(groups).toHaveLength(5);

    // Day 1 (index 0, Group 0) settled at t = 0
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

    // Cross-group swipe between Day 3 (idx 2, Group 0) and Day 4 (idx 3, Group 1) at t = 0.5
    parallax.renderParallax(2.5, 2, 3, 0.5, 400);
    expect(groups[0].classList.contains('is-visible')).toBe(true);
    expect(groups[1].classList.contains('is-visible')).toBe(true);
    expect(groups[0].style.transform).toBe('translate3d(-200.0px, 0, 0)');
    expect(groups[1].style.transform).toBe('translate3d(200.0px, 0, 0)');
    expect(groups[0].style.getPropertyValue('--clip-x')).toBe('');

    // Settle onto Group 2 (Day 6, idx 5) on a wide 1280px desktop screen
    parallax.renderParallax(5, 5, 6, 0, 1280);
    expect(groups[0].classList.contains('is-visible')).toBe(false);
    expect(groups[1].classList.contains('is-visible')).toBe(false);
    expect(groups[2].classList.contains('is-visible')).toBe(true);
    const group2Bg = groups[2].querySelector<HTMLElement>('.parallax-bg');
    expect(group2Bg?.style.width).toBe('1280px');

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
