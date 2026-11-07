import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const screenshotDir = path.resolve(process.cwd(), 'tests/screenshots');

test.describe('00OO 北海道蜜月 2027 Comprehensive E2E & Visual Suite', () => {
  test('1. captures all 12 days screenshots & verifies zero console errors and monotonic vertical item layout', async ({ page }) => {
    fs.mkdirSync(screenshotDir, { recursive: true });
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');
    await expect(page).toHaveTitle('00OO 北海道蜜月 2027');
    await expect(page.locator('#app-shell')).toBeVisible();

    for (let dayIdx = 0; dayIdx < 12; dayIdx++) {
      const slot = page.locator(`.story-slot[data-day="${dayIdx}"]`);
      await slot.dispatchEvent('pointerdown', { button: 0, clientX: 0, clientY: 0, pointerId: 1 });
      await slot.dispatchEvent('pointerup', { button: 0, pointerId: 1 });

      await expect(page.locator('.story-seg.is-active-pill')).toContainText(`Day ${dayIdx + 1}`);

      const panel = page.locator(`.day-schedule-panel[data-day="${dayIdx}"]`);
      await expect(panel).toBeVisible();
      const rows = panel.locator('.schedule-item-row');
      const rowCount = await rows.count();
      expect(rowCount).toBeGreaterThanOrEqual(4);

      // Verify rows are strictly ordered top-to-bottom without vertical overlap
      const tops: number[] = [];
      for (let r = 0; r < rowCount; r++) {
        const box = await rows.nth(r).boundingBox();
        expect(box).not.toBeNull();
        tops.push(box!.y);
      }
      for (let r = 1; r < tops.length; r++) {
        expect(tops[r]).toBeGreaterThan(tops[r - 1] + 18);
      }

      const fileName = `day-${String(dayIdx + 1).padStart(2, '0')}.png`;
      await page.screenshot({ path: path.join(screenshotDir, fileName) });
    }

    expect(errors).toEqual([]);
  });

  test('2. verifies horizontal swipe gesture advances and rewinds days & clamps at Day 1 boundary', async ({ page }) => {
    await page.goto('/');
    const shell = page.locator('#app-shell');

    // Try swiping right on Day 1 -> should stay clamped on Day 1
    await shell.dispatchEvent('pointerdown', { button: 0, clientX: 80, clientY: 400, pointerId: 1 });
    await shell.dispatchEvent('pointermove', { clientX: 300, clientY: 400, pointerId: 1 });
    await shell.dispatchEvent('pointerup', { clientX: 300, clientY: 400, pointerId: 1 });
    await expect(page.locator('.story-seg.is-active-pill')).toContainText('Day 1');

    // Swipe left -> advances to Day 2
    await shell.dispatchEvent('pointerdown', { button: 0, clientX: 320, clientY: 400, pointerId: 2 });
    await shell.dispatchEvent('pointermove', { clientX: 200, clientY: 400, pointerId: 2 });
    await shell.dispatchEvent('pointermove', { clientX: 90, clientY: 400, pointerId: 2 });
    await shell.dispatchEvent('pointerup', { clientX: 90, clientY: 400, pointerId: 2 });
    await expect(page.locator('.story-seg.is-active-pill')).toContainText('Day 2');

    // Swipe right -> rewinds to Day 1
    await shell.dispatchEvent('pointerdown', { button: 0, clientX: 80, clientY: 400, pointerId: 3 });
    await shell.dispatchEvent('pointermove', { clientX: 200, clientY: 400, pointerId: 3 });
    await shell.dispatchEvent('pointermove', { clientX: 310, clientY: 400, pointerId: 3 });
    await shell.dispatchEvent('pointerup', { clientX: 310, clientY: 400, pointerId: 3 });
    await expect(page.locator('.story-seg.is-active-pill')).toContainText('Day 1');
  });

  test('3. verifies right/left screen tap and keyboard ArrowRight/ArrowLeft navigation', async ({ page }) => {
    await page.goto('/');
    const shell = page.locator('#app-shell');

    await shell.dispatchEvent('pointerdown', { button: 0, clientX: 350, clientY: 400, pointerId: 10 });
    await shell.dispatchEvent('pointerup', { button: 0, clientX: 350, clientY: 400, pointerId: 10 });
    await expect(page.locator('.story-seg.is-active-pill')).toContainText('Day 2');

    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.story-seg.is-active-pill')).toContainText('Day 3');

    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('.story-seg.is-active-pill')).toContainText('Day 2');

    await page.waitForTimeout(240);
    await shell.dispatchEvent('pointerdown', { button: 0, clientX: 40, clientY: 400, pointerId: 11 });
    await shell.dispatchEvent('pointerup', { button: 0, clientX: 40, clientY: 400, pointerId: 11 });
    await expect(page.locator('.story-seg.is-active-pill')).toContainText('Day 1');
  });

  test('4. verifies SCSS theme classes (.theme-dark / .theme-light) and CSS variable parallax shifts across days', async ({ page }) => {
    await page.goto('/');
    const shell = page.locator('#app-shell');
    const group0 = page.locator('.scene-group-clip[data-group="0"]');

    // Day 1 (index 0) is dark theme, pan-shift = 0px
    await expect(shell).toHaveClass(/theme-dark/);
    await expect(group0).toHaveAttribute('style', /--pan-shift:\s*0(\.0)?px/);

    // Jump to Day 2 (index 1) -> pan-shift = -105.0px
    await page.locator('.story-slot[data-day="1"]').dispatchEvent('pointerdown', { button: 0, clientX: 0, clientY: 0, pointerId: 1 });
    await page.locator('.story-slot[data-day="1"]').dispatchEvent('pointerup', { button: 0, pointerId: 1 });
    await expect(group0).toHaveAttribute('style', /--pan-shift:\s*-105\.0px/);

    // Jump to Day 4 (index 3, Asahikawa) -> light theme
    await page.locator('.story-slot[data-day="3"]').dispatchEvent('pointerdown', { button: 0, clientX: 0, clientY: 0, pointerId: 1 });
    await page.locator('.story-slot[data-day="3"]').dispatchEvent('pointerup', { button: 0, pointerId: 1 });
    await expect(shell).toHaveClass(/theme-light/);
  });

  test('5. verifies #fx-canvas actively renders snowfall particles and footer opens Google Maps', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(150);

    const hasPixels = await page.evaluate(() => {
      const c = document.getElementById('fx-canvas') as HTMLCanvasElement;
      const ctx = c.getContext('2d')!;
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 0) return true;
      }
      return false;
    });
    expect(hasPixels).toBe(true);

    await page.evaluate(() => {
      (window as unknown as { __lastOpenedUrl: string }).__lastOpenedUrl = '';
      window.open = (url?: string | URL) => {
        (window as unknown as { __lastOpenedUrl: string }).__lastOpenedUrl = String(url || '');
        return null;
      };
    });

    const shell = page.locator('#app-shell');
    await shell.dispatchEvent('pointerdown', { button: 0, clientX: 200, clientY: 780, pointerId: 20 });
    await shell.dispatchEvent('pointerup', { button: 0, clientX: 200, clientY: 780, pointerId: 20 });
    const openedUrl = await page.evaluate(() => (window as unknown as { __lastOpenedUrl: string }).__lastOpenedUrl);
    expect(openedUrl).toContain('google.com/maps/search/');
    expect(openedUrl).toContain('Sapporo');
  });
});
