import type { DayData, SceneGroupConfig } from '../types/schedule';
import { getRequiredElementById, parseTrustedSvgElement } from '../utils/dom';
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

export interface PlaneActorAsset {
  readonly id: string;
  readonly role: 'arrive' | 'depart';
  readonly svg: string;
}

export interface GroupSvgAssetBundle {
  readonly bg: string;
  readonly mid: string;
  readonly fg: string;
  readonly plane?: PlaneActorAsset;
}

const DEFAULT_GROUP_SVG_ASSETS: readonly GroupSvgAssetBundle[] = [
  {
    bg: group0Bg,
    mid: group0Mid,
    fg: group0Fg,
    plane: {
      id: 'day1-arriving-plane',
      role: 'arrive',
      svg: jetlinerArriveSvg
    }
  },
  { bg: group1Bg, mid: group1Mid, fg: group1Fg },
  { bg: group2Bg, mid: group2Mid, fg: group2Fg },
  { bg: group3Bg, mid: group3Mid, fg: group3Fg },
  {
    bg: group4Bg,
    mid: group4Mid,
    fg: group4Fg,
    plane: {
      id: 'day12-departing-plane',
      role: 'depart',
      svg: jetlinerDepartSvg
    }
  }
];

export interface ParallaxController {
  renderParallax(
    clamped: number,
    idxA: number,
    idxB: number,
    t: number,
    viewportWidth: number
  ): void;
}

interface CachedGroupRefs {
  clipEl: HTMLDivElement;
  bgEl: HTMLDivElement;
  midEl: HTMLDivElement;
  fgEl: HTMLDivElement;
  isVisible: boolean;
  lastClipX: number;
  lastPan: number;
  lastSettledPan: string;
  lastWidthPx: number;
}

function createParallaxLayer(cls: string, widthPx: number, rawSvg: string): HTMLDivElement {
  const layer = document.createElement('div');
  layer.className = `parallax-layer ${cls}`;
  layer.style.width = `${widthPx}px`;
  layer.appendChild(parseTrustedSvgElement(rawSvg));
  return layer;
}

