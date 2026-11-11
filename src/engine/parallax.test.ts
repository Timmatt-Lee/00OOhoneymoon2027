import { describe, it, expect, beforeEach } from 'vitest';
import { mountParallaxScenes } from './parallax';
import { loadHoneymoonData } from './loader';

describe('mountParallaxScenes', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <footer id="cityscape-footer">
        <div id="scene-groups-container"></div>
        <div id="snow-ground-slot"></div>
      </footer>
    `;
  });

  it('renders 3-layer parallax panning, cross-group clip transitions, wide-screen scaling, and plane actors', () => {
    const { daysData, sceneGroups } = loadHoneymoonData();
    const parallax = mountParallaxScenes(daysData, sceneGroups);

    const groups = document.querySelectorAll<HTMLElement>('.scene-group-clip');
    expect(groups).toHaveLength(5);

    // Day 1 (index 0, Group 0) on 390px viewport
    parallax.renderParallax(0, 0, 1, 0, 390);
    expect(groups[0].classList.contains('is-visible')).toBe(true);
    expect(groups[1].classList.contains('is-visible')).toBe(false);
    expect(groups[0].style.getPropertyValue('--pan-shift')).toBe('0.0px');

    // Re-running identical state hits cache guards cleanly
    parallax.renderParallax(0, 0, 1, 0, 390);

    // Cross-group swipe between Day 3 (idx 2, Group 0) and Day 4 (idx 3, Group 1) at t = 0.5
    parallax.renderParallax(2.5, 2, 3, 0.5, 400);
    expect(groups[0].classList.contains('is-visible')).toBe(true);
    expect(groups[1].classList.contains('is-visible')).toBe(true);
    expect(groups[0].style.getPropertyValue('--clip-x')).toBe('-200.0px');
    expect(groups[1].style.getPropertyValue('--clip-x')).toBe('200.0px');

    // Settle onto Group 2 (Day 6, idx 5) on a wide 1280px desktop screen -> Group 0 & 1 hide, Group 2 scales width to 1280px
    parallax.renderParallax(5, 5, 6, 0, 1280);
    expect(groups[0].classList.contains('is-visible')).toBe(false);
    expect(groups[1].classList.contains('is-visible')).toBe(false);
    expect(groups[2].classList.contains('is-visible')).toBe(true);
    const group2Bg = groups[2].querySelector<HTMLElement>('.parallax-bg');
    expect(group2Bg?.style.width).toBe('1280px');

    // Day 12 (idx 11, Group 4) triggers departing plane trajectory
    parallax.renderParallax(11, 11, 11, 0, 390);
    const departPlane = document.getElementById('day12-departing-plane');
    expect(departPlane?.style.opacity).toBe('1.000');
  });

  it('handles schedules without plane actions gracefully', () => {
    const { daysData, sceneGroups } = loadHoneymoonData();
    const noPlaneDays = daysData.map((d) => ({ ...d, planeAction: 'none' as const }));
    const parallax = mountParallaxScenes(noPlaneDays, sceneGroups);
    parallax.renderParallax(0, 0, 1, 0, 390);
    expect(document.getElementById('cityscape-footer')?.style.getPropertyValue('--arrive-p')).toBe(
      ''
    );
  });
});
