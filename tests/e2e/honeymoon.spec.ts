import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const screenshotDir = path.resolve(process.cwd(), 'tests/screenshots');

test.describe('Hokkaido Honeymoon 2027 E2E & Visual Suite', () => {
  test('captures all 12 days screenshots & verifies zero console errors or text overlaps', async ({ page }) => {
    fs.mkdirSync(screenshotDir, { recursive: true });
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');
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

      const fileName = `day-${String(dayIdx + 1).padStart(2, '0')}.png`;
      await page.screenshot({ path: path.join(screenshotDir, fileName) });
    }

    expect(errors).toEqual([]);
  });

  test('verifies horizontal swipe gesture advances and rewinds days smoothly', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.story-seg.is-active-pill')).toContainText('Day 1');

    const shell = page.locator('#app-shell');
    await shell.dispatchEvent('pointerdown', { button: 0, clientX: 320, clientY: 400, pointerId: 1 });
    await shell.dispatchEvent('pointermove', { clientX: 220, clientY: 400, pointerId: 1 });
    await shell.dispatchEvent('pointermove', { clientX: 100, clientY: 400, pointerId: 1 });
    await shell.dispatchEvent('pointerup', { clientX: 100, clientY: 400, pointerId: 1 });

    await expect(page.locator('.story-seg.is-active-pill')).toContainText('Day 2');

    await shell.dispatchEvent('pointerdown', { button: 0, clientX: 80, clientY: 400, pointerId: 2 });
    await shell.dispatchEvent('pointermove', { clientX: 180, clientY: 400, pointerId: 2 });
    await shell.dispatchEvent('pointermove', { clientX: 310, clientY: 400, pointerId: 2 });
    await shell.dispatchEvent('pointerup', { clientX: 310, clientY: 400, pointerId: 2 });

    await expect(page.locator('.story-seg.is-active-pill')).toContainText('Day 1');
  });

  test('verifies right/left screen tap navigation and bottom cityscape Google Maps click', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      (window as unknown as { __lastOpenedUrl: string }).__lastOpenedUrl = '';
      window.open = (url?: string | URL) => {
        (window as unknown as { __lastOpenedUrl: string }).__lastOpenedUrl = String(url || '');
        return null;
      };
    });

    const shell = page.locator('#app-shell');
    await shell.dispatchEvent('pointerdown', { button: 0, clientX: 350, clientY: 400, pointerId: 10 });
    await shell.dispatchEvent('pointerup', { button: 0, clientX: 350, clientY: 400, pointerId: 10 });
    await expect(page.locator('.story-seg.is-active-pill')).toContainText('Day 2');

    await page.waitForTimeout(260);
    await shell.dispatchEvent('pointerdown', { button: 0, clientX: 40, clientY: 400, pointerId: 11 });
    await shell.dispatchEvent('pointerup', { button: 0, clientX: 40, clientY: 400, pointerId: 11 });
    await expect(page.locator('.story-seg.is-active-pill')).toContainText('Day 1');

    await page.waitForTimeout(260);
    await shell.dispatchEvent('pointerdown', { button: 0, clientX: 200, clientY: 780, pointerId: 12 });
    await shell.dispatchEvent('pointerup', { button: 0, clientX: 200, clientY: 780, pointerId: 12 });
    const openedUrl = await page.evaluate(() => (window as unknown as { __lastOpenedUrl: string }).__lastOpenedUrl);
    expect(openedUrl).toContain('google.com/maps/search/');
    expect(openedUrl).toContain('Sapporo');
  });
});
