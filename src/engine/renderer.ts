import type { DayData } from '../types/schedule';
import { getRequiredAnchorById, getRequiredElementById } from '../utils/dom';
import { buildGoogleMapsUrl } from '../utils/themeColor';

export interface RendererRefs {
  skyLayerEls: HTMLElement[];
  storySlotEls: HTMLButtonElement[];
  schedulePanelEls: HTMLElement[];
  cityscapeMapLinkEl: HTMLAnchorElement;
  updateTopStoryBar(activeDayIdx: number, isDarkSky: boolean, isSettled?: boolean): void;
}

export function mountStageDOM(daysData: DayData[]): RendererRefs {
  const shellEl = getRequiredElementById('app-shell');
  const skyStack = getRequiredElementById('sky-stack');
  const track = getRequiredElementById('story-bar-track');
  const stage = getRequiredElementById('schedule-stage');
  const cityscapeMapLinkEl = getRequiredAnchorById('cityscape-map-link');
  cityscapeMapLinkEl.draggable = false;
  const liveStatusEl = document.getElementById('day-live-status');

  skyStack.replaceChildren();
  const skyLayerEls = daysData.map((day, idx) => {
    const layer = document.createElement('div');
    layer.className = 'sky-layer';
    layer.style.background = day.skyGrad;
    layer.style.opacity = idx === 0 ? '1' : '0';
    layer.style.visibility = idx === 0 ? 'visible' : 'hidden';
    skyStack.appendChild(layer);
    return layer;
  });

  track.replaceChildren();
  const storySegEls: HTMLSpanElement[] = [];
  const storySlotEls = daysData.map((day, idx) => {
    const slotBtn = document.createElement('button');
    slotBtn.type = 'button';
    slotBtn.dataset.day = String(idx);
    slotBtn.className = 'story-slot';
    slotBtn.setAttribute('aria-label', `Day ${day.day} ${day.label}`);

    const seg = document.createElement('span');
    seg.className = 'story-seg';

    const dayTag = document.createElement('span');
    dayTag.className = 'pill-day-tag';
    dayTag.textContent = `Day ${day.day}`;

    const labelSpan = document.createElement('span');
    labelSpan.textContent = day.label;

    seg.append(dayTag, labelSpan);
    slotBtn.appendChild(seg);
    track.appendChild(slotBtn);
    storySegEls.push(seg);
    return slotBtn;
  });

  stage.replaceChildren();
  const schedulePanelEls = daysData.map((day, dayIdx) => {
    const isInitialActive = dayIdx === 0;
    const themeCls = day.isDark ? 'theme-dark' : 'theme-light';

    const panel = document.createElement('section');
    panel.className = 'day-schedule-panel';
    panel.dataset.day = String(dayIdx);
    panel.setAttribute('aria-label', `Day ${day.day} ${day.label}`);
    panel.style.opacity = isInitialActive ? '1' : '0';
    panel.style.visibility = isInitialActive ? 'visible' : 'hidden';
    panel.style.transform = `translate3d(${isInitialActive ? 0 : 100}%,0,0)`;
    panel.inert = !isInitialActive;

    const listEl = document.createElement('ol');
    listEl.className = 'day-schedule-list';
    listEl.setAttribute('role', 'list');

    for (const item of day.items) {
      const rowEl = document.createElement('li');
      rowEl.className = 'schedule-item-row';

      const timeEl = document.createElement('time');
      timeEl.className = 'visually-hidden';
      timeEl.dateTime = item.time;
      timeEl.textContent = `${item.time} `;
      rowEl.appendChild(timeEl);

      if (item.mapQuery) {
        const titleLink = document.createElement('a');
        titleLink.className = `schedule-item-title is-map-link ${themeCls}`;
        titleLink.href = buildGoogleMapsUrl(item.mapQuery);
        titleLink.target = '_blank';
        titleLink.rel = 'noopener noreferrer';
        titleLink.draggable = false;
        titleLink.textContent = item.title;
        rowEl.appendChild(titleLink);
      } else {
        const titleDiv = document.createElement('div');
        titleDiv.className = `schedule-item-title ${themeCls}`;
        titleDiv.textContent = item.title;
        rowEl.appendChild(titleDiv);
      }

      if (item.subtitle) {
        const subtitleDiv = document.createElement('div');
        subtitleDiv.className = `schedule-item-subtitle ${themeCls}`;
        subtitleDiv.textContent = item.subtitle;
        rowEl.appendChild(subtitleDiv);
      }

      listEl.appendChild(rowEl);
    }

    panel.appendChild(listEl);
    stage.appendChild(panel);
    return panel;
  });

  let lastVisualDay = -1;
  let isLastVisualDark: boolean | null = null;
  let lastSettledDay = -1;

  function updateTopStoryBar(activeDayIdx: number, isDarkSky: boolean, isSettled = true): void {
    if (activeDayIdx !== lastVisualDay || isDarkSky !== isLastVisualDark) {
      lastVisualDay = activeDayIdx;
      isLastVisualDark = isDarkSky;

      shellEl.classList.toggle('theme-dark', isDarkSky);
      shellEl.classList.toggle('theme-light', !isDarkSky);

      storySlotEls.forEach((slot, idx) => {
        const seg = storySegEls[idx];
        const isActive = idx === activeDayIdx;
        if (isActive) {
          slot.className = 'story-slot is-active';
          slot.setAttribute('aria-current', 'step');
          seg.className = 'story-seg is-active-pill';
        } else {
          slot.className = `story-slot ${idx < activeDayIdx ? 'is-past' : 'is-future'}`;
          slot.removeAttribute('aria-current');
          seg.className = 'story-seg';
        }
      });
    }

    if (isSettled && activeDayIdx !== lastSettledDay) {
      const isInitialSync = lastSettledDay === -1;
      lastSettledDay = activeDayIdx;

      const activeDay = daysData[activeDayIdx];
      cityscapeMapLinkEl.href = buildGoogleMapsUrl(activeDay.mapQuery);
      cityscapeMapLinkEl.setAttribute(
        'aria-label',
        `Explore Day ${activeDay.day} ${activeDay.mapQuery} on Google Maps`
      );

      if (!isInitialSync && liveStatusEl) {
        liveStatusEl.textContent = `Day ${activeDay.day} ${activeDay.label}`;
      }

      schedulePanelEls.forEach((panel, idx) => {
        const isInactive = idx !== activeDayIdx;
        if (isInactive && panel.contains(document.activeElement)) {
          storySlotEls[activeDayIdx].focus();
        }
        panel.inert = isInactive;
      });
    }
  }

  return {
    skyLayerEls,
    storySlotEls,
    schedulePanelEls,
    cityscapeMapLinkEl,
    updateTopStoryBar
  };
}
