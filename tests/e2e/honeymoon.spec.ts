import { test, expect, type Locator, type Page } from '@playwright/test';

interface CspWindow extends Window {
  __cspViolations?: string[];
}

async function requireBox(locator: Locator, label: string) {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error(`Expected bounding box for ${label}`);
  }
  return box;
}

async function installErrorAndCspMonitors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(`console.error: ${msg.text()}`);
    }
  });
  await page.addInitScript(() => {
    const win = window as unknown as CspWindow;
    win.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      win.__cspViolations?.push(`${event.violatedDirective}:${event.blockedURI}`);
    });
  });
  return errors;
}

test.describe('00OO Hokkaido Honeymoon 2027 — Visual, 60Hz Physics, WCAG & Responsive E2E Suite', () => {
  test('1. renders all 12 days under strict CSP with zero collisions, zero footer overlap, and deterministic screenshots', async ({
    page
  }) => {
    const errors = await installErrorAndCspMonitors(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveTitle('00OO 北海道蜜月 2027');

    const isOverflowX = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(isOverflowX).toBe(false);

    const railLineBox = await requireBox(page.locator('#timeline-line'), '#timeline-line');
    const storyTrackBox = await requireBox(page.locator('#story-bar-track'), '#story-bar-track');
    const railBox = await requireBox(page.locator('#timeline-rail'), '#timeline-rail');
    const footerBox = await requireBox(page.locator('#cityscape-footer'), '#cityscape-footer');
    expect(storyTrackBox.x).toBe(railBox.x);

    for (let dayIdx = 0; dayIdx < 12; dayIdx++) {
      await page.locator(`.story-slot[data-day="${dayIdx}"]`).click();

      const pill = page.locator('.story-seg.is-active-pill');
      await expect(pill).toContainText(`Day ${dayIdx + 1}`);
      const pillBox = await requireBox(pill, 'active pill');
      expect(pillBox.x).toBeGreaterThanOrEqual(16);
      expect(pillBox.x + pillBox.width).toBeLessThanOrEqual(384);

      const panel = page.locator(`.day-schedule-panel[data-day="${dayIdx}"]`);
      await expect(panel).toBeVisible();
      const rows = panel.locator('.schedule-item-row');
      const rowCount = await rows.count();
      expect(rowCount).toBeGreaterThanOrEqual(3);

      let prevBottom = -1;
      for (let rowIdx = 0; rowIdx < rowCount; rowIdx++) {
        const rowEl = rows.nth(rowIdx);
        const titleEl = rowEl.locator('.schedule-item-title');
        const tBox = await requireBox(titleEl, `Day ${dayIdx + 1} title ${rowIdx + 1}`);
        expect(tBox.height).toBeGreaterThan(16);
        expect(tBox.height).toBeLessThanOrEqual(28);
        expect(tBox.width).toBeGreaterThan(36);
        const isTitleOverflow = await titleEl.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
        expect(isTitleOverflow, `Day ${dayIdx + 1} row ${rowIdx + 1} title overflow`).toBe(false);

        expect(tBox.x).toBeGreaterThan(railLineBox.x + railLineBox.width + 6);
        expect(tBox.x + tBox.width).toBeLessThanOrEqual(390);
        expect(tBox.y).toBeGreaterThan(prevBottom);

        const subEl = rowEl.locator('.schedule-item-subtitle');
        const subCount = await subEl.count();
        if (subCount > 0) {
          const sBox = await requireBox(subEl, `Day ${dayIdx + 1} subtitle ${rowIdx + 1}`);
          const subText = (await subEl.textContent()) ?? '';
          expect(
            sBox.height,
            `Day ${dayIdx + 1} row ${rowIdx + 1} subtitle wrapped (${subText})`
          ).toBeLessThanOrEqual(22);
          const isSubOverflow = await subEl.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
          expect(
            isSubOverflow,
            `Day ${dayIdx + 1} row ${rowIdx + 1} subtitle overflow (${subText})`
          ).toBe(false);
          prevBottom = sBox.y + sBox.height;
        } else {
          prevBottom = tBox.y + tBox.height;
        }

        expect(
          prevBottom,
          `Day ${dayIdx + 1} row ${rowIdx + 1} overlaps #cityscape-footer`
        ).toBeLessThanOrEqual(footerBox.y);
      }

      const fileName = `day-${String(dayIdx + 1).padStart(2, '0')}.png`;
      await expect(page).toHaveScreenshot(fileName, { animations: 'disabled' });
    }

    const cspViolations = await page.evaluate(
      () => (window as unknown as CspWindow).__cspViolations ?? []
    );
    expect(cspViolations).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('2. verifies Porter-Duff bidirectional sky blending (opaque base + fractional upper layer, zero CPU gradient repaint)', async ({
    page
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/#day-1');
    const shell = page.locator('#app-shell');

    await shell.dispatchEvent('pointerdown', {
      button: 0,
      clientX: 300,
      clientY: 400,
      pointerId: 1
    });
    await shell.dispatchEvent('pointermove', { clientX: 250, clientY: 400, pointerId: 1 });
    await shell.dispatchEvent('pointermove', { clientX: 105, clientY: 400, pointerId: 1 });
    await page.waitForTimeout(40);

    const skyState = await page.evaluate(() => {
      const skyStack = document.getElementById('sky-stack');
      const layers = document.querySelectorAll<HTMLElement>('.sky-layer');
      return {
        stackInlineBackground: skyStack?.style.background ?? '',
        layer0Opacity: layers[0].style.opacity,
        layer1Opacity: Number(layers[1].style.opacity)
      };
    });

    expect(skyState.stackInlineBackground).toBe('');
    expect(skyState.layer0Opacity).toBe('1');
    expect(skyState.layer1Opacity).toBeGreaterThan(0.2);
    expect(skyState.layer1Opacity).toBeLessThan(0.8);

    await shell.dispatchEvent('pointerup', { clientX: 105, clientY: 400, pointerId: 1 });
    await expect(page.locator('.story-seg.is-active-pill')).toContainText('Day 2');
  });

  test('3. verifies footer native Universal Links across regions and suppresses map clicks during horizontal footer swipes', async ({
    page,
    context
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/#day-1');

    const mapLink = page.locator('#cityscape-map-link');
    await expect(mapLink).toHaveAttribute('target', '_blank');
    await expect(mapLink).toHaveAttribute('rel', 'noopener noreferrer');

    const expectedLandmarks: ReadonlyArray<readonly [number, RegExp]> = [
      [0, /Sapporo/],
      [3, /Asahikawa/],
      [4, /Biei/],
      [5, /Shikotsu/],
      [8, /Otaru/],
      [11, /New%20Chitose/]
    ];

    for (const [dayIdx, pattern] of expectedLandmarks) {
      await page.locator(`.story-slot[data-day="${dayIdx}"]`).click();
      await expect(mapLink).toHaveAttribute('href', pattern);
    }

    // Return to Day 1 and swipe horizontally starting directly inside #cityscape-footer
    await page.locator('.story-slot[data-day="0"]').click();
    const footerBox = await requireBox(page.locator('#cityscape-footer'), '#cityscape-footer');
    const swipeY = footerBox.y + footerBox.height * 0.5;

    await page.mouse.move(330, swipeY);
    await page.mouse.down();
    await page.mouse.move(250, swipeY, { steps: 4 });
    await page.mouse.move(80, swipeY, { steps: 6 });
    await page.mouse.up();

    await expect(page.locator('.story-seg.is-active-pill')).toContainText('Day 2');
    expect(context.pages()).toHaveLength(1);
  });

  test('4. verifies iOS Low Power Mode 60Hz invariants: 2x DPR cap on 3x Retina, .is-gliding CoreAnimation transitions, paused SVG loops, and hidden inactive spans', async ({
    browser
  }) => {
    const retinaContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3
    });
    const page = await retinaContext.newPage();
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/#day-10');

    // 1. Verify #fx-canvas caps backing store at 2x (780px) even on 3x Retina devices
    const canvasMetrics = await page.evaluate(() => {
      const canvas = document.getElementById('fx-canvas') as HTMLCanvasElement;
      const ctx = canvas.getContext('2d');
      if (!ctx) return { width: 0, isPopulated: false };
      const alphaData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let isPopulated = false;
      for (let i = 3; i < alphaData.length; i += 4) {
        if (alphaData[i] > 0) {
          isPopulated = true;
          break;
        }
      }
      return { width: canvas.width, isPopulated };
    });
    expect(canvasMetrics.width).toBeLessThanOrEqual(390 * 2);
    expect(canvasMetrics.width).toBe(780);
    expect(canvasMetrics.isPopulated).toBe(true);

    // 2. Verify inactive story segment spans stay display:none (zero layout thrash) and 3-day GPU staging cap
    const preGlideGpuState = await page.evaluate(() => {
      const inactiveSpan = document.querySelector('.story-seg:not(.is-active-pill) > span');
      const activePanel = document.querySelector<HTMLElement>('.day-schedule-panel[data-day="9"]');
      return {
        isInactiveSpanHidden:
          inactiveSpan !== null && window.getComputedStyle(inactiveSpan).display === 'none',
        stagedPanelCount: document.querySelectorAll('.day-schedule-panel.is-gpu-staged').length,
        stagedSkyCount: document.querySelectorAll('.sky-layer.is-gpu-staged').length,
        activePanelWillChange: activePanel ? window.getComputedStyle(activePanel).willChange : ''
      };
    });
    expect(preGlideGpuState.isInactiveSpanHidden).toBe(true);
    expect(preGlideGpuState.stagedPanelCount).toBeLessThanOrEqual(3);
    expect(preGlideGpuState.stagedSkyCount).toBeLessThanOrEqual(3);
    expect(preGlideGpuState.stagedPanelCount).toBe(3);
    expect(preGlideGpuState.stagedSkyCount).toBe(3);
    expect(preGlideGpuState.activePanelWillChange).toContain('transform');

    // 3. Trigger adjacent day glide (Day 10 -> Day 11 in Group 4) and inspect active .is-gliding compositor state
    await page.keyboard.press('ArrowRight');
    const glideDiagnostics = await page.evaluate(() => {
      const shell = document.getElementById('app-shell');
      const panel = document.querySelector<HTMLElement>('.day-schedule-panel[data-day="10"]');
      const shimmer = document.querySelector<SVGElement>(
        '.scene-group-clip[data-group="4"] .water-shimmer'
      );
      const ferris = document.querySelector<SVGElement>(
        '.scene-group-clip[data-group="4"] .ferris-wheel-spin'
      );
      return {
        isGlidingClass: shell?.classList.contains('is-gliding') ?? false,
        stagedPanelCount: document.querySelectorAll('.day-schedule-panel.is-gpu-staged').length,
        stagedSkyCount: document.querySelectorAll('.sky-layer.is-gpu-staged').length,
        panelTransitionDuration: panel ? window.getComputedStyle(panel).transitionDuration : '',
        shimmerPlayState: shimmer ? window.getComputedStyle(shimmer).animationPlayState : '',
        ferrisPlayState: ferris ? window.getComputedStyle(ferris).animationPlayState : ''
      };
    });

    expect(glideDiagnostics.isGlidingClass).toBe(true);
    expect(glideDiagnostics.stagedPanelCount).toBeLessThanOrEqual(3);
    expect(glideDiagnostics.stagedSkyCount).toBeLessThanOrEqual(3);
    expect(glideDiagnostics.panelTransitionDuration).toContain('0.32s');
    expect(glideDiagnostics.shimmerPlayState).toBe('paused');
    expect(glideDiagnostics.ferrisPlayState).toBe('paused');

    await retinaContext.close();
  });

  test('5. enforces WCAG 2.1 AA contrast (>= 4.5:1) across all 12 days in real Chromium computed styles', async ({
    page
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);

    for (let dayIdx = 0; dayIdx < 12; dayIdx++) {
      await page.locator(`.story-slot[data-day="${dayIdx}"]`).click();

      const minDayContrast = await page.evaluate((idx) => {
        const parseRgbList = (str: string): Array<[number, number, number]> => {
          const matches = str.matchAll(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/g);
          const parsed: Array<[number, number, number]> = [];
          for (const m of matches) {
            parsed.push([Number(m[1]), Number(m[2]), Number(m[3])]);
          }
          return parsed;
        };

        const relativeLuminance = ([r, g, b]: [number, number, number]): number => {
          const toLinear = (channel: number): number => {
            const s = channel / 255;
            return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
          };
          return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
        };

        const contrastRatio = (
          fg: [number, number, number],
          bg: [number, number, number]
        ): number => {
          const l1 = relativeLuminance(fg);
          const l2 = relativeLuminance(bg);
          const lighter = Math.max(l1, l2);
          const darker = Math.min(l1, l2);
          return (lighter + 0.05) / (darker + 0.05);
        };

        const skyLayer = document.querySelectorAll<HTMLElement>('.sky-layer')[idx];
        const skyStops = parseRgbList(window.getComputedStyle(skyLayer).backgroundImage);
        if (skyStops.length === 0) return 0;

        let lowestRatio = Infinity;

        // Check active story pill children against #0f172a pill background
        const activePill = document.querySelector<HTMLElement>('.story-seg.is-active-pill');
        if (!activePill) return 0;
        const pillBg = parseRgbList(window.getComputedStyle(activePill).backgroundColor)[0];
        for (const span of activePill.querySelectorAll<HTMLElement>('span')) {
          const spanFg = parseRgbList(window.getComputedStyle(span).color)[0];
          lowestRatio = Math.min(lowestRatio, contrastRatio(spanFg, pillBg));
        }

        // Check schedule titles, subtitles, and visible timeline labels against all sky stops
        const panel = document.querySelector<HTMLElement>(`.day-schedule-panel[data-day="${idx}"]`);
        if (!panel) return 0;
        const skyTextEls: HTMLElement[] = [
          ...Array.from(
            panel.querySelectorAll<HTMLElement>('.schedule-item-title, .schedule-item-subtitle')
          ),
          ...Array.from(
            document.querySelectorAll<HTMLElement>('.tl-node .tl-time-label.tl-time-a')
          ).filter((el) => el.parentElement?.parentElement?.style.opacity !== '0')
        ];

        for (const el of skyTextEls) {
          const fg = parseRgbList(window.getComputedStyle(el).color)[0];
          for (const stop of skyStops) {
            lowestRatio = Math.min(lowestRatio, contrastRatio(fg, stop));
          }
        }

        return lowestRatio;
      }, dayIdx);

      expect(
        minDayContrast,
        `Day ${dayIdx + 1} failed WCAG 2.1 AA 4.5:1 contrast`
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  test('6. verifies responsive viewports (320x568 SE, 390x844, 1280x800, 1920x1080), Day 5 couple framing, and blind-box privacy', async ({
    page
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });

    // 1. Day 5 on 390x844: Bride & Groom (#biei-wedding-couple) must sit 100% inside the 390px viewport
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/#day-5');
    await page.evaluate(() => document.fonts.ready);

    const coupleBox = await requireBox(
      page.locator('#biei-wedding-couple'),
      '#biei-wedding-couple'
    );
    expect(coupleBox.x).toBeGreaterThanOrEqual(0);
    expect(coupleBox.x + coupleBox.width).toBeLessThanOrEqual(390);

    // 2. Surprise blind-box items across all 12 panels must never render as clickable <a href> anchors
    const isSpoilerAnchor = await page.evaluate(() => {
      const blindKeywords = ['神秘體驗', '敬請期待', '隱世溫泉飯店'];
      const rows = Array.from(document.querySelectorAll<HTMLElement>('.schedule-item-row'));
      for (const row of rows) {
        const text = row.textContent;
        const isBlindRow = blindKeywords.some((kw) => text.includes(kw));
        if (isBlindRow && row.querySelector('a[href]') !== null) {
          return true;
        }
      }
      return false;
    });
    expect(isSpoilerAnchor).toBe(false);

    // 3. Multi-viewport integrity across compact portrait (320x568) and full-bleed desktop (1280x800, 1920x1080)
    const viewports: ReadonlyArray<{ width: number; height: number; isDesktop: boolean }> = [
      { width: 320, height: 568, isDesktop: false },
      { width: 1280, height: 800, isDesktop: true },
      { width: 1920, height: 1080, isDesktop: true }
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.locator('.story-slot[data-day="5"]').click();

      const layoutAudit = await page.evaluate(() => {
        const isDocOverflow =
          document.documentElement.scrollWidth > document.documentElement.clientWidth;
        const footerRect = document.getElementById('cityscape-footer')?.getBoundingClientRect();
        if (!footerRect)
          return { isDocOverflow: true, isItemOverflow: true, isFooterOverlap: true };

        let isItemOverflow = false;
        let isFooterOverlap = false;
        const panel = document.querySelector<HTMLElement>('.day-schedule-panel[data-day="5"]');
        const items = panel
          ? Array.from(
              panel.querySelectorAll<HTMLElement>('.schedule-item-title, .schedule-item-subtitle')
            )
          : [];

        for (const el of items) {
          if (el.scrollWidth > el.clientWidth + 1) {
            isItemOverflow = true;
          }
          if (el.getBoundingClientRect().bottom > footerRect.top) {
            isFooterOverlap = true;
          }
        }
        return { isDocOverflow, isItemOverflow, isFooterOverlap };
      });

      expect(layoutAudit.isDocOverflow, `Doc overflow at ${vp.width}x${vp.height}`).toBe(false);
      expect(layoutAudit.isItemOverflow, `Item overflow at ${vp.width}x${vp.height}`).toBe(false);
      expect(layoutAudit.isFooterOverlap, `Footer overlap at ${vp.width}x${vp.height}`).toBe(false);

      if (vp.isDesktop) {
        const group2LayerBox = await requireBox(
          page.locator('.scene-group-clip[data-group="2"] .parallax-mid'),
          `Desktop ${vp.width}px Group 2 midground`
        );
        expect(group2LayerBox.width).toBeGreaterThanOrEqual(vp.width);

        const frameBox = await requireBox(page.locator('#stage-frame'), '#stage-frame');
        expect(frameBox.width).toBeLessThanOrEqual(480);
        expect(frameBox.x).toBeGreaterThan((vp.width - 480) / 2 - 4);
      }
    }
  });
});
