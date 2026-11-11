import { describe, it, expect, beforeEach } from 'vitest';
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

  it('interpolates unequal item counts, matching timestamps, extra unused nodes, and window resize', () => {
    const days = [
      makeDay(1, ['08:00', '12:00']),
      makeDay(2, ['08:00', '10:00', '15:00']),
      makeDay(3, ['09:00', '11:00', '14:00', '18:00'])
    ];

    const container = document.getElementById('timeline-nodes-container') as HTMLElement;
    Object.defineProperty(container, 'clientHeight', { value: 400, configurable: true });

    const tl = mountTimelineRail(days);
    const nodes = container.querySelectorAll<HTMLElement>('.tl-node');
    expect(nodes).toHaveLength(4);

    // Interpolate between Day 1 (2 items) and Day 2 (3 items) at t = 0.5:
    // - Node 0 has identical time '08:00' -> opA = '1', opB = '0'
    // - Node 2 is !isInA && isInB -> fades in at 0.500
    // - Node 3 is unused (>= maxItemCount 3) -> opacity '0'
    tl.renderInterpolation(0, 1, 0.5);
    expect(nodes[0].querySelector<HTMLElement>('.tl-time-a')?.style.opacity).toBe('1');
    expect(nodes[0].querySelector<HTMLElement>('.tl-time-b')?.style.opacity).toBe('0');
    expect(nodes[2].style.opacity).toBe('0.500');
    expect(nodes[3].style.opacity).toBe('0');

    // Re-running with identical arguments hits cached short-circuits cleanly
    tl.renderInterpolation(0, 1, 0.5);

    // Interpolate between Day 3 (4 items) and Day 1 (2 items) -> Node 2 & 3 are isInA && !isInB
    tl.renderInterpolation(2, 0, 0.4);
    expect(nodes[2].style.opacity).toBe('0.600');

    // Resize updates railHeight (including fallback when clientHeight is 0)
    Object.defineProperty(container, 'clientHeight', { value: 500, configurable: true });
    window.dispatchEvent(new Event('resize'));
    expect(nodes[1].style.transform).toContain('px');

    Object.defineProperty(container, 'clientHeight', { value: 0, configurable: true });
    window.dispatchEvent(new Event('resize'));
    expect(nodes[0].style.transform).toContain('0.0px');
  });
});
