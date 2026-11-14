import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

test.describe('Post-Build Smoke, Payload Budget, CSP, Offline PWA & Accessibility Suite', () => {
  test('1. enforces precache payload budget (< 220 KB), content-hashed subset WOFF2 budget (< 120 KB), and production CSP meta tag', () => {
    const distDir = path.resolve(process.cwd(), 'dist');
    const swPath = path.join(distDir, 'sw.js');
    const indexHtmlPath = path.join(distDir, 'index.html');

    expect(fs.existsSync(swPath)).toBe(true);
    expect(fs.existsSync(indexHtmlPath)).toBe(true);
    expect(fs.existsSync(path.join(distDir, 'fonts'))).toBe(false);

    const distHtml = fs.readFileSync(indexHtmlPath, 'utf8').replaceAll('&#39;', "'");
    expect(distHtml).toContain('http-equiv="Content-Security-Policy"');
    expect(distHtml).toContain("default-src 'none'");
    expect(distHtml).toContain("style-src 'self'");

    const swContent = fs.readFileSync(swPath, 'utf8');
    expect(swContent).toContain('honeymoon-2027-');
    expect(swContent).toContain('reload');

    const precacheArrayMatch = /\["\.\/[^"]+?"(?:,"\.\/[^"]+?")*\]/.exec(swContent);
    expect(precacheArrayMatch).not.toBeNull();
    const rawUrls: unknown = JSON.parse(precacheArrayMatch?.[0] ?? '[]');
    expect(Array.isArray(rawUrls)).toBe(true);
    const precacheUrls = (rawUrls as string[]).map(String);

    expect(precacheUrls).toContain('./index.html');
    expect(precacheUrls).toContain('./manifest.json');
    const hashedFontUrl = precacheUrls.find((u) =>
      /^\.\/assets\/Huninn-Regular-[0-9a-f]{8}\.woff2$/.test(u)
    );
    expect(hashedFontUrl).toBeDefined();
    expect(distHtml).toContain(hashedFontUrl ?? '');
    expect(precacheUrls.some((u) => /^\.\/assets\/index-[A-Za-z0-9_-]+\.js$/.test(u))).toBe(true);
    const cssRelUrl = precacheUrls.find((u) => /^\.\/assets\/index-[A-Za-z0-9_-]+\.css$/.test(u));
    expect(cssRelUrl).toBeDefined();

    const subsetFontFileName = path.basename(hashedFontUrl ?? '');
    const subsetFontPath = path.join(distDir, 'assets', subsetFontFileName);
    expect(fs.existsSync(subsetFontPath)).toBe(true);
    const fontByteCount = fs.statSync(subsetFontPath).size;
    expect(fontByteCount).toBeGreaterThan(20 * 1024);
    expect(fontByteCount).toBeLessThan(120 * 1024);

    const distCss = fs.readFileSync(path.join(distDir, (cssRelUrl ?? '').slice(2)), 'utf8');
    expect(distCss).toContain(`./${subsetFontFileName}`);

    let totalPrecacheByteCount = 0;
    for (const relUrl of precacheUrls) {
      const assetPath = path.join(distDir, relUrl.slice(2));
      expect(fs.existsSync(assetPath), `Missing precached asset: ${relUrl}`).toBe(true);
      totalPrecacheByteCount += fs.statSync(assetPath).size;
    }

    expect(totalPrecacheByteCount).toBeLessThan(220 * 1024);
  });

  test('2. verifies cold offline reload on deep-linked /?sw=1#day-6 with cached Huninn font and zero errors', async ({
    page,
    context
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/?sw=1#day-6');
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

    // Verify foreground resume (visibilitychange while !document.hidden) triggers background SW update check
    const swUpdateCallCount = await page.evaluate(() => {
      let updateCallCount = 0;
      const origUpdate = ServiceWorkerRegistration.prototype.update;
      ServiceWorkerRegistration.prototype.update = function (this: ServiceWorkerRegistration) {
        updateCallCount++;
        return origUpdate.call(this);
      };
      document.dispatchEvent(new Event('visibilitychange'));
      ServiceWorkerRegistration.prototype.update = origUpdate;
      return updateCallCount;
    });
    expect(swUpdateCallCount).toBe(1);

    // Simulate losing cellular signal in rural Hokkaido and reloading cold on Day 6
    await context.setOffline(true);
    await page.reload();
    await page.evaluate(() => document.fonts.ready);

    await expect(page).toHaveTitle('00OO 北海道蜜月 2027');
    await expect(page.locator('.story-seg.is-active-pill')).toContainText('Day 6');

    const isHuninnLoaded = await page.evaluate(() => document.fonts.check('16px Huninn'));
    expect(isHuninnLoaded).toBe(true);

    await context.setOffline(false);
    expect(errors).toEqual([]);
  });

  test('3. verifies Asia/Tokyo honeymoon date auto-selection, per-item map links, Home/End keys, and #day-live-status announcements', async ({
    page
  }) => {
    // Simulate opening the app on 2027-03-07 JST (Day 6: Lake Shikotsu)
    await page.clock.install({ time: new Date('2027-03-07T02:00:00Z') });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');

    const liveStatus = page.locator('#day-live-status');
    await expect(page.locator('.story-seg.is-active-pill')).toContainText('Day 6');
    await expect(liveStatus).toHaveText('');

    // Inactive panels are marked inert; active panel is interactive
    const isDay1Inert = await page
      .locator('.day-schedule-panel[data-day="0"]')
      .evaluate((el) => (el as HTMLElement).inert);
    const isDay6Inert = await page
      .locator('.day-schedule-panel[data-day="5"]')
      .evaluate((el) => (el as HTMLElement).inert);
    expect(isDay1Inert).toBe(true);
    expect(isDay6Inert).toBe(false);

    // Verify per-item Google Maps link on Day 6 (Lake Shikotsu)
    const shikotsuLink = page.locator(
      '.day-schedule-panel[data-day="5"] a.is-map-link[href*="Lake%20Shikotsu"]'
    );
    await expect(shikotsuLink).toBeVisible();
    await expect(shikotsuLink).toHaveAttribute('target', '_blank');

    // Verify keyboard focus & Enter activation on Story Bar button slots updates #day-live-status
    const day5Btn = page.locator('.story-slot[data-day="4"]');
    await day5Btn.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.story-seg.is-active-pill')).toContainText('Day 5');
    await expect(liveStatus).toContainText('Day 5');
    expect(page.url()).toContain('#day-5');

    // Verify End / Home keys jump to Day 12 and Day 1 while updating #day-live-status
    await page.keyboard.press('End');
    await expect(page.locator('.story-seg.is-active-pill')).toContainText('Day 12');
    await expect(liveStatus).toContainText('Day 12');
    expect(page.url()).toContain('#day-12');

    await page.keyboard.press('Home');
    await expect(page.locator('.story-seg.is-active-pill')).toContainText('Day 1');
    await expect(liveStatus).toContainText('Day 1');
    expect(page.url()).toContain('#day-1');
  });
});
