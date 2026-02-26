import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60 * 1000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['line'], ['github'], ['html', { open: 'never' }]] : [['list'], ['html']],
  use: {
    baseURL: 'http://127.0.0.1:4010',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1366, height: 900 }
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: {
    command: 'node tests/e2e/run-e2e-stack.js',
    url: 'http://127.0.0.1:4010',
    timeout: 420 * 1000,
    reuseExistingServer: false
  }
});
