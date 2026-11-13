import './styles/main.scss';
import { loadHoneymoonData } from './engine/loader';
import { mountStageDOM } from './engine/renderer';
import { mountTimelineRail } from './engine/timeline';
import { mountParallaxScenes } from './engine/parallax';
import { bindGesturesAndPhysics } from './engine/gestures';
import { startParticleStage } from './effects/particleStage';
import { registerOfflineServiceWorker } from './pwa/registerSw';

export function onServiceWorkerRegisterError(error: Error): void {
  console.warn('[PWA] Service worker registration skipped:', error.message);
}

export function bootstrap(): void {
  const { daysData, sceneGroups } = loadHoneymoonData();
  const renderer = mountStageDOM(daysData);
  const timeline = mountTimelineRail(daysData);
  const parallax = mountParallaxScenes(daysData, sceneGroups);
  const gestures = bindGesturesAndPhysics(daysData, renderer, timeline, parallax);
  startParticleStage(daysData, () => gestures.getCurrentDayFloat());
  registerOfflineServiceWorker(window, navigator, window.location, onServiceWorkerRegisterError);
}

export function initWhenReady(
  doc: Pick<Document, 'readyState'> = document,
  win: Pick<Window, 'addEventListener'> = window
): void {
  const isLoading = doc.readyState === 'loading';
  if (isLoading) {
    win.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
}

if (typeof document !== 'undefined' && document.getElementById('app-shell')) {
  initWhenReady();
}
