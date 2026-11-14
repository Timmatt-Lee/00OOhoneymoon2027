import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mountStageDOM } from './renderer';
import type { DayData } from '../types/schedule';

const SAMPLE_DAYS: DayData[] = [
  {
    day: 1,
    date: '2027-03-02',
    csvFile: '01_0302.csv',
    label: '3/2 (二)',
    isDark: true,
    isSnowTinted: false,
    isOnsenSteam: false,
    isNightGlow: false,
    planeAction: 'arrive',
    groupIdx: 0,
    localIdx: 0,
    mapQuery: 'Sapporo Station',
    skyGrad: 'linear-gradient(180deg, #070B19 0%, #1E294B 100%)',
    topSkyHex: '#070B19',
    items: [
      {
        time: '09:45',
        title: 'Airport Check-in & <Tag>',
        subtitle: 'Terminal 1',
        mapQuery: 'Taoyuan Airport'
      },
      {
        time: '12:15',
        title: 'Flight to Sapporo',
        subtitle: ''
      }
    ]
  },
  {
    day: 2,
    date: '2027-03-03',
    csvFile: '02_0303.csv',
    label: '3/3 (三)',
    isDark: false,
    isSnowTinted: false,
    isOnsenSteam: false,
    isNightGlow: false,
    planeAction: 'none',
    groupIdx: 0,
    localIdx: 1,
    mapQuery: 'Asahikawa Station',
    skyGrad: 'linear-gradient(180deg, #BAE6FD 0%, #F8FAFC 100%)',
    topSkyHex: '#BAE6FD',
    items: [
      {
        time: '10:00',
        title: 'Morning Stroll',
        subtitle: 'Snowy park'
      }
    ]
  }
];

describe('mountStageDOM renderer', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="app-shell" class="theme-dark">
        <div id="sky-stack"></div>
        <nav id="story-bar-track"></nav>
        <div id="day-live-status" role="status" aria-live="polite"></div>
        <main id="schedule-stage"></main>
        <footer><a id="cityscape-map-link" href="#"></a></footer>
      </div>
    `;
  });

  it('pre-builds pill spans with zero mid-swipe allocations, rescues orphaned focus, and updates live status', () => {
    const refs = mountStageDOM(SAMPLE_DAYS);
    expect(refs.skyLayerEls).toHaveLength(2);
    expect(refs.storySlotEls).toHaveLength(2);
    expect(refs.schedulePanelEls).toHaveLength(2);

    const firstLink = refs.schedulePanelEls[0].querySelector<HTMLAnchorElement>('a.is-map-link');
    expect(firstLink).not.toBeNull();
    expect(firstLink?.textContent).toBe('Airport Check-in & <Tag>');
    expect(firstLink?.href).toContain('Taoyuan%20Airport');

    const rowsDay1 = refs.schedulePanelEls[0].querySelectorAll('.schedule-item-row');
    expect(rowsDay1[1].querySelector('.schedule-item-subtitle')).toBeNull();

    expect(refs.schedulePanelEls[0].inert).toBe(false);
    expect(refs.schedulePanelEls[1].inert).toBe(true);

    const seg0 = refs.storySlotEls[0].firstElementChild;
    const initialTagSpan = seg0?.firstElementChild;
    const liveStatus = document.getElementById('day-live-status');

    const createElSpy = vi.spyOn(document, 'createElement');

    // Initial sync does not announce to aria-live region
    refs.updateTopStoryBar(0, true);
    expect(refs.storySlotEls[0].getAttribute('aria-current')).toBe('step');
    expect(refs.storySlotEls[1].classList.contains('is-future')).toBe(true);
    expect(liveStatus?.textContent).toBe('');

    // Redundant call with identical day and theme returns early cleanly
    refs.updateTopStoryBar(0, true);
    expect(refs.storySlotEls[0].classList.contains('is-active')).toBe(true);

    // Focus an interactive link inside Day 1 panel before swiping toward Day 2
    firstLink?.focus();
    expect(document.activeElement).toBe(firstLink);

    const shell = document.getElementById('app-shell');

    // Mid-drag / mid-glide midpoint crossing (isSettled = false): flips visual pill and theme ONLY
    refs.updateTopStoryBar(1, false, false);
    expect(shell?.classList.contains('theme-light')).toBe(true);
    expect(refs.storySlotEls[1].getAttribute('aria-current')).toBe('step');
    expect(refs.schedulePanelEls[0].inert).toBe(false);
    expect(refs.schedulePanelEls[1].inert).toBe(true);
    expect(document.activeElement).toBe(firstLink);
    expect(liveStatus?.textContent).toBe('');
    expect(refs.cityscapeMapLinkEl.href).toContain('Sapporo%20Station');

    // Redundant unsettled call and same-day theme flip exercise both visual diff branches cleanly
    refs.updateTopStoryBar(1, false, false);
    refs.updateTopStoryBar(1, true, false);
    expect(shell?.classList.contains('theme-dark')).toBe(true);
    refs.updateTopStoryBar(1, false, false);
    expect(shell?.classList.contains('theme-light')).toBe(true);

    // Settling on Day 2 (isSettled = true): rescues focus, updates live region, map href, and panel.inert
    refs.updateTopStoryBar(1, false, true);
    expect(createElSpy).not.toHaveBeenCalled();
    expect(seg0?.firstElementChild).toBe(initialTagSpan);
    expect(document.activeElement).toBe(refs.storySlotEls[1]);
    expect(liveStatus?.textContent).toBe('Day 2 3/3 (三)');

    expect(shell?.classList.contains('theme-light')).toBe(true);
    expect(refs.storySlotEls[0].classList.contains('is-past')).toBe(true);
    expect(refs.storySlotEls[0].hasAttribute('aria-current')).toBe(false);
    expect(seg0?.classList.contains('is-active-pill')).toBe(false);
    expect(refs.storySlotEls[1].getAttribute('aria-current')).toBe('step');
    expect(refs.schedulePanelEls[0].inert).toBe(true);
    expect(refs.schedulePanelEls[1].inert).toBe(false);
    expect(refs.cityscapeMapLinkEl.href).toContain('Asahikawa%20Station');
    createElSpy.mockRestore();
  });

  it('handles missing #day-live-status element gracefully in minimal DOM fixtures', () => {
    document.getElementById('day-live-status')?.remove();
    const refs = mountStageDOM(SAMPLE_DAYS);
    refs.updateTopStoryBar(0, true);
    refs.updateTopStoryBar(1, false);
    expect(refs.storySlotEls[1].classList.contains('is-active')).toBe(true);
  });
});
