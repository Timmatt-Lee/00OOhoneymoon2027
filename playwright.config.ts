import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: '/tmp/honeymoon2027-playwright-results',
  snapshotPathTemplate: '{testDir}/../screenshots/{arg}{ext}',
  forbidOnly: Boolean(process.env.CI),
  timeout: 30000,
  expect: {
    toHaveScreenshot: {
      // Strict 0.5% pixel tolerance on baseline macOS; 8% cross-OS tolerance for Linux FreeType vs CoreText CJK rasterization
      maxDiffPixelRatio: process.platform === 'darwin' ? 0.005 : 0.08
    }
  },
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    trace: 'retain-on-failure'
  },
  webServer: {
    command: 'npm run preview -- --port 4173',
    port: 4173,
    reuseExistingServer: !process.env.CI
  }
});
