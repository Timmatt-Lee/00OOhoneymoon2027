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

    // Verify 2-frame (~25ms) fast flick with ZERO pointermove events on #cityscape-map-link advances Day 1 -> Day 2 and suppresses map click
    await page.locator('.story-slot[data-day="0"]').click();
    await expect(page.locator('.story-seg.is-active-pill')).toContainText('Day 1');
    await mapLink.dispatchEvent('pointerdown', {
      bubbles: true,
      button: 0,
      clientX: 300,
      clientY: swipeY,
      pointerId: 77
    });
    await page.waitForTimeout(25);
    await mapLink.dispatchEvent('pointerup', {
      bubbles: true,
      button: 0,
      clientX: 265,
      clientY: swipeY,
      pointerId: 77
    });
    const isFlickClickPrevented = await mapLink.evaluate((el) => {
      const clickEv = new MouseEvent('click', { bubbles: true, cancelable: true });
      el.dispatchEvent(clickEv);
      return clickEv.defaultPrevented;
    });
    expect(isFlickClickPrevented).toBe(true);
    await expect(page.locator('.story-seg.is-active-pill')).toContainText('Day 2');
    expect(context.pages()).toHaveLength(1);
  });

  test('4. verifies WebKit & 120Hz GPU invariants (1.25x non-iOS & 1x iOS DPR cap, containment, clipped SVG layers, promoted timeline labels) and rapid multi-flick chaining', async ({
    browser
  }) => {
    const retinaContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3
    });
    const page = await retinaContext.newPage();
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/#day-10');

    // 1. Verify #fx-canvas caps backing store at 1.25x (488px) on non-iOS 3x Retina devices
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
    expect(canvasMetrics.width).toBe(488);
    expect(canvasMetrics.isPopulated).toBe(true);

    // 2. Verify GPU layer pruning, containment, clipped SVG textures (zero CATiledLayer overflow), and zero SVG @keyframes
    const gpuState = await page.evaluate(() => {
      const topHeader = document.getElementById('top-header');
      const timelineRail = document.getElementById('timeline-rail');
      const inactiveSpan = document.querySelector('.story-seg:not(.is-active-pill) > span');
      const activePanel = document.querySelector<HTMLElement>('.day-schedule-panel[data-day="9"]');
      const tlNode = document.querySelector<HTMLElement>('.tl-node');
      const tlTimeLabel = document.querySelector<HTMLElement>('.tl-time-label');
      const tlDot = document.querySelector<HTMLElement>('.tl-dot');
      const planeActor = document.querySelector<HTMLElement>('.plane-actor');
      const parallaxLayer = document.querySelector<HTMLElement>(
        '.scene-group-clip[data-group="4"] .parallax-fg'
      );
      const sceneSvg = document.querySelector<SVGSVGElement>(
        '.scene-group-clip[data-group="4"] .scene-svg'
      );
      const shimmer = document.querySelector<SVGElement>(
        '.scene-group-clip[data-group="4"] .water-shimmer'
      );
      const ferris = document.querySelector<SVGElement>(
        '.scene-group-clip[data-group="4"] .ferris-wheel-spin'
      );
      return {
        isInactiveSpanHidden:
          inactiveSpan !== null && window.getComputedStyle(inactiveSpan).display === 'none',
        stagedPanelCount: document.querySelectorAll('.day-schedule-panel.is-gpu-staged').length,
        stagedSkyCount: document.querySelectorAll('.sky-layer.is-gpu-staged').length,
        headerContain: topHeader ? window.getComputedStyle(topHeader).contain : '',
        railContain: timelineRail ? window.getComputedStyle(timelineRail).contain : '',
        panelContain: activePanel ? window.getComputedStyle(activePanel).contain : '',
        activePanelWillChange: activePanel ? window.getComputedStyle(activePanel).willChange : '',
        tlNodeWillChange: tlNode ? window.getComputedStyle(tlNode).willChange : '',
        tlTimeLabelWillChange: tlTimeLabel ? window.getComputedStyle(tlTimeLabel).willChange : '',
        tlDotWillChange: tlDot ? window.getComputedStyle(tlDot).willChange : '',
        planeWillChange: planeActor ? window.getComputedStyle(planeActor).willChange : '',
        parallaxOverflow: parallaxLayer ? window.getComputedStyle(parallaxLayer).overflow : '',
        svgOverflowAttr: sceneSvg?.getAttribute('overflow') ?? '',
        svgOverflowStyle: sceneSvg ? window.getComputedStyle(sceneSvg).overflow : '',
        shimmerAnimName: shimmer ? window.getComputedStyle(shimmer).animationName : '',
        ferrisAnimName: ferris ? window.getComputedStyle(ferris).animationName : ''
      };
    });
    expect(gpuState.isInactiveSpanHidden).toBe(true);
    expect(gpuState.stagedPanelCount).toBe(3);
    expect(gpuState.stagedSkyCount).toBe(3);
    expect(gpuState.headerContain).toBe('content');
    expect(gpuState.railContain).toBe('content');
    expect(gpuState.panelContain).toBe('content');
    expect(gpuState.activePanelWillChange).toContain('transform');
    expect(gpuState.tlNodeWillChange).toContain('transform');
    expect(gpuState.tlTimeLabelWillChange).toBe('opacity');
    expect(gpuState.tlDotWillChange).toBe('auto');
    expect(gpuState.planeWillChange).toBe('auto');
    expect(gpuState.parallaxOverflow).toBe('hidden');
    expect(gpuState.svgOverflowAttr).toBe('hidden');
    expect(gpuState.svgOverflowStyle).toBe('hidden');
    expect(gpuState.shimmerAnimName).toBe('none');
    expect(gpuState.ferrisAnimName).toBe('none');

    // 3. Verify short (< 30px) high-velocity flick advances Day 3 (dark) -> Day 4 (light) without premature frame-0 contrast flip or inert rebuild
    await page.locator('.story-slot[data-day="2"]').click();
    await expect(page.locator('.story-seg.is-active-pill')).toContainText('Day 3');
    const shell = page.locator('#app-shell');
    await shell.dispatchEvent('pointerdown', {
      button: 0,
      clientX: 250,
      clientY: 400,
      pointerId: 1
    });
    await page.waitForTimeout(20);
    await shell.dispatchEvent('pointermove', { clientX: 228, clientY: 400, pointerId: 1 });
    await shell.dispatchEvent('pointerup', { clientX: 228, clientY: 400, pointerId: 1 });

    const movingDiagnostics = await page.evaluate(() => {
      const shellEl = document.getElementById('app-shell');
      const panel2 = document.querySelector<HTMLElement>('.day-schedule-panel[data-day="2"]');
      const panel3 = document.querySelector<HTMLElement>('.day-schedule-panel[data-day="3"]');
      return {
        isMovingClass: shellEl?.classList.contains('is-moving') ?? false,
        isStillDarkBeforeMidpoint: shellEl?.classList.contains('theme-dark') ?? false,
        isPanel2StillInteractive: panel2 ? !panel2.inert : false,
        panelTransitionDuration: panel3 ? window.getComputedStyle(panel3).transitionDuration : ''
      };
    });
    expect(movingDiagnostics.isMovingClass).toBe(true);
    expect(movingDiagnostics.isStillDarkBeforeMidpoint).toBe(true);
    expect(movingDiagnostics.isPanel2StillInteractive).toBe(true);
    expect(movingDiagnostics.panelTransitionDuration).toBe('0s');
    await expect(page.locator('.story-seg.is-active-pill')).toContainText('Day 4');
    await expect(shell).not.toHaveClass(/is-moving/);
    await expect(shell).toHaveClass(/theme-light/);

    // Reset to Day 1 and fire 3 rapid short flicks (< 30px each) in quick succession -> chains smoothly Day 1 -> Day 2 -> Day 3 -> Day 4!
    await page.locator('.story-slot[data-day="0"]').click();
    await expect(page.locator('.story-seg.is-active-pill')).toContainText('Day 1');

    for (let flickIdx = 0; flickIdx < 3; flickIdx++) {
      const pid = 10 + flickIdx;
      await shell.dispatchEvent('pointerdown', {
        button: 0,
        clientX: 260,
        clientY: 420,
        pointerId: pid
      });
      await page.waitForTimeout(18);
      await shell.dispatchEvent('pointermove', {
        clientX: 236,
        clientY: 420,
        pointerId: pid
      });
      await shell.dispatchEvent('pointerup', {
        clientX: 236,
        clientY: 420,
        pointerId: pid
      });
      await page.waitForTimeout(45);
    }

    await expect(page.locator('.story-seg.is-active-pill')).toContainText('Day 4');
    await expect(shell).not.toHaveClass(/is-moving/);
    expect(page.url()).toContain('#day-4');

    // 4. Verify iOS WebKit (-webkit-touch-callout: none) caps #fx-canvas backing store at 1x DPR (393px)
    const iosPage = await retinaContext.newPage();
    await iosPage.addInitScript(() => {
      const origSupports = window.CSS.supports.bind(window.CSS);
      window.CSS.supports = (prop: string, val?: string): boolean => {
        if (prop === '-webkit-touch-callout' && val === 'none') return true;
        return typeof val === 'string' ? origSupports(prop, val) : origSupports(prop);
      };
    });
    await iosPage.setViewportSize({ width: 393, height: 852 });
    await iosPage.goto('/#day-5');
    const iosCanvasWidth = await iosPage.evaluate(
      () => (document.getElementById('fx-canvas') as HTMLCanvasElement).width
    );
    expect(iosCanvasWidth).toBe(393);

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

  test('6. verifies responsive viewports (320x568 SE, 390x844, 393x852 iPhone 14 Pro full-screen WebClip, 852x393 portrait-lock, 1280x800, 1920x1080), Day 5 couple framing, and blind-box privacy', async ({
    page,
    browser
  }) => {
    const errors = await installErrorAndCspMonitors(page);
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
        const shellEl = document.getElementById('app-shell');
        const isLandscapeLocked = shellEl?.classList.contains('is-landscape-locked') ?? false;
        const isDocOverflow =
          document.documentElement.scrollWidth > document.documentElement.clientWidth;
        const footerRect = document.getElementById('cityscape-footer')?.getBoundingClientRect();
        if (!footerRect) {
          return {
            isLandscapeLocked,
            isDocOverflow: true,
            isItemOverflow: true,
            isFooterOverlap: true
          };
        }

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
        return { isLandscapeLocked, isDocOverflow, isItemOverflow, isFooterOverlap };
      });

      expect(layoutAudit.isLandscapeLocked, `Landscape lock at ${vp.width}x${vp.height}`).toBe(
        false
      );
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

    // 4. iPhone 14 Pro coarse-pointer landscape (852x393) portrait-lock + rotated swipe & standalone WebClip --ios-chin-fix (393x818 -> 852pt)
    const iosContext = await browser.newContext({
      viewport: { width: 852, height: 393 },
      deviceScaleFactor: 3,
      hasTouch: true,
      isMobile: true
    });
    const iosPage = await iosContext.newPage();
    await iosPage.addInitScript(() => {
      Object.defineProperty(navigator, 'standalone', { value: true, configurable: true });
      Object.defineProperty(window.screen, 'width', { value: 393, configurable: true });
      Object.defineProperty(window.screen, 'height', { value: 852, configurable: true });
    });
    await iosPage.emulateMedia({ reducedMotion: 'reduce' });
    await iosPage.goto('/#day-1');
    await iosPage.evaluate(() => document.fonts.ready);

    const landscapeAudit = await iosPage.evaluate(() => {
      const shellEl = document.getElementById('app-shell');
      const footerEl = document.getElementById('cityscape-footer');
      if (!shellEl || !footerEl) return null;
      const shellRect = shellEl.getBoundingClientRect();
      return {
        isLandscapeLocked: shellEl.classList.contains('is-landscape-locked'),
        clientWidth: shellEl.clientWidth,
        clientHeight: shellEl.clientHeight,
        footerClientHeight: footerEl.clientHeight,
        rectWidth: Math.round(shellRect.width),
        rectHeight: Math.round(shellRect.height),
        appHVar: document.documentElement.style.getPropertyValue('--app-h')
      };
    });
    expect(landscapeAudit).not.toBeNull();
    expect(landscapeAudit?.isLandscapeLocked).toBe(true);
    expect(landscapeAudit?.clientWidth).toBe(393);
    expect(landscapeAudit?.clientHeight).toBe(852);
    expect(landscapeAudit?.footerClientHeight).toBeGreaterThanOrEqual(200);
    expect(landscapeAudit?.rectWidth).toBe(852);
    expect(landscapeAudit?.rectHeight).toBe(393);
    expect(landscapeAudit?.appHVar).toBe('852px');

    // Dispatch rotated horizontal swipe in ccw90 landscape (moving clientY 73 -> 293 maps to stage X 320 -> 100)
    const iosShell = iosPage.locator('#app-shell');
    await iosShell.dispatchEvent('pointerdown', {
      button: 0,
      clientX: 400,
      clientY: 73,
      pointerId: 1
    });
    await iosShell.dispatchEvent('pointermove', { clientX: 400, clientY: 293, pointerId: 1 });
    await iosShell.dispatchEvent('pointerup', { clientX: 400, clientY: 293, pointerId: 1 });
    await expect(iosPage.locator('.story-seg.is-active-pill')).toContainText('Day 2');

    // Simulate iOS Standalone Landscape subtracting 21pt Home Indicator (852x372 vs 393pt short edge -> --ios-chin-fix: 21px)
    await iosPage.setViewportSize({ width: 852, height: 372 });
    await iosPage.evaluate(() => window.dispatchEvent(new Event('resize')));
    const landscapeChinAudit = await iosPage.evaluate(() => {
      const shellEl = document.getElementById('app-shell');
      if (!shellEl) return null;
      const shellRect = shellEl.getBoundingClientRect();
      return {
        chinFixVar: document.documentElement.style.getPropertyValue('--ios-chin-fix'),
        lockWVar: document.documentElement.style.getPropertyValue('--lock-w'),
        clientWidth: shellEl.clientWidth,
        rectTop: Math.round(shellRect.top),
        rectBottom: Math.round(shellRect.bottom)
      };
    });
    expect(landscapeChinAudit).not.toBeNull();
    expect(landscapeChinAudit?.chinFixVar).toBe('21px');
    expect(landscapeChinAudit?.lockWVar).toBe('393px');
    expect(landscapeChinAudit?.clientWidth).toBe(393);
    expect(landscapeChinAudit?.rectTop).toBe(0);
    expect(landscapeChinAudit?.rectBottom).toBe(393);

    // Rotate back to iPhone 14 Pro Standalone WebClip portrait (innerHeight = 818 vs screen.height = 852 -> --ios-chin-fix = 34px)
    await iosPage.setViewportSize({ width: 393, height: 818 });
    await iosPage.evaluate(() => window.dispatchEvent(new Event('resize')));
    const chinFixAudit = await iosPage.evaluate(() => {
      const shellEl = document.getElementById('app-shell');
      const footerEl = document.getElementById('cityscape-footer');
      const snowSlotEl = document.getElementById('snow-ground-slot');
      const parallaxFg = document.querySelector<HTMLElement>(
        '.scene-group-clip.is-visible .parallax-fg'
      );
      if (!shellEl || !footerEl || !snowSlotEl || !parallaxFg) return null;
      return {
        isLandscapeLocked: shellEl.classList.contains('is-landscape-locked'),
        chinFixVar: document.documentElement.style.getPropertyValue('--ios-chin-fix'),
        shellBottom: Math.round(shellEl.getBoundingClientRect().bottom),
        footerBottom: Math.round(footerEl.getBoundingClientRect().bottom),
        parallaxBottom: Math.round(parallaxFg.getBoundingClientRect().bottom),
        snowSlotBottom: Math.round(snowSlotEl.getBoundingClientRect().bottom),
        snowSlotHeight: Math.round(snowSlotEl.getBoundingClientRect().height)
      };
    });
    expect(chinFixAudit).not.toBeNull();
    expect(chinFixAudit?.isLandscapeLocked).toBe(false);
    expect(chinFixAudit?.chinFixVar).toBe('34px');
    expect(chinFixAudit?.shellBottom).toBe(852);
    expect(chinFixAudit?.footerBottom).toBe(852);
    expect(chinFixAudit?.parallaxBottom).toBe(852);
    expect(chinFixAudit?.snowSlotBottom).toBe(852);
    expect(chinFixAudit?.snowSlotHeight).toBe(44);
    await iosContext.close();

    // 5. Full 12-day iPhone 14 Pro full-screen geometry audit (393x852, --sat: 59px, --sab: 34px) with 44px snowdrift and zero white wall
    await page.evaluate(() => {
      document.documentElement.style.setProperty('--sat', '59px');
      document.documentElement.style.setProperty('--sab', '34px');
    });
    await page.setViewportSize({ width: 393, height: 852 });
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));

    for (let dayIdx = 0; dayIdx < 12; dayIdx++) {
      await page.locator(`.story-slot[data-day="${dayIdx}"]`).click();

      const safeAreaAudit = await page.evaluate((idx) => {
        const shellEl = document.getElementById('app-shell');
        const footerEl = document.getElementById('cityscape-footer');
        const snowSlotEl = document.getElementById('snow-ground-slot');
        const snowSvgRect = document
          .querySelector<SVGElement>('.snow-ground-svg')
          ?.getBoundingClientRect();
        const visibleParallaxRect = document
          .querySelector<HTMLElement>('.scene-group-clip.is-visible .parallax-fg')
          ?.getBoundingClientRect();

        if (!shellEl || !footerEl || !snowSlotEl || !snowSvgRect || !visibleParallaxRect) {
          return null;
        }

        const shellRect = shellEl.getBoundingClientRect();
        const footerRect = footerEl.getBoundingClientRect();
        const snowSlotRect = snowSlotEl.getBoundingClientRect();

        const htmlBg = window.getComputedStyle(document.documentElement).backgroundColor;
        const bodyBg = window.getComputedStyle(document.body).backgroundColor;
        const shellBg = window.getComputedStyle(shellEl).backgroundColor;
        const snowAfterContent = window.getComputedStyle(snowSlotEl, '::after').content;
        const skyTopVar = document.documentElement.style.getPropertyValue('--sky-top-color');
        const isDocOverflow =
          document.documentElement.scrollWidth > document.documentElement.clientWidth;

        let isItemOverflow = false;
        let isFooterOverlap = false;
        let isRowCollision = false;

        const panel = document.querySelector<HTMLElement>(`.day-schedule-panel[data-day="${idx}"]`);
        const rows = panel
          ? Array.from(panel.querySelectorAll<HTMLElement>('.schedule-item-row'))
          : [];

        let prevBottom = -1;
        for (const row of rows) {
          const titleEl = row.querySelector<HTMLElement>('.schedule-item-title');
          const subEl = row.querySelector<HTMLElement>('.schedule-item-subtitle');
          if (!titleEl) continue;

          const tRect = titleEl.getBoundingClientRect();
          if (titleEl.scrollWidth > titleEl.clientWidth + 1) {
            isItemOverflow = true;
          }
          if (tRect.top <= prevBottom) {
            isRowCollision = true;
          }

          let rowBottom = tRect.bottom;
          if (subEl) {
            if (subEl.scrollWidth > subEl.clientWidth + 1) {
              isItemOverflow = true;
            }
            rowBottom = subEl.getBoundingClientRect().bottom;
          }
          if (rowBottom > footerRect.top) {
            isFooterOverlap = true;
          }
          prevBottom = rowBottom;
        }

        return {
          shellBottom: Math.round(shellRect.bottom),
          footerBottom: Math.round(footerRect.bottom),
          snowSlotBottom: Math.round(snowSlotRect.bottom),
          snowSlotHeight: Math.round(snowSlotRect.height),
          snowSvgHeight: Math.round(snowSvgRect.height),
          snowSvgBottom: Math.round(snowSvgRect.bottom),
          parallaxFgBottom: Math.round(visibleParallaxRect.bottom),
          htmlBg,
          bodyBg,
          shellBg,
          snowAfterContent,
          skyTopVar,
          rowCount: rows.length,
          isDocOverflow,
          isItemOverflow,
          isFooterOverlap,
          isRowCollision
        };
      }, dayIdx);

      expect(safeAreaAudit, `Missing stage elements on Day ${dayIdx + 1}`).not.toBeNull();
      if (!safeAreaAudit) continue;

      expect(safeAreaAudit.shellBottom, `Day ${dayIdx + 1} #app-shell bottom`).toBe(852);
      expect(safeAreaAudit.footerBottom, `Day ${dayIdx + 1} #cityscape-footer bottom`).toBe(852);
      expect(safeAreaAudit.snowSlotBottom, `Day ${dayIdx + 1} #snow-ground-slot bottom`).toBe(852);
      expect(safeAreaAudit.snowSlotHeight, `Day ${dayIdx + 1} #snow-ground-slot height`).toBe(44);
      expect(safeAreaAudit.snowSvgHeight, `Day ${dayIdx + 1} .snow-ground-svg height`).toBe(44);
      expect(safeAreaAudit.snowSvgBottom, `Day ${dayIdx + 1} .snow-ground-svg bottom`).toBe(852);
      expect(safeAreaAudit.parallaxFgBottom, `Day ${dayIdx + 1} .parallax-fg bottom`).toBe(852);
      expect(safeAreaAudit.htmlBg, `Day ${dayIdx + 1} html background-color`).toBe(
        'rgb(255, 255, 255)'
      );
      expect(safeAreaAudit.bodyBg, `Day ${dayIdx + 1} body background-color`).toBe(
        'rgb(255, 255, 255)'
      );
      expect(safeAreaAudit.shellBg, `Day ${dayIdx + 1} #app-shell background-color`).toBe(
        'rgb(255, 255, 255)'
      );
      expect(safeAreaAudit.snowAfterContent, `Day ${dayIdx + 1} #snow-ground-slot::after`).toBe(
        'none'
      );
      expect(safeAreaAudit.skyTopVar, `Day ${dayIdx + 1} --sky-top-color`).toBe('');
      expect(safeAreaAudit.rowCount).toBeGreaterThanOrEqual(3);
      expect(safeAreaAudit.isDocOverflow, `Day ${dayIdx + 1} 393x852 doc overflow`).toBe(false);
      expect(safeAreaAudit.isItemOverflow, `Day ${dayIdx + 1} 393x852 item overflow`).toBe(false);
      expect(safeAreaAudit.isRowCollision, `Day ${dayIdx + 1} 393x852 row collision`).toBe(false);
      expect(safeAreaAudit.isFooterOverlap, `Day ${dayIdx + 1} 393x852 footer overlap`).toBe(false);
    }

    const cspViolations = await page.evaluate(
      () => (window as unknown as CspWindow).__cspViolations ?? []
    );
    expect(cspViolations).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('7. advances cleanly across 8 rapid 75ms right-edge taps (Day 1 -> Day 9) without dropping taps and pre-stages cross-group scenes offscreen with zero Frame-1 layer churn', async ({
    browser
  }) => {
    const mobileContext = await browser.newContext({
      viewport: { width: 412, height: 915 },
      deviceScaleFactor: 3,
      hasTouch: true,
      isMobile: true
    });
    const page = await mobileContext.newPage();
    const errors = await installErrorAndCspMonitors(page);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/#day-1');
    await page.evaluate(() => document.fonts.ready);

    // 1. Fire 8 rapid 75ms right-edge taps (with realistic 30ms touch contact) from Day 1 -> Day 9
    const shell = page.locator('#app-shell');
    for (let tapIdx = 0; tapIdx < 8; tapIdx++) {
      const pid = 300 + tapIdx;
      await shell.dispatchEvent('pointerdown', {
        button: 0,
        clientX: 392,
        clientY: 450,
        pointerId: pid
      });
      if (tapIdx === 0) {
        // Verify moving schedule links disable pointer-events during active motion
        await shell.evaluate((el) => {
          el.classList.add('is-moving');
        });
        const movingLinkPointerEvents = await page.evaluate(() => {
          const link = document.querySelector<HTMLElement>(
            '.day-schedule-panel[data-day="0"] .is-map-link'
          );
          return link ? window.getComputedStyle(link).pointerEvents : '';
        });
        expect(movingLinkPointerEvents).toBe('none');
      }
      await page.waitForTimeout(30);
      await shell.dispatchEvent('pointerup', {
        button: 0,
        clientX: 392,
        clientY: 450,
        pointerId: pid
      });
      if (tapIdx < 7) {
        await page.waitForTimeout(45);
      }
    }

    await expect(page.locator('.story-seg.is-active-pill .pill-day-tag')).toHaveText('Day 9');
    await expect(shell).not.toHaveClass(/is-moving/);
    expect(page.url()).toContain('#day-9');

    // 2. Settle on Day 6 (Group 2, between Group 1 and Group 3) and verify offscreen pre-staged groups are 100% clipped outside #cityscape-footer
    await page.locator('.story-slot[data-day="5"]').click();
    await expect(shell).not.toHaveClass(/is-moving/);

    const preStageAudit = await page.evaluate(() => {
      const footer = document.getElementById('cityscape-footer');
      const g1 = document.querySelector<HTMLElement>('.scene-group-clip[data-group="1"]');
      const g2 = document.querySelector<HTMLElement>('.scene-group-clip[data-group="2"]');
      const g3 = document.querySelector<HTMLElement>('.scene-group-clip[data-group="3"]');
      if (!footer || !g1 || !g2 || !g3) return null;
      const fRect = footer.getBoundingClientRect();
      const r1 = g1.getBoundingClientRect();
      const r2 = g2.getBoundingClientRect();
      const r3 = g3.getBoundingClientRect();
      return {
        isG1Visible: g1.classList.contains('is-visible'),
        isG2Visible: g2.classList.contains('is-visible'),
        isG3Visible: g3.classList.contains('is-visible'),
        isG1ClippedLeft: r1.right <= fRect.left,
        isG2Aligned: Math.round(r2.left) === Math.round(fRect.left),
        isG3ClippedRight: r3.left >= fRect.right
      };
    });
    expect(preStageAudit).toEqual({
      isG1Visible: true,
      isG2Visible: true,
      isG3Visible: true,
      isG1ClippedLeft: true,
      isG2Aligned: true,
      isG3ClippedRight: true
    });

    // 3. Cross-group swipe Day 6 -> Day 7 triggers ZERO .is-visible additions and ZERO .is-gpu-staged mutations during motion
    await page.evaluate(() => {
      const win = window as unknown as {
        __motionClassChurnCount?: number;
        __motionObs?: MutationObserver;
      };
      win.__motionClassChurnCount = 0;
      const obs = new MutationObserver((records) => {
        const isMovingNow =
          document.getElementById('app-shell')?.classList.contains('is-moving') ?? false;
        if (!isMovingNow) return;
        for (const r of records) {
          if (
            r.target instanceof HTMLElement &&
            (r.target.classList.contains('sky-layer') ||
              r.target.classList.contains('day-schedule-panel') ||
              r.target.classList.contains('scene-group-clip'))
          ) {
            win.__motionClassChurnCount = (win.__motionClassChurnCount ?? 0) + 1;
          }
        }
      });
      const shellEl = document.getElementById('app-shell');
      if (shellEl) {
        obs.observe(shellEl, { subtree: true, attributes: true, attributeFilter: ['class'] });
      }
      win.__motionObs = obs;
    });

    await shell.dispatchEvent('pointerdown', {
      button: 0,
      clientX: 340,
      clientY: 460,
      pointerId: 401
    });
    await shell.dispatchEvent('pointermove', { clientX: 280, clientY: 460, pointerId: 401 });
    await page.waitForTimeout(20);
    await shell.dispatchEvent('pointermove', { clientX: 120, clientY: 460, pointerId: 401 });
    await shell.dispatchEvent('pointerup', { clientX: 120, clientY: 460, pointerId: 401 });

    await expect(page.locator('.story-seg.is-active-pill .pill-day-tag')).toHaveText('Day 7');
    await expect(shell).not.toHaveClass(/is-moving/);

    const motionClassChurnCount = await page.evaluate(() => {
      const win = window as unknown as {
        __motionClassChurnCount?: number;
        __motionObs?: MutationObserver;
      };
      win.__motionObs?.disconnect();
      return win.__motionClassChurnCount ?? -1;
    });
    expect(motionClassChurnCount).toBe(0);

    // 4. Verify >= 4px paint-containment clearance on all 4 sides for .is-map-link:focus-visible, .story-slot:focus-visible, and .tl-dot across 412x915 and 320x568
    for (const vp of [
      { width: 412, height: 915 },
      { width: 320, height: 568 }
    ]) {
      await page.setViewportSize(vp);
      await page.evaluate(() => window.dispatchEvent(new Event('resize')));

      for (let dayIdx = 0; dayIdx < 12; dayIdx++) {
        await page.locator(`.story-slot[data-day="${dayIdx}"]`).click();
        await expect(shell).not.toHaveClass(/is-moving/);
        await page.keyboard.press('Tab');

        const minClearancePx = await page.evaluate((idx) => {
          const header = document.getElementById('top-header');
          const rail = document.getElementById('timeline-rail');
          const panel = document.querySelector<HTMLElement>(
            `.day-schedule-panel[data-day="${idx}"]`
          );
          if (!header || !rail || !panel) return -999;

          const minInset = (inner: DOMRect, outer: DOMRect): number =>
            Math.min(
              inner.left - outer.left,
              outer.right - inner.right,
              inner.top - outer.top,
              outer.bottom - inner.bottom
            );

          let minPx = Infinity;
          const hRect = header.getBoundingClientRect();
          for (const slot of header.querySelectorAll<HTMLElement>('.story-slot')) {
            slot.focus();
            minPx = Math.min(minPx, minInset(slot.getBoundingClientRect(), hRect));
          }

          const rRect = rail.getBoundingClientRect();
          for (const dot of rail.querySelectorAll<HTMLElement>('.tl-dot')) {
            const node = dot.closest<HTMLElement>('.tl-node');
            if (node && node.style.opacity !== '0') {
              minPx = Math.min(minPx, minInset(dot.getBoundingClientRect(), rRect));
            }
          }

          const pRect = panel.getBoundingClientRect();
          for (const link of panel.querySelectorAll<HTMLElement>('.is-map-link')) {
            link.focus();
            minPx = Math.min(minPx, minInset(link.getBoundingClientRect(), pRect));
          }
          return minPx;
        }, dayIdx);

        expect(
          minClearancePx,
          `Paint-containment clearance < 4px on Day ${dayIdx + 1} at ${vp.width}x${vp.height}`
        ).toBeGreaterThanOrEqual(4);
      }
    }

    expect(errors).toEqual([]);
    await mobileContext.close();
  });

  test('8. maintains continuous 60fps snowfall during active swipes and smoothly fades Night Glow and Onsen Steam in/out without pop-in, midpoint dips, or instant vanish', async ({
    page
  }) => {
    const errors = await installErrorAndCspMonitors(page);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto('/?fx=live#day-8');
    await page.evaluate(() => document.fonts.ready);

    // 1. Snowfall Continuity During Active Drag (.is-moving === true) & Night Glow Smooth Fade-In / Contiguous Span / Smooth Fade-Out
    const glowAndSnowAudit = await page.evaluate(async () => {
      const shell = document.getElementById('app-shell');
      const canvas = document.getElementById('fx-canvas');
      if (!(shell instanceof HTMLElement) || !(canvas instanceof HTMLCanvasElement)) {
        throw new Error('Missing #app-shell or #fx-canvas');
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Missing 2D context on #fx-canvas');
      }

      const waitMs = (ms: number): Promise<void> =>
        new Promise((resolve) => {
          const start = performance.now();
          const step = (now: number): void => {
            if (now - start >= ms) {
              resolve();
            } else {
              requestAnimationFrame(step);
            }
          };
          requestAnimationFrame(step);
        });

      const waitNextDrawFrame = (): Promise<void> =>
        new Promise((resolve) => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              resolve();
            });
          });
        });

      const captureUpperSnowAlpha = (): Uint8ClampedArray => {
        const halfH = Math.max(1, Math.floor(canvas.height * 0.48));
        const raw = ctx.getImageData(0, 0, canvas.width, halfH).data;
        const alphas = new Uint8ClampedArray(raw.length >> 2);
        for (let i = 3, outIdx = 0; i < raw.length; i += 4, outIdx++) {
          alphas[outIdx] = raw[i];
        }
        return alphas;
      };

      const measureWarmGlow = (): number => {
        const bandH = Math.min(canvas.height, Math.round(210 * (canvas.width / 390)));
        const startY = canvas.height - bandH;
        const data = ctx.getImageData(0, startY, canvas.width, bandH).data;
        let warmSum = 0;
        for (let i = 0; i < data.length; i += 4) {
          const warmExcess = data[i] - data[i + 2];
          if (warmExcess > 8 && data[i + 3] > 0) {
            warmSum += (warmExcess * data[i + 3]) / 255;
          }
        }
        return warmSum;
      };

      const clickStorySlot = (dayIdx: number): void => {
        const slot = document.querySelector<HTMLElement>(`.story-slot[data-day="${dayIdx}"]`);
        if (!slot) throw new Error(`Missing story slot ${dayIdx}`);
        const rect = slot.getBoundingClientRect();
        const cx = rect.left + rect.width * 0.5;
        const cy = rect.top + rect.height * 0.5;
        slot.dispatchEvent(
          new PointerEvent('pointerdown', {
            bubbles: true,
            button: 0,
            clientX: cx,
            clientY: cy,
            pointerId: 950 + dayIdx
          })
        );
        slot.dispatchEvent(
          new PointerEvent('pointerup', {
            bubbles: true,
            button: 0,
            clientX: cx,
            clientY: cy,
            pointerId: 950 + dayIdx
          })
        );
      };

      await waitMs(60);
      const day8BaselineGlow = measureWarmGlow();

      // A. Active horizontal drag on Day 8: verify #app-shell.is-moving is true AND snow pixels actively move!
      shell.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          button: 0,
          clientX: 300,
          clientY: 420,
          pointerId: 801
        })
      );
      shell.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          clientX: 272,
          clientY: 420,
          pointerId: 801
        })
      );
      await waitNextDrawFrame();
      const isMovingAtDragStart = shell.classList.contains('is-moving');
      const snowSnapA = captureUpperSnowAlpha();

      await waitMs(85);
      shell.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          clientX: 262,
          clientY: 420,
          pointerId: 801
        })
      );
      await waitNextDrawFrame();
      const isMovingAtDragEnd = shell.classList.contains('is-moving');
      const snowSnapB = captureUpperSnowAlpha();

      let dragSnowAlphaDiff = 0;
      for (let i = 0; i < snowSnapA.length; i++) {
        dragSnowAlphaDiff += Math.abs(snowSnapA[i] - snowSnapB[i]);
      }

      // Release drag to flick into Day 9 (dx = -70px -> Day 8 -> Day 9)
      shell.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          clientX: 215,
          clientY: 420,
          pointerId: 801
        })
      );
      shell.dispatchEvent(
        new PointerEvent('pointerup', {
          bubbles: true,
          button: 0,
          clientX: 215,
          clientY: 420,
          pointerId: 801
        })
      );

      // B. Night Glow Smooth Fade-In (Day 8 -> Day 9)
      await waitNextDrawFrame();
      const initialFadeInGlow = measureWarmGlow();
      await waitMs(110);
      const midFadeInGlow = measureWarmGlow();
      await waitMs(750);
      const steadyDay9Glow = measureWarmGlow();

      // C. Contiguous Nocturnal Span (Day 9 <-> Day 10 at midpoint dayFloat ~ 8.5): zero 50% dip!
      const preSpanDay9Glow = measureWarmGlow();
      shell.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          button: 0,
          clientX: 300,
          clientY: 420,
          pointerId: 802
        })
      );
      shell.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          clientX: 105,
          clientY: 420,
          pointerId: 802
        })
      );
      await waitNextDrawFrame();
      const midpoint85Glow = measureWarmGlow();
      shell.dispatchEvent(
        new PointerEvent('pointerup', {
          bubbles: true,
          button: 0,
          clientX: 105,
          clientY: 420,
          pointerId: 802
        })
      );
      await waitMs(250);

      // Return to Day 9 steady state, then flick out Day 9 -> Day 8 and verify smooth dissolve
      clickStorySlot(8);
      await waitMs(200);
      const preFlickOutGlow = measureWarmGlow();
      shell.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          button: 0,
          clientX: 100,
          clientY: 420,
          pointerId: 803
        })
      );
      await waitMs(20);
      shell.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          clientX: 190,
          clientY: 420,
          pointerId: 803
        })
      );
      shell.dispatchEvent(
        new PointerEvent('pointerup', {
          bubbles: true,
          button: 0,
          clientX: 190,
          clientY: 420,
          pointerId: 803
        })
      );
      await waitMs(90);
      const flickOut90msGlow = measureWarmGlow();
      await waitMs(290);
      const flickOut380msGlow = measureWarmGlow();
      await waitMs(850);
      const flickOutFinalGlow = measureWarmGlow();

      // D. Story Bar Instant Jump (Day 9 -> Day 1): smooth temporal fade-out even on 0ms jump!
      clickStorySlot(8);
      await waitMs(850);
      const preJumpDay9Glow = measureWarmGlow();

      clickStorySlot(0);
      const isSettledImmediatelyOnJump = !shell.classList.contains('is-moving');
      await waitMs(90);
      const jumpOut90msGlow = measureWarmGlow();
      await waitMs(270);
      const jumpOut360msGlow = measureWarmGlow();
      await waitMs(850);
      const jumpOutFinalGlow = measureWarmGlow();

      return {
        day8BaselineGlow,
        isMovingAtDragStart,
        isMovingAtDragEnd,
        dragSnowAlphaDiff,
        initialFadeInGlow,
        midFadeInGlow,
        steadyDay9Glow,
        preSpanDay9Glow,
        midpoint85Glow,
        preFlickOutGlow,
        flickOut90msGlow,
        flickOut380msGlow,
        flickOutFinalGlow,
        preJumpDay9Glow,
        isSettledImmediatelyOnJump,
        jumpOut90msGlow,
        jumpOut360msGlow,
        jumpOutFinalGlow
      };
    });

    expect(glowAndSnowAudit.day8BaselineGlow).toBe(0);
    expect(glowAndSnowAudit.isMovingAtDragStart).toBe(true);
    expect(glowAndSnowAudit.isMovingAtDragEnd).toBe(true);
    expect(glowAndSnowAudit.dragSnowAlphaDiff).toBeGreaterThan(2000);

    expect(glowAndSnowAudit.steadyDay9Glow).toBeGreaterThan(500);
    expect(glowAndSnowAudit.initialFadeInGlow).toBeLessThan(glowAndSnowAudit.steadyDay9Glow * 0.45);
    expect(glowAndSnowAudit.midFadeInGlow).toBeGreaterThan(glowAndSnowAudit.initialFadeInGlow);
    expect(glowAndSnowAudit.midFadeInGlow).toBeLessThan(glowAndSnowAudit.steadyDay9Glow);

    expect(glowAndSnowAudit.midpoint85Glow).toBeGreaterThan(
      glowAndSnowAudit.preSpanDay9Glow * 0.75
    );

    expect(glowAndSnowAudit.flickOut90msGlow).toBeGreaterThan(
      glowAndSnowAudit.preFlickOutGlow * 0.15
    );
    expect(glowAndSnowAudit.flickOut380msGlow).toBeGreaterThan(0);
    expect(glowAndSnowAudit.flickOut380msGlow).toBeLessThan(glowAndSnowAudit.flickOut90msGlow);
    expect(glowAndSnowAudit.flickOut380msGlow).toBeLessThan(
      glowAndSnowAudit.preFlickOutGlow * 0.75
    );
    expect(glowAndSnowAudit.flickOutFinalGlow).toBe(0);

    expect(glowAndSnowAudit.isSettledImmediatelyOnJump).toBe(true);
    expect(glowAndSnowAudit.jumpOut90msGlow).toBeGreaterThan(
      glowAndSnowAudit.preJumpDay9Glow * 0.2
    );
    expect(glowAndSnowAudit.jumpOut360msGlow).toBeGreaterThan(0);
    expect(glowAndSnowAudit.jumpOut360msGlow).toBeLessThan(glowAndSnowAudit.jumpOut90msGlow);
    expect(glowAndSnowAudit.jumpOut360msGlow).toBeLessThan(glowAndSnowAudit.preJumpDay9Glow * 0.72);
    expect(glowAndSnowAudit.jumpOutFinalGlow).toBe(0);

    // 2. Onsen Steam Smooth Fade-In, Contiguous Span (Day 6 <-> Day 7), & Smooth Fade-Out (Day 5 -> 6 -> 7 -> 8)
    await page.goto('/?fx=live#day-5');
    await page.evaluate(() => document.fonts.ready);

    const steamAudit = await page.evaluate(async () => {
      const shell = document.getElementById('app-shell');
      const canvas = document.getElementById('fx-canvas');
      if (!(shell instanceof HTMLElement) || !(canvas instanceof HTMLCanvasElement)) {
        throw new Error('Missing #app-shell or #fx-canvas');
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Missing 2D context on #fx-canvas');
      }

      const waitMs = (ms: number): Promise<void> =>
        new Promise((resolve) => {
          const start = performance.now();
          const step = (now: number): void => {
            if (now - start >= ms) {
              resolve();
            } else {
              requestAnimationFrame(step);
            }
          };
          requestAnimationFrame(step);
        });

      const waitNextDrawFrame = (): Promise<void> =>
        new Promise((resolve) => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              resolve();
            });
          });
        });

      const measureSteamPlumeAlpha = (): number => {
        const dprScale = canvas.width / 390;
        const x0 = Math.round(canvas.width * 0.66);
        const w = Math.round(canvas.width * 0.3);
        const y0 = Math.max(0, canvas.height - Math.round(185 * dprScale));
        const h = Math.max(1, canvas.height - Math.round(12 * dprScale) - y0);
        const data = ctx.getImageData(x0, y0, w, h).data;
        let alphaSum = 0;
        for (let i = 3; i < data.length; i += 4) {
          alphaSum += data[i] / 255;
        }
        return alphaSum;
      };

      const clickStorySlot = (dayIdx: number): void => {
        const slot = document.querySelector<HTMLElement>(`.story-slot[data-day="${dayIdx}"]`);
        if (!slot) throw new Error(`Missing story slot ${dayIdx}`);
        const rect = slot.getBoundingClientRect();
        const cx = rect.left + rect.width * 0.5;
        const cy = rect.top + rect.height * 0.5;
        slot.dispatchEvent(
          new PointerEvent('pointerdown', {
            bubbles: true,
            button: 0,
            clientX: cx,
            clientY: cy,
            pointerId: 950 + dayIdx
          })
        );
        slot.dispatchEvent(
          new PointerEvent('pointerup', {
            bubbles: true,
            button: 0,
            clientX: cx,
            clientY: cy,
            pointerId: 950 + dayIdx
          })
        );
      };

      await waitMs(60);
      const day5SnowBaseline = measureSteamPlumeAlpha();

      // Jump Day 5 -> Day 6: smooth steam fade-in from 0 -> 1
      clickStorySlot(5);
      await waitNextDrawFrame();
      const initialSteam = measureSteamPlumeAlpha();
      await waitMs(180);
      const midSteam = measureSteamPlumeAlpha();
      await waitMs(700);
      const steadyDay6Steam = measureSteamPlumeAlpha();

      // Contiguous Onsen Span (Day 6 <-> Day 7 at midpoint dayFloat ~ 5.5): zero 50% dip!
      const preSpanDay6Steam = measureSteamPlumeAlpha();
      shell.dispatchEvent(
        new PointerEvent('pointerdown', {
          bubbles: true,
          button: 0,
          clientX: 300,
          clientY: 420,
          pointerId: 901
        })
      );
      shell.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          clientX: 105,
          clientY: 420,
          pointerId: 901
        })
      );
      await waitNextDrawFrame();
      const midpoint55Steam = measureSteamPlumeAlpha();
      shell.dispatchEvent(
        new PointerEvent('pointerup', {
          bubbles: true,
          button: 0,
          clientX: 105,
          clientY: 420,
          pointerId: 901
        })
      );
      await waitMs(300);

      // Jump/flick out Day 7 -> Day 8: wisps keep rising while smoothly dissolving back to snow-only baseline!
      const preExitDay7Steam = measureSteamPlumeAlpha();
      clickStorySlot(7);
      await waitMs(70);
      const exit70msSteam = measureSteamPlumeAlpha();
      await waitMs(220);
      const exit290msSteam = measureSteamPlumeAlpha();
      await waitMs(900);
      const exitFinalDay8Steam = measureSteamPlumeAlpha();

      return {
        day5SnowBaseline,
        initialSteam,
        midSteam,
        steadyDay6Steam,
        preSpanDay6Steam,
        midpoint55Steam,
        preExitDay7Steam,
        exit70msSteam,
        exit290msSteam,
        exitFinalDay8Steam
      };
    });

    expect(steamAudit.day5SnowBaseline).toBeLessThan(250);
    expect(steamAudit.steadyDay6Steam).toBeGreaterThan(steamAudit.day5SnowBaseline + 1500);
    expect(steamAudit.initialSteam - steamAudit.day5SnowBaseline).toBeLessThan(
      (steamAudit.steadyDay6Steam - steamAudit.day5SnowBaseline) * 0.45
    );
    expect(steamAudit.midSteam).toBeGreaterThan(steamAudit.initialSteam);
    expect(steamAudit.midSteam).toBeLessThan(steamAudit.steadyDay6Steam);

    expect(steamAudit.midpoint55Steam).toBeGreaterThan(steamAudit.preSpanDay6Steam * 0.75);

    expect(steamAudit.exit70msSteam).toBeGreaterThan(
      steamAudit.day5SnowBaseline +
        (steamAudit.preExitDay7Steam - steamAudit.day5SnowBaseline) * 0.2
    );
    expect(steamAudit.exit70msSteam).toBeLessThan(steamAudit.preExitDay7Steam * 0.95);
    expect(steamAudit.exit290msSteam).toBeGreaterThan(steamAudit.day5SnowBaseline);
    expect(steamAudit.exit290msSteam).toBeLessThan(steamAudit.exit70msSteam);
    expect(steamAudit.exitFinalDay8Steam).toBeLessThan(250);

    expect(errors).toEqual([]);
  });
});
