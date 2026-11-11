import { describe, it, expect, beforeEach } from 'vitest';
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
        <main id="schedule-stage"></main>
        <footer><a id="cityscape-map-link" href="#"></a></footer>
      </div>
    `;
  });

  it('constructs escaped DOM nodes, semantic map links, inert states, and story bar updates', () => {
    const refs = mountStageDOM(SAMPLE_DAYS);
    expect(refs.skyLayerEls).toHaveLength(2);
    expect(refs.storySlotEls).toHaveLength(2);
    expect(refs.schedulePanelEls).toHaveLength(2);

    // Special characters in title are rendered safely as literal textContent, not HTML tags
    const firstLink = refs.schedulePanelEls[0].querySelector<HTMLAnchorElement>('a.is-map-link');
    expect(firstLink).not.toBeNull();
    expect(firstLink?.textContent).toBe('Airport Check-in & <Tag>');
    expect(firstLink?.href).toContain('Taoyuan%20Airport');

    // Empty subtitle is omitted cleanly
    const rowsDay1 = refs.schedulePanelEls[0].querySelectorAll('.schedule-item-row');
    expect(rowsDay1[1].querySelector('.schedule-item-subtitle')).toBeNull();

    // Initial inert state
    expect(refs.schedulePanelEls[0].inert).toBe(false);
    expect(refs.schedulePanelEls[1].inert).toBe(true);

    // Update story bar to Day 1 (dark)
    refs.updateTopStoryBar(0, true);
    expect(refs.storySlotEls[0].getAttribute('aria-current')).toBe('step');
    expect(refs.storySlotEls[1].classList.contains('is-future')).toBe(true);

    // Redundant call with identical day and theme returns early cleanly
    refs.updateTopStoryBar(0, true);
    expect(refs.storySlotEls[0].classList.contains('is-active')).toBe(true);

    // Transition to Day 2 (light) -> slot 0 becomes is-past and clears pill children, panel 1 becomes active
    refs.updateTopStoryBar(1, false);
    const shell = document.getElementById('app-shell');
    expect(shell?.classList.contains('theme-light')).toBe(true);
    expect(refs.storySlotEls[0].classList.contains('is-past')).toBe(true);
    expect(refs.storySlotEls[0].hasAttribute('aria-current')).toBe(false);
    expect(refs.storySlotEls[0].firstElementChild?.childNodes.length).toBe(0);
    expect(refs.storySlotEls[1].getAttribute('aria-current')).toBe('step');
    expect(refs.schedulePanelEls[0].inert).toBe(true);
    expect(refs.schedulePanelEls[1].inert).toBe(false);
    expect(refs.cityscapeMapLinkEl.href).toContain('Asahikawa%20Station');
  });
});
