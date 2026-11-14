# How to run Opro HRMS

## What you need

| Tool | Version |
|---|---|
| Node.js | 26 LTS (Angular 22 needs 24.15 or newer) |
| npm | 11 or newer |
| Google Chrome | Any recent version, used by the Playwright tests |
| Java | 21 or newer, once the Spring backend exists |

## Folder structure

```
HRMS/
  CLAUDE.md                Requirements and coding rules. Read this first.
  HOW-TO-RUN.md            This file.
  frontend/                Angular 22 app
    src/
      index.html           Page shell, carries the noindex tag
      styles.css           Tailwind entry, self hosted fonts and design tokens (palette, light and dark)
      main.ts              Boots the app
      app/
        app.routes.ts      Every route, with the sign in and manager guards
        core/              Session, guards, theme, config (footer details, expiry warning days), company API
          layout/          Shell, top bar with view switch, notifications and account menus, side rail and tab bar, footer
        shared/ui/         Card, status pill, avatar, icon, dialog, field error
        shared/utils/      Date and time in Maldives time, expiry status, preferences, safe resource reads
        models/            Types that mirror the API responses
        features/
          login/           Test sign in (pick any employee)
          dashboard/       Home: today, leave left, needs your attention, coming up, from HR
          leave/           Balances, apply form with day count preview, requests with cancel
          attendance/      Month view of punches, summary, punch fix form and list
          holidays/ team/  API services so far, pages come next
          not-built/       Temporary page for routes not built yet
      testing/             Test helpers, fixtures and setup.ts (a dialog shim, since jsdom has none). Never shipped
    public/                Static files served as is (favicon, robots.txt)
    e2e/                   Playwright tests
    dev-server/            Mock API that stands in for Spring
      server.mjs           Routes, sessions, XSRF check. Node built ins only
      attendance.mjs       Generates the last 62 days of punches relative to today
      data/                JSON fixtures: employees, visas, leave, holidays, corrections, announcements, notifications
    proxy.conf.mjs         Sends /api to the mock or to Spring
    playwright.config.ts   Starts the mock and the app, then runs e2e tests in Chrome
    eslint.config.js       Lint rules
    .postcssrc.json        Plugs Tailwind into the Angular build
  backend/                 Spring Boot, not started yet
```

## First time setup

```bash
cd frontend
npm install
```

npm 11 blocks install scripts by default. Leave them blocked: the Angular build and tests work without them.

## Run the app

Two terminals, both inside `frontend/`. (Or in the Claude desktop app, the `mock-api` and `frontend` entries in `.claude/launch.json` start the same two servers.)

```bash
npm run mock
```

```bash
npm start
```

Open `http://localhost:4200`. Calls to `/api` are proxied to the mock on port 4300.

Everything you change (approving leave, applying, cancelling, asking for punch fixes) is kept in memory and resets when you restart the mock. Leave balances in the mock never move, because counting days is the backend's job.

### Against the real backend

```bash
USE_MOCK_BACKEND=false npm start
```

That sends `/api` to Spring on `http://localhost:8080` instead. Nothing else changes.

## Scripts (inside `frontend/`)

| Script | What it does |
|---|---|
| `npm start` | Dev server on port 4200 |
| `npm run mock` | Mock API on port 4300 |
| `npm run build` | Production build into `dist/` |
| `npm run lint` / `lint:fix` | ESLint for TypeScript and templates |
| `npm run check:type` | Type checks app code, templates, unit tests and e2e tests |
| `npm run test:unit` / `test:unit:watch` | Vitest |
| `npm run test:coverage` | Vitest with coverage. Fails under 80% |
| `npm run test:e2e` | Playwright. Starts its own fresh mock on 4310 and app on 4210, so it never clashes with your dev servers or their state |
| `npm run check` | Lint, types, coverage and e2e in one go |

In CI, run `npx playwright install chromium` and drop `channel: 'chrome'` from `playwright.config.ts`, since CI machines won't have Chrome installed.

## Test users

| Employee | Role | Good for testing |
|---|---|---|
| Ibrahim Rasheed (OPR-0004) | Manager | Team view, approvals, visa alerts for the team |
| Hassan Waheed (OPR-0001) | Manager | Approving Ibrahim's leave |
| Kasun Perera (OPR-0018) | Employee | Visa expiring soon |
| Rahim Uddin (OPR-0021) | Employee | Visa already expired, pending correction |
| Grace Mendoza (OPR-0027) | Employee | Passport expiring soon, rejected leave |
| Mariyam Nisha (OPR-0011) | Employee | Maldivian, no visa section |

## Environment variables

| Variable | Default | Meaning |
|---|---|---|
| `USE_MOCK_BACKEND` | `true` | `true` sends `/api` to the mock, `false` sends it to Spring on 8080 |
| `MOCK_PORT` | `4300` | Port for the mock API |

## Version notes

TypeScript is held at 6.0.3 because Angular 22 only supports `>=6.0 <6.1`. TypeScript 7 is out but Angular doesn't support it yet.
