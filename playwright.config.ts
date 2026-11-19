import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:18787/every-number-dot-com/', headless: true, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1050 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: { command: 'pnpm dev 18787 /every-number-dot-com/', url: 'http://127.0.0.1:18787/every-number-dot-com/', reuseExistingServer: false, timeout: 60000 },
});
