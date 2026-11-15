import { defineConfig } from '@playwright/test';

// Separate ports so every run gets a fresh backend, untouched by whatever you did in the dev servers.
// E2E_BACKEND=spring runs the same journeys against Spring on a throwaway database instead of the mock.
const IS_SPRING = process.env['E2E_BACKEND'] === 'spring';
const MOCK_PORT = 4310;
const SPRING_PORT = 8090;
const SPRING_WORKERS = 3;
const APP_PORT = IS_SPRING ? 4220 : 4210;
const APP_URL = `http://localhost:${APP_PORT}`;
const IS_CI = !!process.env['CI'];

const backend = IS_SPRING
  ? {
      command: `cd ../backend && ./mvnw -q spring-boot:test-run -Dspring-boot.run.profiles=dev -Dspring-boot.run.arguments=--server.port=${SPRING_PORT}`,
      url: `http://localhost:${SPRING_PORT}/api/session/users`,
      // Compiling, then starting PostgreSQL in Docker, takes a while.
      timeout: 240_000,
    }
  : { command: `MOCK_PORT=${MOCK_PORT} npm run mock`, url: `http://localhost:${MOCK_PORT}/api/session/users` };
const proxyTarget = IS_SPRING ? `USE_MOCK_BACKEND=false SPRING_PORT=${SPRING_PORT}` : `MOCK_PORT=${MOCK_PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // Spring, the app build and every Chrome worker compete for the CPU. Fewer workers stop Chrome timing out on start.
  workers: IS_SPRING ? SPRING_WORKERS : undefined,
  forbidOnly: IS_CI,
  // CI machines have Playwright's own Chromium, not Chrome.
  use: { baseURL: APP_URL, channel: IS_CI ? undefined : 'chrome', trace: 'on-first-retry' },
  webServer: [backend, { command: `${proxyTarget} npm start -- --port ${APP_PORT}`, url: APP_URL }],
});
