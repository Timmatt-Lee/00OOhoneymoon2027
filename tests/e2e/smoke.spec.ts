import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

test.describe('Post-Build Smoke, Accessibility, Trip Date Routing & Offline PWA Suite', () => {
  test('1. verifies built dist/sw.js precache manifest includes hashed bundles and Huninn font', () => {
    const swPath = path.resolve(process.cwd(), 'dist/sw.js');
    expect(fs.existsSync(swPath)).toBe(true);
    const swContent = fs.readFileSync(swPath, 'utf8');
    expect(swContent).toContain('honeymoon-2027-');
    expect(swContent).toContain('./index.html');
    expect(swContent).toContain('./fonts/Huninn-Regular.woff2');
    expect(swContent).toMatch(/\.\/assets\/index-[A-Za-z0-9_-]+\.js/);
    expect(swContent).toMatch(/\.\/assets\/index-[A-Za-z0-9_-]+\.css/);
  });

  test('2. verifies cold offline reload via Service Worker precache with zero network errors', async ({
    page,
    context
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/?sw=1');
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise<void>((resolve) => {
          navigator.serviceWorker.addEventListener(
            'controllerchange',
            () => {
              resolve();
            },
            { once: true }
          );
        });
      }
    });

    // Simulate losing cellular signal in rural Hokkaido and reloading cold
    await context.setOffline(true);
    await page.reload();

    await expect(page).toHaveTitle('00OO 北海道蜜月 2027');
    await expect(page.locator('.story-seg.is-active-pill')).toContainText('Day 1');
    await context.setOffline(false);
    expect(errors).toEqual([]);
  });

  test('3. verifies Asia/Tokyo honeymoon date auto-selection, URL hash routing, per-item map links, and keyboard a11y', async ({
    page
  }) => {
    // Simulate opening the app on 2027-03-07 JST (Day 6: Lake Shikotsu)
    await page.clock.install({ time: new Date('2027-03-07T02:00:00Z') });
    await page.goto('/');
    await expect(page.locator('.story-seg.is-active-pill')).toContainText('Day 6');

    // Inactive panels are marked inert; active panel is interactive
    const isDay1Inert = await page
      .locator('.day-schedule-panel[data-day="0"]')
      .evaluate((el) => (el as HTMLElement).inert);
    const isDay6Inert = await page
      .locator('.day-schedule-panel[data-day="5"]')
      .evaluate((el) => (el as HTMLElement).inert);
    expect(isDay1Inert).toBe(true);
    expect(isDay6Inert).toBe(false);

    // Verify per-item Google Maps link on Day 6 ("搭車前往支笏湖" -> Lake Shikotsu)
    const shikotsuLink = page
      .locator('.day-schedule-panel[data-day="5"] a.is-map-link')
      .filter({ hasText: '支笏湖' });
    await expect(shikotsuLink).toHaveAttribute('href', /Lake%20Shikotsu/);

    // Verify keyboard focus & Enter activation on Story Bar button slots + prefers-reduced-motion
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const day5Btn = page.locator('.story-slot[data-day="4"]');
    await day5Btn.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.story-seg.is-active-pill')).toContainText('Day 5');
    expect(page.url()).toContain('#day-5');
  });
});
