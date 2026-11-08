import type { DayData, SceneGroupConfig } from '../types/schedule';
import group0Bg from '../assets/scenes/group0-bg.svg?raw';
import group0Mid from '../assets/scenes/group0-mid.svg?raw';
import group0Fg from '../assets/scenes/group0-fg.svg?raw';
import group1Bg from '../assets/scenes/group1-bg.svg?raw';
import group1Mid from '../assets/scenes/group1-mid.svg?raw';
import group1Fg from '../assets/scenes/group1-fg.svg?raw';
import group2Bg from '../assets/scenes/group2-bg.svg?raw';
import group2Mid from '../assets/scenes/group2-mid.svg?raw';
import group2Fg from '../assets/scenes/group2-fg.svg?raw';
import group3Bg from '../assets/scenes/group3-bg.svg?raw';
import group3Mid from '../assets/scenes/group3-mid.svg?raw';
import group3Fg from '../assets/scenes/group3-fg.svg?raw';
import group4Bg from '../assets/scenes/group4-bg.svg?raw';
import group4Mid from '../assets/scenes/group4-mid.svg?raw';
import group4Fg from '../assets/scenes/group4-fg.svg?raw';
import jetlinerArriveSvg from '../assets/scenes/jetliner-arrive.svg?raw';
import jetlinerDepartSvg from '../assets/scenes/jetliner-depart.svg?raw';
import snowGroundSvg from '../assets/scenes/snow-ground.svg?raw';

const GROUP_SVG_ASSETS = [
  { bg: group0Bg, mid: group0Mid, fg: group0Fg, planeId: 'day1-arriving-plane', planeCls: 'plane-arrive', planeSvg: jetlinerArriveSvg },
  { bg: group1Bg, mid: group1Mid, fg: group1Fg, planeId: null, planeCls: '', planeSvg: '' },
  { bg: group2Bg, mid: group2Mid, fg: group2Fg, planeId: null, planeCls: '', planeSvg: '' },
  { bg: group3Bg, mid: group3Mid, fg: group3Fg, planeId: null, planeCls: '', planeSvg: '' },
  { bg: group4Bg, mid: group4Mid, fg: group4Fg, planeId: 'day12-departing-plane', planeCls: 'plane-depart', planeSvg: jetlinerDepartSvg }
];

export interface ParallaxController {
  renderParallax(clamped: number, idxA: number, idxB: number, t: number, viewportWidth: number): void;
}

export function mountParallaxScenes(daysData: DayData[], sceneGroups: SceneGroupConfig[]): ParallaxController {
  const snowSlot = document.getElementById('snow-ground-slot');
  if (snowSlot) snowSlot.innerHTML = snowGroundSvg;

  const footerEl = document.getElementById('cityscape-footer')!;
  const container = document.getElementById('scene-groups-container')!;
  container.innerHTML = sceneGroups
    .map((grp, idx) => {
      const a = GROUP_SVG_ASSETS[idx];
      const w = `${grp.widthPx}px`;
      const planeHtml = a.planeId ? `<div id="${a.planeId}" class="plane-actor ${a.planeCls}">${a.planeSvg}</div>` : '';
      return `
        <div class="scene-group-clip" data-group="${grp.groupIdx}">
          <div class="parallax-layer parallax-bg" style="width:${w}">${a.bg}</div>
          <div class="parallax-layer parallax-mid" style="width:${w}">${a.mid}</div>
          <div class="parallax-layer parallax-fg" style="width:${w}">${a.fg}</div>
          ${planeHtml}
        </div>`;
    })
    .join('');

  const cachedGroups = Array.from(container.querySelectorAll<HTMLElement>('.scene-group-clip')).map((clipEl) => ({
    clipEl,
    bgEl: clipEl.querySelector<HTMLElement>('.parallax-bg')!,
    midEl: clipEl.querySelector<HTMLElement>('.parallax-mid')!,
    fgEl: clipEl.querySelector<HTMLElement>('.parallax-fg')!,
    visible: false,
    lastClipX: -99999,
    lastPan: -99999
  }));

  const planeArriveEl = document.getElementById('day1-arriving-plane');
  const planeDepartEl = document.getElementById('day12-departing-plane');
  let lastArriveP = -1;
  let lastDepartP = -1;

  return {
    renderParallax(clamped, idxA, idxB, t, viewportWidth) {
      const groupA = daysData[idxA].groupIdx;
      const groupB = daysData[idxB].groupIdx;

      for (let g = 0; g < sceneGroups.length; g++) {
        const grp = sceneGroups[g];
        const cg = cachedGroups[g];
        const isGroupA = g === groupA;
        const isGroupB = g === groupB;

        if (!isGroupA && !isGroupB) {
          if (cg.visible) {
            cg.clipEl.classList.remove('is-visible');
            cg.visible = false;
          }
          continue;
        }

        if (!cg.visible) {
          cg.clipEl.classList.add('is-visible');
          cg.visible = true;
        }

        const clipX = groupA === groupB ? 0 : isGroupA ? -t * viewportWidth : (1 - t) * viewportWidth;
        const localDayOffset = (groupA === groupB ? clamped : isGroupA ? idxA : idxB) - grp.startDay;
        const panShift = -localDayOffset * grp.panStepPx;

        if (Math.abs(clipX - cg.lastClipX) > 0.05) {
          const cx = clipX.toFixed(1);
          cg.clipEl.style.transform = `translate3d(${cx}px, 0, 0)`;
          cg.clipEl.style.setProperty('--clip-x', `${cx}px`);
          cg.lastClipX = clipX;
        }

        if (Math.abs(panShift - cg.lastPan) > 0.05) {
          cg.bgEl.style.transform = `translate3d(${(panShift * 0.38).toFixed(1)}px, 0, 0)`;
          cg.midEl.style.transform = `translate3d(${(panShift * 0.68).toFixed(1)}px, 0, 0)`;
          cg.fgEl.style.transform = `translate3d(${panShift.toFixed(1)}px, 0, 0)`;
          cg.clipEl.style.setProperty('--pan-shift', `${panShift.toFixed(1)}px`);
          cg.lastPan = panShift;
        }
      }

      const arriveP = Math.max(0, Math.min(1, clamped));
      if (Math.abs(arriveP - lastArriveP) > 0.001) {
        lastArriveP = arriveP;
        footerEl.style.setProperty('--arrive-p', arriveP.toFixed(3));
        if (planeArriveEl) {
          planeArriveEl.style.opacity = Math.max(0, 1 - arriveP * 1.05).toFixed(3);
          planeArriveEl.style.transform = `translate3d(${(arriveP * 180).toFixed(1)}px, ${(arriveP * 32).toFixed(1)}px, 0) rotate(6deg)`;
        }
      }

      const departP = Math.max(0, Math.min(1, clamped - 10));
      if (Math.abs(departP - lastDepartP) > 0.001) {
        lastDepartP = departP;
        footerEl.style.setProperty('--depart-p', departP.toFixed(3));
        if (planeDepartEl) {
          const inv = 1 - departP;
          planeDepartEl.style.opacity = Math.min(1, departP * 1.15).toFixed(3);
          planeDepartEl.style.transform = `translate3d(${(inv * -160).toFixed(1)}px, ${(inv * 34).toFixed(1)}px, 0) rotate(-11deg)`;
        }
      }
    }
  };
}
