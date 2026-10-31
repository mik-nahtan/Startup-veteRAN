import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    },
  },
  webServer: {
    command: 'npm start',
    url: 'http://127.0.0.1:4173/api/health',
    reuseExistingServer: false,
    env: { PORT: '4173', DATABASE_PATH: '/tmp/veteran-e2e.sqlite', ADMIN_TOKEN: 'e2e-organizer-token-32-characters' },
  },
});
