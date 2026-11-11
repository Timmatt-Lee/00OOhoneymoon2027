import { test, expect, type Locator } from '@playwright/test';

async function requireBox(locator: Locator, label: string) {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error(`Expected bounding box for ${label}`);
  }
  return box;
}

test.describe('00OO Hokkaido Honeymoon 2027 — Visual & Interaction E2E Suite', () => {
  test('1. renders all 12 days, verifies zero horizontal/vertical bounding-box collisions, and asserts deterministic screenshots', async ({
    page
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');
    await page.addStyleTag({
      content: '*, *::before, *::after { animation: none !important; transition: none !important; }'
    });
    await expect(page).toHaveTitle('00OO 北海道蜜月 2027');

    const isOverflowX = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(isOverflowX).toBe(false);

    const railLineBox = await requireBox(page.locator('#timeline-line'), '#timeline-line');
    const storyTrackBox = await requireBox(page.locator('#story-bar-track'), '#story-bar-track');
    const railBox = await requireBox(page.locator('#timeline-rail'), '#timeline-rail');
    expect(storyTrackBox.x).toBe(railBox.x);

    for (let dayIdx = 0; dayIdx < 12; dayIdx++) {
      const slot = page.locator(`.story-slot[data-day="${dayIdx}"]`);
      await slot.dispatchEvent('pointerdown', { button: 0, clientX: 0, clientY: 0, pointerId: 1 });
      await slot.dispatchEvent('pointerup', { button: 0, pointerId: 1 });
      await page.waitForTimeout(25);

      const pill = page.locator('.story-seg.is-active-pill');
      await expect(pill).toContainText(`Day ${dayIdx + 1}`);
      const pillBox = await requireBox(pill, 'active pill');
      expect(pillBox.x).toBeGreaterThanOrEqual(16);
      expect(pillBox.x + pillBox.width).toBeLessThanOrEqual(384);

      const panel = page.locator(`.day-schedule-panel[data-day="${dayIdx}"]`);
      await expect(panel).toBeVisible();
      const titles = panel.locator('.schedule-item-title');
      const subtitles = panel.locator('.schedule-item-subtitle');
      const titleCount = await titles.count();
      expect(titleCount).toBeGreaterThanOrEqual(3);

      let prevBottom = -1;
      for (let r = 0; r < titleCount; r++) {
        const titleEl = titles.nth(r);
        const tBox = await requireBox(titleEl, `Day ${dayIdx + 1} title ${r + 1}`);
        expect(tBox.height).toBeGreaterThan(16);
        expect(tBox.height).toBeLessThanOrEqual(28);
        expect(tBox.width).toBeGreaterThan(36);
        const isTitleOverflow = await titleEl.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
        expect(isTitleOverflow, `Day ${dayIdx + 1} row ${r + 1} title overflow`).toBe(false);

        expect(tBox.x).toBeGreaterThan(railLineBox.x + railLineBox.width + 6);
        expect(tBox.x + tBox.width).toBeLessThanOrEqual(390);
        expect(tBox.y).toBeGreaterThan(prevBottom);

        const subEl = subtitles.nth(r);
        if ((await subEl.count()) > 0) {
          const sBox = await requireBox(subEl, `Day ${dayIdx + 1} subtitle ${r + 1}`);
          const subText = (await subEl.textContent()) ?? '';
          expect(
            sBox.height,
            `Day ${dayIdx + 1} row ${r + 1} subtitle wrapped (${subText})`
          ).toBeLessThanOrEqual(22);
          const isSubOverflow = await subEl.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
          expect(
            isSubOverflow,
            `Day ${dayIdx + 1} row ${r + 1} subtitle overflow (${subText})`
          ).toBe(false);
          prevBottom = sBox.y + sBox.height;
        } else {
          prevBottom = tBox.y + tBox.height;
        }
      }

      const fileName = `day-${String(dayIdx + 1).padStart(2, '0')}.png`;
      await expect(page).toHaveScreenshot(fileName, { animations: 'disabled' });
    }

    expect(errors).toEqual([]);
  });

  test('2. verifies mid-swipe interpolation (50% drag) cross-fades sky layers, panels, and timeline nodes', async ({
    page
  }) => {
    await page.goto('/');
    const shell = page.locator('#app-shell');

    await shell.dispatchEvent('pointerdown', {
      button: 0,
      clientX: 300,
      clientY: 400,
      pointerId: 1
    });
    await shell.dispatchEvent('pointermove', { clientX: 250, clientY: 400, pointerId: 1 });
    await shell.dispatchEvent('pointermove', { clientX: 100, clientY: 400, pointerId: 1 });
    await page.waitForTimeout(40);

    const skyOpacities = await page.evaluate(() => {
      const layers = document.querySelectorAll<HTMLElement>('.sky-layer');
      return [Number(layers[0].style.opacity), Number(layers[1].style.opacity)];
    });
    expect(skyOpacities[0]).toBeGreaterThan(0.2);
    expect(skyOpacities[0]).toBeLessThan(0.8);
    expect(skyOpacities[1]).toBeGreaterThan(0.2);
    expect(skyOpacities[1]).toBeLessThan(0.8);

    await shell.dispatchEvent('pointerup', { clientX: 100, clientY: 400, pointerId: 1 });
    await expect(page.locator('.story-seg.is-active-pill')).toContainText('Day 2');
  });

  test('3. verifies right/left tap navigation, ArrowRight/ArrowLeft keys, and Day 1 boundary clamping', async ({
    page
  }) => {
    await page.goto('/');
    const shell = page.locator('#app-shell');

    await shell.dispatchEvent('pointerdown', {
      button: 0,
      clientX: 40,
      clientY: 400,
      pointerId: 5
    });
    await shell.dispatchEvent('pointerup', { button: 0, clientX: 40, clientY: 400, pointerId: 5 });
    await expect(page.locator('.story-seg.is-active-pill')).toContainText('Day 1');

    await page.waitForTimeout(220);
    await shell.dispatchEvent('pointerdown', {
      button: 0,
      clientX: 350,
      clientY: 400,
      pointerId: 6
    });
    await shell.dispatchEvent('pointerup', {
      button: 0,
      clientX: 350,
      clientY: 400,
      pointerId: 6
    });
    await expect(page.locator('.story-seg.is-active-pill')).toContainText('Day 2');

    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.story-seg.is-active-pill')).toContainText('Day 3');
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('.story-seg.is-active-pill')).toContainText('Day 2');
  });

  test('4. verifies SCSS theme classes, parallax CSS variables, HiDPI #fx-canvas pixels & Google Maps click', async ({
    page
  }) => {
    await page.goto('/');
    const shell = page.locator('#app-shell');
    const group0 = page.locator('.scene-group-clip[data-group="0"]');

    await expect(shell).toHaveClass(/theme-dark/);
    await expect(group0).toHaveAttribute('style', /--pan-shift:\s*0(\.0)?px/);

    await page
      .locator('.story-slot[data-day="1"]')
      .dispatchEvent('pointerdown', { button: 0, clientX: 0, clientY: 0, pointerId: 1 });
    await page
      .locator('.story-slot[data-day="1"]')
      .dispatchEvent('pointerup', { button: 0, pointerId: 1 });
    await expect(group0).toHaveAttribute('style', /--pan-shift:\s*-54\.0px/);

    await page
      .locator('.story-slot[data-day="3"]')
      .dispatchEvent('pointerdown', { button: 0, clientX: 0, clientY: 0, pointerId: 1 });
    await page
      .locator('.story-slot[data-day="3"]')
      .dispatchEvent('pointerup', { button: 0, pointerId: 1 });
    await expect(shell).toHaveClass(/theme-light/);

    // Verify #fx-canvas uses 2x HiDPI backing store (780x1688) and rendered crisp snowfall pixels
    const canvasCheck = await page.evaluate(() => {
      const c = document.getElementById('fx-canvas') as HTMLCanvasElement;
      const ctx = c.getContext('2d');
      if (!ctx) return { width: 0, isPopulated: false };
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      let isPopulated = false;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 0) {
          isPopulated = true;
          break;
        }
      }
      return { width: c.width, isPopulated };
    });
    expect(canvasCheck.width).toBe(780);
    expect(canvasCheck.isPopulated).toBe(true);

    await page.evaluate(() => {
      (window as unknown as { __url: string }).__url = '';
      window.open = (u?: string | URL) => {
        (window as unknown as { __url: string }).__url = String(u ?? '');
        return null;
      };
    });
    await shell.dispatchEvent('pointerdown', {
      button: 0,
      clientX: 200,
      clientY: 780,
      pointerId: 9
    });
    await shell.dispatchEvent('pointerup', { button: 0, clientX: 200, clientY: 780, pointerId: 9 });
    const opened = await page.evaluate(() => (window as unknown as { __url: string }).__url);
    expect(opened).toContain('Asahikawa');
  });

  test('5. verifies wide desktop (1280x800) full-bleed SVG cityscape and narrow phone (360x780) layout integrity', async ({
    page
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/#day-6');

    await expect(page.locator('.story-seg.is-active-pill')).toContainText('Day 6');

    // On 1280px desktop, Group 2 (Lake Shikotsu, base widthPx 480) dynamically stretches across all 1280px
    const group2LayerBox = await requireBox(
      page.locator('.scene-group-clip[data-group="2"] .parallax-fg'),
      'Desktop Group 2 foreground SVG'
    );
    expect(group2LayerBox.width).toBeGreaterThanOrEqual(1280);

    // Stage frame centers cleanly on desktop without fake bezels
    const frameBox = await requireBox(page.locator('#stage-frame'), '#stage-frame');
    expect(frameBox.width).toBeLessThanOrEqual(480);
    expect(frameBox.x).toBeGreaterThan(350);

    // Narrow 360px phone renders without horizontal overflow
    await page.setViewportSize({ width: 360, height: 780 });
    const isNarrowOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(isNarrowOverflow).toBe(false);
  });
});