export function mountParallaxScenes(
  daysData: DayData[],
  sceneGroups: SceneGroupConfig[],
  assetBundles: readonly GroupSvgAssetBundle[] = DEFAULT_GROUP_SVG_ASSETS
): ParallaxController {
  const snowSlot = getRequiredElementById('snow-ground-slot');
  snowSlot.replaceChildren(parseTrustedSvgElement(snowGroundSvg));

  const container = getRequiredElementById('scene-groups-container');
  container.replaceChildren();

  let planeArriveWrap: HTMLDivElement | null = null;
  let planeDepartWrap: HTMLDivElement | null = null;

  const cachedGroups: CachedGroupRefs[] = sceneGroups.map((grp, idx) => {
    const asset = assetBundles[idx];
    const clipEl = document.createElement('div');
    clipEl.className = 'scene-group-clip';
    clipEl.dataset.group = String(grp.groupIdx);

    const bgEl = createParallaxLayer('parallax-bg', grp.widthPx, asset.bg);
    const midEl = createParallaxLayer('parallax-mid', grp.widthPx, asset.mid);
    const fgEl = createParallaxLayer('parallax-fg', grp.widthPx, asset.fg);
    clipEl.append(bgEl, midEl, fgEl);

    if (asset.plane) {
      const planeWrap = document.createElement('div');
      planeWrap.id = asset.plane.id;
      planeWrap.className = `plane-actor plane-${asset.plane.role}`;
      planeWrap.appendChild(parseTrustedSvgElement(asset.plane.svg));
      clipEl.appendChild(planeWrap);

      if (asset.plane.role === 'arrive') {
        planeArriveWrap = planeWrap;
      } else {
        planeDepartWrap = planeWrap;
      }
    }

    container.appendChild(clipEl);

    return {
      clipEl,
      bgEl,
      midEl,
      fgEl,
      isVisible: false,
      lastClipX: -99999,
      lastPan: -99999,
      lastSettledPan: '',
      lastWidthPx: grp.widthPx
    };
  });

  const arriveDayIdx = daysData.findIndex((d) => d.planeAction === 'arrive');
  const departDayIdx = daysData.findIndex((d) => d.planeAction === 'depart');

  let lastArriveP = -1;
  let lastDepartP = -1;

  return {
    renderParallax(clamped, idxA, idxB, t, viewportWidth) {
      const groupA = daysData[idxA].groupIdx;
      const groupB = daysData[idxB].groupIdx;
      const isSettledEndpoint = t === 0 || t === 1;

      for (let g = 0; g < sceneGroups.length; g++) {
        const grp = sceneGroups[g];
        const cg = cachedGroups[g];
        const isGroupA = g === groupA;
        const isGroupB = g === groupB;

        if (!isGroupA && !isGroupB) {
          if (cg.isVisible) {
            cg.clipEl.classList.remove('is-visible');
            cg.isVisible = false;
          }
          continue;
        }

        if (!cg.isVisible) {
          cg.clipEl.classList.add('is-visible');
          cg.isVisible = true;
        }

        const maxPanPx = (grp.endDay - grp.startDay) * grp.panStepPx;
        const effectiveWidthPx = Math.max(grp.widthPx, Math.ceil(viewportWidth + maxPanPx));
        if (effectiveWidthPx !== cg.lastWidthPx) {
          const widthStr = `${effectiveWidthPx}px`;
          cg.bgEl.style.width = widthStr;
          cg.midEl.style.width = widthStr;
          cg.fgEl.style.width = widthStr;
          cg.lastWidthPx = effectiveWidthPx;
        }

        const clipX =
          groupA === groupB ? 0 : isGroupA ? -t * viewportWidth : (1 - t) * viewportWidth;
        const localDayOffset =
          (groupA === groupB ? clamped : isGroupA ? idxA : idxB) - grp.startDay;
        const panShift = -localDayOffset * grp.panStepPx;

        if (Math.abs(clipX - cg.lastClipX) > 0.05) {
          cg.clipEl.style.transform = `translate3d(${clipX.toFixed(1)}px, 0, 0)`;
          cg.lastClipX = clipX;
        }

        if (Math.abs(panShift - cg.lastPan) > 0.05) {
          cg.bgEl.style.transform = `translate3d(${(panShift * 0.38).toFixed(1)}px, 0, 0)`;
          cg.midEl.style.transform = `translate3d(${(panShift * 0.68).toFixed(1)}px, 0, 0)`;
          cg.fgEl.style.transform = `translate3d(${panShift.toFixed(1)}px, 0, 0)`;
          cg.lastPan = panShift;
        }

        if (isSettledEndpoint) {
          const panProp = `${panShift.toFixed(1)}px`;
          if (panProp !== cg.lastSettledPan) {
            cg.clipEl.style.setProperty('--pan-shift', panProp);
            cg.lastSettledPan = panProp;
          }
        }
      }

      if (arriveDayIdx >= 0 && planeArriveWrap) {
        const arriveP = Math.max(0, Math.min(1, clamped - arriveDayIdx));
        if (Math.abs(arriveP - lastArriveP) > 0.001) {
          lastArriveP = arriveP;
          planeArriveWrap.style.opacity = Math.max(0, 1 - arriveP * 1.05).toFixed(3);
          planeArriveWrap.style.transform = `translate3d(${(arriveP * 180).toFixed(1)}px, ${(arriveP * 32).toFixed(1)}px, 0) rotate(6deg)`;
        }
      }

      if (departDayIdx >= 1 && planeDepartWrap) {
        const departP = Math.max(0, Math.min(1, clamped - (departDayIdx - 1)));
        if (Math.abs(departP - lastDepartP) > 0.001) {
          lastDepartP = departP;
          const inv = 1 - departP;
          planeDepartWrap.style.opacity = Math.min(1, departP * 1.15).toFixed(3);
          planeDepartWrap.style.transform = `translate3d(${(inv * -160).toFixed(1)}px, ${(inv * 34).toFixed(1)}px, 0) rotate(-11deg)`;
        }
      }
    }
  };
}
