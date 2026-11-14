import { defineConfig } from '@playwright/test';

// Separate ports so every run gets a fresh mock, untouched by whatever you did in the dev server.
const MOCK_PORT = 4310;
const APP_PORT = 4210;
const APP_URL = `http://localhost:${APP_PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  use: { baseURL: APP_URL, channel: 'chrome', trace: 'on-first-retry' },
  webServer: [
    { command: `MOCK_PORT=${MOCK_PORT} npm run mock`, url: `http://localhost:${MOCK_PORT}/api/session/users` },
    { command: `MOCK_PORT=${MOCK_PORT} npm start -- --port ${APP_PORT}`, url: APP_URL },
  ],
});
