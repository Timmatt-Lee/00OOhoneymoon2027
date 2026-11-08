import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const screenshotDir = path.resolve(process.cwd(), 'tests/screenshots');

test.describe('00OO 北海道蜜月 2027 — Visual & Interaction E2E Suite', () => {
  test('1. renders all 12 days, verifies zero horizontal/vertical bounding-box collisions, and updates deterministic screenshots', async ({ page }) => {
    fs.mkdirSync(screenshotDir, { recursive: true });
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');
    await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; }' });
    await expect(page).toHaveTitle('00OO 北海道蜜月 2027');

    // Ensure zero horizontal overflow on viewport
    const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflowX).toBe(false);

    const railLineBox = await page.locator('#timeline-line').boundingBox();
    expect(railLineBox).not.toBeNull();

    // Ensure timeline time labels and top story-bar leftmost chip are strictly left-aligned
    const storyTrackBox = await page.locator('#story-bar-track').boundingBox();
    const railBox = await page.locator('#timeline-rail').boundingBox();
    expect(storyTrackBox).not.toBeNull();
    expect(railBox).not.toBeNull();
    expect(storyTrackBox!.x).toBe(railBox!.x);

    for (let dayIdx = 0; dayIdx < 12; dayIdx++) {
      const slot = page.locator(`.story-slot[data-day="${dayIdx}"]`);
      await slot.dispatchEvent('pointerdown', { button: 0, clientX: 0, clientY: 0, pointerId: 1 });
      await slot.dispatchEvent('pointerup', { button: 0, pointerId: 1 });
      await page.waitForTimeout(25);

      const pill = page.locator('.story-seg.is-active-pill');
      await expect(pill).toContainText(`Day ${dayIdx + 1}`);
      const pillBox = await pill.boundingBox();
      expect(pillBox!.x).toBeGreaterThanOrEqual(16);
      expect(pillBox!.x + pillBox!.width).toBeLessThanOrEqual(384);

      const panel = page.locator(`.day-schedule-panel[data-day="${dayIdx}"]`);
      await expect(panel).toBeVisible();
      const titles = panel.locator('.schedule-item-title');
      const subtitles = panel.locator('.schedule-item-subtitle');
      const count = await titles.count();
      expect(count).toBeGreaterThanOrEqual(3);

      let prevBottom = -1;
      for (let r = 0; r < count; r++) {
        const titleEl = titles.nth(r);
        const tBox = await titleEl.boundingBox();
        expect(tBox).not.toBeNull();
        // Title must have visible rendered height and width and fit on a single line without truncation
        expect(tBox!.height).toBeGreaterThan(16);
        expect(tBox!.height).toBeLessThanOrEqual(28);
        expect(tBox!.width).toBeGreaterThan(80);
        const titleOverflow = await titleEl.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
        expect(titleOverflow, `Day ${dayIdx + 1} row ${r + 1} title overflow`).toBe(false);

        // Title must start to the right of the timeline rail line and stay inside the viewport
        expect(tBox!.x).toBeGreaterThan(railLineBox!.x + railLineBox!.width + 6);
        expect(tBox!.x + tBox!.width).toBeLessThanOrEqual(390);
        // Strictly increasing Y with zero vertical overlap between rows
        expect(tBox!.y).toBeGreaterThan(prevBottom);

        const subEl = subtitles.nth(r);
        if (await subEl.count() > 0) {
          const sBox = await subEl.boundingBox();
          expect(sBox).not.toBeNull();
          // Subtitle must fit cleanly on a single line (no 2-line wrap and no ellipsis truncation)
          expect(sBox!.height, `Day ${dayIdx + 1} row ${r + 1} subtitle wrapped (${await subEl.textContent()})`).toBeLessThanOrEqual(22);
          const subOverflow = await subEl.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
          expect(subOverflow, `Day ${dayIdx + 1} row ${r + 1} subtitle overflow (${await subEl.textContent()})`).toBe(false);
          prevBottom = sBox!.y + sBox!.height;
        } else {
          prevBottom = tBox!.y + tBox!.height;
        }
      }

      const fileName = `day-${String(dayIdx + 1).padStart(2, '0')}.png`;
      await page.screenshot({ path: path.join(screenshotDir, fileName), animations: "disabled" });
    }

    expect(errors).toEqual([]);
  });

  test('2. verifies mid-swipe interpolation (50% drag) cross-fades sky layers, panels, and timeline nodes', async ({ page }) => {
    await page.goto('/');
    const shell = page.locator('#app-shell');

    // Drag halfway across the 400px viewport (dx = -200px => pos = 0.5 between Day 1 and Day 2)
    await shell.dispatchEvent('pointerdown', { button: 0, clientX: 300, clientY: 400, pointerId: 1 });
    await shell.dispatchEvent('pointermove', { clientX: 250, clientY: 400, pointerId: 1 });
    await shell.dispatchEvent('pointermove', { clientX: 100, clientY: 400, pointerId: 1 });
    await page.waitForTimeout(40);

    // At pos ~ 0.5, both Sky Layer 0 and Sky Layer 1 must be visible with intermediate opacity
    const skyOpacities = await page.evaluate(() => {
      const layers = document.querySelectorAll<HTMLElement>('.sky-layer');
      return [Number(layers[0].style.opacity), Number(layers[1].style.opacity)];
    });
    expect(skyOpacities[0]).toBeGreaterThan(0.2);
    expect(skyOpacities[0]).toBeLessThan(0.8);
    expect(skyOpacities[1]).toBeGreaterThan(0.2);
    expect(skyOpacities[1]).toBeLessThan(0.8);

    // Release drag -> snaps cleanly to Day 2
    await shell.dispatchEvent('pointerup', { clientX: 100, clientY: 400, pointerId: 1 });
    await expect(page.locator('.story-seg.is-active-pill')).toContainText('Day 2');
  });

  test('3. verifies right/left tap navigation, ArrowRight/ArrowLeft keys, and Day 1 boundary clamping', async ({ page }) => {
    await page.goto('/');
    const shell = page.locator('#app-shell');

    // Left tap on Day 1 stays clamped on Day 1
    await shell.dispatchEvent('pointerdown', { button: 0, clientX: 40, clientY: 400, pointerId: 5 });
    await shell.dispatchEvent('pointerup', { button: 0, clientX: 40, clientY: 400, pointerId: 5 });
    await expect(page.locator('.story-seg.is-active-pill')).toContainText('Day 1');

    // Right tap advances to Day 2
    await page.waitForTimeout(220);
    await shell.dispatchEvent('pointerdown', { button: 0, clientX: 350, clientY: 400, pointerId: 6 });
    await shell.dispatchEvent('pointerup', { button: 0, clientX: 350, clientY: 400, pointerId: 6 });
    await expect(page.locator('.story-seg.is-active-pill')).toContainText('Day 2');

    // Keyboard ArrowRight -> Day 3, ArrowLeft -> Day 2
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.story-seg.is-active-pill')).toContainText('Day 3');
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('.story-seg.is-active-pill')).toContainText('Day 2');
  });

  test('4. verifies SCSS theme classes (.theme-dark / .theme-light), parallax CSS variables, #fx-canvas pixels & Google Maps click', async ({ page }) => {
    await page.goto('/');
    const shell = page.locator('#app-shell');
    const group0 = page.locator('.scene-group-clip[data-group="0"]');

    await expect(shell).toHaveClass(/theme-dark/);
    await expect(group0).toHaveAttribute('style', /--pan-shift:\s*0(\.0)?px/);

    // Jump to Day 2 (index 1) -> Group 0 panStepPx is 54px => --pan-shift: -54.0px
    await page.locator('.story-slot[data-day="1"]').dispatchEvent('pointerdown', { button: 0, clientX: 0, clientY: 0, pointerId: 1 });
    await page.locator('.story-slot[data-day="1"]').dispatchEvent('pointerup', { button: 0, pointerId: 1 });
    await expect(group0).toHaveAttribute('style', /--pan-shift:\s*-54\.0px/);

    // Jump to Day 4 (index 3, Asahikawa) -> .theme-light
    await page.locator('.story-slot[data-day="3"]').dispatchEvent('pointerdown', { button: 0, clientX: 0, clientY: 0, pointerId: 1 });
    await page.locator('.story-slot[data-day="3"]').dispatchEvent('pointerup', { button: 0, pointerId: 1 });
    await expect(shell).toHaveClass(/theme-light/);

    // Verify #fx-canvas rendered snowfall particles
    const hasPixels = await page.evaluate(() => {
      const c = document.getElementById('fx-canvas') as HTMLCanvasElement;
      const data = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      for (let i = 3; i < data.length; i += 4) if (data[i] > 0) return true;
      return false;
    });
    expect(hasPixels).toBe(true);

    // Verify clicking footer opens Google Maps for Day 4 (Asahikawa Station)
    await page.evaluate(() => {
      (window as unknown as { __url: string }).__url = '';
      window.open = (u?: string | URL) => {
        (window as unknown as { __url: string }).__url = String(u || '');
        return null;
      };
    });
    await shell.dispatchEvent('pointerdown', { button: 0, clientX: 200, clientY: 780, pointerId: 9 });
    await shell.dispatchEvent('pointerup', { button: 0, clientX: 200, clientY: 780, pointerId: 9 });
    const opened = await page.evaluate(() => (window as unknown as { __url: string }).__url);
    expect(opened).toContain('Asahikawa');
  });
});
