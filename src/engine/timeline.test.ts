import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mountTimelineRail } from './timeline';
import type { DayData } from '../types/schedule';

function makeDay(day: number, times: string[]): DayData {
  return {
    day,
    date: `2027-03-0${day}`,
    csvFile: `0${day}_030${day}.csv`,
    label: `3/${day}`,
    isDark: true,
    isSnowTinted: false,
    isOnsenSteam: false,
    isNightGlow: false,
    planeAction: 'none',
    groupIdx: 0,
    localIdx: 0,
    mapQuery: 'Sapporo',
    skyGrad: 'linear-gradient(#070B19, #1E294B)',
    topSkyHex: '#070B19',
    items: times.map((t, idx) => ({
      time: t,
      title: `Stop ${idx + 1}`,
      subtitle: 'Details'
    }))
  };
}

describe('mountTimelineRail', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="timeline-nodes-container"></div>';
  });

  it('interpolates unequal item counts without ghost timestamps, dot scale transforms, or layout reads during frames', () => {
    const days = [
      makeDay(1, ['08:00', '12:00']),
      makeDay(2, ['08:00', '10:00', '15:00']),
      makeDay(3, ['09:00', '11:00', '14:00', '18:00'])
    ];

    const container = document.getElementById('timeline-nodes-container');
    if (!container) throw new Error('Expected container');
    Object.defineProperty(container, 'clientHeight', {
      get: () => 400,
      configurable: true
    });

    const tl = mountTimelineRail(days);
    const heightGetterSpy = vi.spyOn(container, 'clientHeight', 'get');

    const nodes = container.querySelectorAll<HTMLElement>('.tl-node');
    expect(nodes).toHaveLength(4);

    // Day 1 (2 items) -> Day 2 (3 items) at t = 0.5:
    // - Node 0 has identical time '08:00' -> opA = '1', opB = '0'
    // - Node 1 has differing times ('12:00' vs '10:00') -> opA = '0.500', opB = '0.500'
    // - Node 2 is only in B -> nodeEl fades at '0.500', opA = '0', opB = '1' (no ghost '12:00' and zero dot scale transform)
    // - Node 3 is unused -> opacity '0'
    tl.renderInterpolation(0, 1, 0.5);
    expect(nodes[0].querySelector<HTMLElement>('.tl-time-a')?.style.opacity).toBe('1');
    expect(nodes[0].querySelector<HTMLElement>('.tl-time-b')?.style.opacity).toBe('0');
    expect(nodes[1].querySelector<HTMLElement>('.tl-time-a')?.style.opacity).toBe('0.500');
    expect(nodes[1].querySelector<HTMLElement>('.tl-time-b')?.style.opacity).toBe('0.500');
    expect(nodes[2].style.opacity).toBe('0.500');
    expect(nodes[2].querySelector<HTMLElement>('.tl-dot')?.style.transform).toBe('');
    expect(nodes[2].querySelector<HTMLElement>('.tl-time-a')?.style.opacity).toBe('0');
    expect(nodes[2].querySelector<HTMLElement>('.tl-time-b')?.style.opacity).toBe('1');
    expect(nodes[3].style.opacity).toBe('0');

    // Re-running identical state hits cache short-circuits cleanly
    tl.renderInterpolation(0, 1, 0.5);

    // Day 3 (4 items) -> Day 1 (2 items) at t = 0.4:
    // - Node 2 & 3 are only in A -> nodeEl fades at '0.600', opA = '1', opB = '0'
    tl.renderInterpolation(2, 0, 0.4);
    expect(nodes[2].style.opacity).toBe('0.600');
    expect(nodes[2].querySelector<HTMLElement>('.tl-time-a')?.style.opacity).toBe('1');
    expect(nodes[2].querySelector<HTMLElement>('.tl-time-b')?.style.opacity).toBe('0');

    // Return to 2-item pair so previously visible Node 3 transitions back to unused '0'
    tl.renderInterpolation(0, 1, 0.2);
    expect(nodes[3].style.opacity).toBe('0');

    // Zero synchronous clientHeight reads occurred across all interpolation frames
    expect(heightGetterSpy).not.toHaveBeenCalled();

    // Window resize updates cached railHeight (including 460px fallback when clientHeight is 0)
    Object.defineProperty(container, 'clientHeight', {
      get: () => 500,
      configurable: true
    });
    window.dispatchEvent(new Event('resize'));
    expect(nodes[1].style.transform).toContain('px');

    Object.defineProperty(container, 'clientHeight', {
      get: () => 0,
      configurable: true
    });
    window.dispatchEvent(new Event('resize'));
    expect(nodes[0].style.transform).toContain('0.0px');
  });
});
