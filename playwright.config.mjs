import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  testMatch: /browser-smoke\.spec\.mjs/,
  timeout: 30000,
  expect: { timeout: 7000 },
  use: { browserName: 'chromium', viewport: { width: 390, height: 844 } },
  webServer: {
    command: 'node tests/local-server.mjs',
    port: 4173,
    reuseExistingServer: true,
    timeout: 10000,
  },
  reporter: 'line',
});
