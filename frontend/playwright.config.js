/**
 * @file Configuración Playwright para tests E2E + visual regression.
 *
 * - Arranca el dev server de Vite automáticamente antes de los tests
 *   (`webServer.command`) y lo mata al terminar.
 * - 3 proyectos: desktop (1280x800), tablet (820x1180), mobile (390x844).
 *   Los tests indican target con `test.use({ ...devices['iPhone 12'] })` o
 *   se ejecutan en los 3 sucesivamente.
 * - Visual snapshots: `expect(page).toHaveScreenshot()` genera baseline en
 *   `tests-e2e/__screenshots__/<test>-<browser>-<platform>.png`. Diferencias
 *   ≥0.2% pixels fallan el test y guardan PR-diff.
 *
 * @see https://playwright.dev/docs/test-configuration
 */

import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.PORT || 5173;
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests-e2e',
  // Snapshots en mismo directorio que cada test
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{projectName}/{arg}{ext}',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['html'], ['github']] : 'list',

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // Animaciones congeladas para snapshots reproducibles
    actionTimeout: 10_000,
  },

  expect: {
    // Tolerancia píxel — Playwright recommends ~0.2 for cross-platform
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      animations: 'disabled',
      caret: 'hide',
    },
  },

  projects: [
    {
      name: 'desktop-chrome',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1366, height: 800 },
      },
    },
    {
      name: 'mobile-iphone12',
      use: {
        // iPhone 12 viewport (390×844) + userAgent — pero forzamos engine
        // chromium para no requerir instalar WebKit aparte (CI sólo trae
        // chromium para reducir setup en self-hosted runner).
        ...devices['iPhone 12'],
        browserName: 'chromium',
        defaultBrowserType: 'chromium',
      },
    },
  ],

  // Arranca Vite dev en background; reusa si ya está corriendo en local.
  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
