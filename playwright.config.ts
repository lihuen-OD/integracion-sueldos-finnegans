import { defineConfig, devices } from '@playwright/test';

export const E2E_ORIGIN = 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: 0,
  reporter: [['list']],
  // Sin trazas, capturas ni videos: nunca deben quedar datos en artefactos de prueba.
  use: {
    baseURL: E2E_ORIGIN,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
    acceptDownloads: true,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Siempre contra el build de producción (con CSP), servido localmente.
  webServer: {
    command: 'npm run build && npm run preview',
    url: E2E_ORIGIN,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
