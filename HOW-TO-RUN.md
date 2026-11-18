# How to run Opro HRMS

## What you need

| Tool | Version |
|---|---|
| Node.js | 26 LTS (Angular 22 needs 24.15 or newer) |
| npm | 11 or newer |
| Google Chrome | Any recent version, used by the Playwright tests |
| Java | 25 (LTS), Eclipse Temurin: `brew install --cask temurin@25` |
| Docker Desktop | Runs PostgreSQL for development and a throwaway one for backend tests |

## Folder structure

```
HRMS/
  CLAUDE.md                Requirements and coding rules. Read this first.
  HOW-TO-RUN.md            This file.
  TODO.md                  What's left before launch and what's waiting on information
  netlify.toml             The Netlify demo: the frontend with the mock as a function
  .github/workflows/ci.yml GitHub Actions: backend build, frontend checks, and e2e on the mock and on Spring
  design/figma-make/       App.tsx and index.css copied from the Figma Make file. The design to match, not built
  frontend/                Angular 22 app
    src/
      index.html           Page shell, carries the noindex tag
      styles.css           Tailwind, self hosted fonts (DM Sans, Manrope), tokens, and our additions to the design
      styles/portal.css    The Figma stylesheet, ported as is
      styles/dark.css      Generated dark theme. Never edit by hand
      main.ts              Boots the app
      app/
        app.routes.ts      Every route, with the sign in, HOD, HR and super admin guards
        core/              Session, guards, config (company details, shift length, expiry warning days), company API, an interceptor that refreshes nav counts after a save
          layout/          Shell, navy sidebar (a slide in menu on phones), top bar with search, view switch, notifications and profile menu, footer
        shared/ui/         Logo, Lucide icons, status pill, avatar, welcome banner, ring, modal dialog, success screen, month picker, list skeleton
        shared/utils/      Date and time in Maldives time, expiry status, initials, CSV export, preferences, safe resource reads
        models/            Types that mirror the API responses
        features/
          login/           Test sign in (pick any employee)
          dashboard/       Overview: welcome banner, today's attendance, leave balance, visa, recent attendance, staff card, next holiday, latest request
          documents/       Documents page: status, download, and uploading the ones employees send. Its upload form also serves HR
          leave/           Balance rings, request history with cancel, request modal with day count preview
          attendance/      Summary cards, attendance log, punch in and out, punch fixes, CSV export
          calendar/        Company calendar: holidays, events, and who is away for HODs and super admins
          holidays/        API for holidays and company events
          profile/         Two sided printable ID card, visa and work permit status, change request to HR
          flights/         Flight allowance: the profile card, claim form, and the summary HR's pages share, with a USD, MVR or INR switch
          team/            HOD pages: overview, people directory, leave requests with tabs, team attendance table, one person's page. People, attendance, leave requests, the person page and the calendar also serve the super admin's company view (/company), and People serves HR
          hr/              HR pages: overview, one person (leave days, adjust balance, visa, documents, photo, leaving, flight allowance), add and edit a person, holiday calendar, visas, inbox with documents to check, announcements, policies with the work schedule, document list and exchange rates. HR decides no leave or punch fixes
            forms/         The HR dialogs' forms
      testing/             Test helpers, fixtures and setup.ts (a dialog shim, since jsdom has none). Never shipped
    public/                Static files served as is (favicon, robots.txt)
    e2e/                   Playwright tests
    netlify/functions/     The Netlify demo's function, wrapping the mock
    dev-server/            Mock API that stands in for Spring
      server.mjs           Routes, sessions, XSRF check. Node built ins only
      attendance.mjs       Generates the last 62 days of punches relative to today, and works a day out again after an approved punch fix, using the schedule in force
      data/                JSON fixtures: employees, visas, leave, flight allowances and claims, exchange rates, holidays, events, corrections, announcements, notifications, change requests, balance adjustments, work schedules, document types, records (insurance, bank details, education, experience, expatriate quota). Uploaded files stay in memory until restart
    proxy.conf.mjs         Sends /api to the mock or to Spring
    scripts/
      build-dark-theme.mjs Writes src/styles/dark.css from portal.css and styles.css (see theme:dark)
    playwright.config.ts   Starts a fresh backend (the mock, or Spring with E2E_BACKEND=spring) and the app, then runs e2e tests in Chrome
    eslint.config.js       Lint rules
    .postcssrc.json        Plugs Tailwind into the Angular build
  backend/                 Spring Boot 4.1 API on Java 25. Maven, with its own wrapper (mvnw)
    compose.yaml           PostgreSQL 18.7 for development
    pom.xml                Dependencies, pinned by Spring Boot's own version list
    src/main/java/mv/opro/hrms/
      employee/            Employees and visas, and roles worked out from reporting lines
      holiday/             The holiday calendar, used by attendance and leave, and CalendarEditor for HR's changes
      attendance/          Punches, PunchClock (punching from the office or home), home days, days worked out by DayCalculator, punch fix requests, the dev punch seeder, HR's ScheduleEditor, compensatory off claims (CompOffs)
      leave/               Leave types HR manages, balances with carry forward, years that open by themselves, applying, cancelling and deciding, the working day count, HR's balance adjustments and per person days
      flight/              Flight allowances in USD, claims with receipts, and HR's exchange rates
      notification/        The notifications panel, and the service every feature uses to tell people things, and VisaReminders
      team/                The HOD's view (/api/team) and the super admin's company view (/api/company), one set of endpoints: TeamAccess limits an HOD to their own active direct reports and lets only super admins reach everyone
      files/               Stored files (in PostgreSQL for now), upload checks, and serving them safely
      document/            Document types HR keeps, everyone's copies, uploads and HR's checks (Documents service)
      insight/             The facts behind the executive dashboard and reports, for HR and super admins (/api/insights)
      record/              Medical insurance, bank details (entered by the person, verified by HR), education and work experience (Records service)
      announcement/        Notes from HR on everyone's overview, and AnnouncementEditor for posting them
      profile/             Change requests people send to HR from their profile, and HR's inbox of them
      hr/                  HR only endpoints, behind HrAccess: people, leave balances and policy, calendar, schedules, inbox, announcements, photos, flight allowances, documents
      session/             Who is signed in, /api/me, and the dev only pick a user sign in
      security/            Session cookie, XSRF check, JSON errors instead of redirects
      common/              Error shape ({"message": ...}) shared by every endpoint
      config/              The Maldives time clock
    src/main/resources/
      application.yml      Settings for every environment. The database comes from DB_URL, DB_USER, DB_PASSWORD
      application.yml      Also holds the work location pins for office punches (opro.punch.offices), placeholders until confirmed
      application-dev.yml  Local database, the dev sign in, and generated punches (opro.dev.generate-punches)
      db/migration/        Flyway migrations, the schema
      db/dev/              Development seed data, the same people as the mock. Never loaded outside dev
    src/test/java/         Integration tests: a real server against a throwaway PostgreSQL (Testcontainers)
      TestHrmsBackendApplication.java  Spring on a throwaway PostgreSQL, used by the Spring e2e run
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

Start the database and Spring, from `backend/`:

```bash
docker compose up -d
```

```bash
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
```

Then the frontend, from `frontend/`:

```bash
USE_MOCK_BACKEND=false npm start
```

That sends `/api` to Spring on `http://localhost:8080` instead. Nothing else changes. Every page works end to end on Spring, the HR view included.

Unlike the mock, Spring keeps what you do in the database. To start again from the seed data, run this inside `backend/` (it removes only the `opro-hrms` project's volume):

```bash
docker compose down -v && docker compose up -d
```

To see a working day on a weekend, pin Spring's clock the way `MOCK_NOW` pins the mock's: add `-Dspring-boot.run.jvmArguments="-Dopro.fixed-time=2026-11-12T10:30:00+05:00"`.

### Backend tests (inside `backend/`)

```bash
./mvnw verify
```

Needs Docker Desktop running: each run starts its own PostgreSQL and throws it away afterwards.

### API documentation

With Spring running on the dev profile, open http://localhost:8080/swagger-ui.html to browse every endpoint, grouped by feature, with request and response shapes, and try them out. The raw OpenAPI spec is at http://localhost:8080/v3/api-docs. Its front page explains sign in, the XSRF header, errors, uploads and roles. It's built from the controllers by springdoc, so it can't drift from the code, and it's switched off outside the dev profile.

## Netlify demo

`netlify.toml` at the repo root deploys the frontend to Netlify with the mock answering `/api` as a function (`frontend/netlify/functions/mock-api.mjs`). Spring and PostgreSQL can't run on Netlify.

1. On Netlify: Add new site, Import an existing project, GitHub, then pick the Opro HRMS repository.
2. Leave the build settings alone: they come from `netlify.toml` (base `frontend`, `npm run build`, publish `dist/opro-hrms/browser`).
3. Deploy. Sign in with the same pick a user screen as in development.

Things to know:
- Everyone in it is made up, and anyone with the link can sign in as anyone. Put it behind Netlify's site password if it shouldn't be open.
- Changes (leave, punches, uploads) live in the function's memory and reset whenever Netlify starts a fresh copy. Sessions survive that, because in the demo the session cookie names who signed in.
- Office punches need a real location near the placeholder pins, so try "From home" there.

## Scripts (inside `frontend/`)

| Script | What it does |
|---|---|
| `npm start` | Dev server on port 4200 |
| `npm run mock` | Mock API on port 4300 |
| `npm run build` | Production build into `dist/` |
| `npm run lint` / `lint:fix` | ESLint for TypeScript and templates |
| `npm run theme:dark` | Regenerates the dark theme after changing colours in `portal.css` or `styles.css`, and lists any text under 4.5:1 contrast |
| `npm run theme:check` | Fails if `dark.css` is out of date. Part of `npm run check` |
| `npm run check:type` | Type checks app code, templates, unit tests and e2e tests |
| `npm run test:unit` / `test:unit:watch` | Vitest |
| `npm run test:coverage` | Vitest with coverage. Fails under 80% |
| `npm run test:e2e` | Playwright. Starts its own fresh mock on 4310 and app on 4210, so it never clashes with your dev servers or their state |
| `npm run test:e2e:spring` | The same journeys against Spring on 8090, on a throwaway PostgreSQL, with the app on 4220. Needs Docker Desktop. The first run takes a minute or two to compile. It runs 3 Chrome workers so Spring and Chrome don't starve each other |
| `npm run check` | Dark theme freshness, lint, types, coverage and e2e in one go |

## CI

`.github/workflows/ci.yml` runs on every pull request and every push to `main`: `./mvnw verify`, then the dark theme check, lint, types and coverage, then the e2e journeys once on the mock and once on Spring. On CI, Playwright uses its own Chromium instead of Chrome.

## Punching in and out

Punching lives on the overview's today card and on the attendance page. "At the office" and "At a resort" ask the browser for its location, and Spring refuses it more than 300 m from a work location or 5 km from a resort. The pins in `backend/src/main/resources/application.yml` are placeholders. The mock only checks a location was sent. To try an office punch in a browser that has no real location, Chrome DevTools has a Sensors panel that sets one.

## Test users

Everyone has an Indian name. Sneha and Karan are Maldivian nationals, so they see no visa section; everyone else is Indian, with a visa.

| Employee | Role | Good for testing |
|---|---|---|
| Ananya Iyer (OPR-0002) | HR | HR view: everyone, holidays, visas, inbox, announcements, leave policy |
| Vikram Singh (OPR-0004) | HOD | Team view, approvals, visa alerts for the team |
| Rajesh Sharma (OPR-0001) | Super admin and HOD | The company view, stepping in on anyone's request, approving Vikram's and Ananya's leave, his own leave approved as he sends it |
| Arjun Reddy (OPR-0018) | Employee | Visa expiring soon, a $1,200 flight allowance with one flight approved, a contract ending in January, a full record (verified bank, insurance, education, a past job) |
| Rohit Verma (OPR-0021) | Employee | Visa already expired, pending correction |
| Kavya Menon (OPR-0027) | Employee | Passport expiring soon, rejected leave, probation ending in December |
| Sneha Kulkarni (OPR-0011) | Employee | Maldivian, no visa section, no flight allowance |
| Karan Mehta (OPR-0023) | Employee | Maldivian, no visa section |
| Priya Nair (OPR-0015) | Employee | A flight claim, counted against her allowance, and bank details waiting for HR |

## Environment variables

| Variable | Default | Meaning |
|---|---|---|
| `USE_MOCK_BACKEND` | `true` | `true` sends `/api` to the mock, `false` sends it to Spring |
| `MOCK_PORT` | `4300` | Port for the mock API |
| `SPRING_PORT` | `8080` | Port the proxy sends `/api` to when `USE_MOCK_BACKEND=false` |
| `E2E_BACKEND` | unset | `spring` runs the e2e journeys against Spring instead of the mock (`npm run test:e2e:spring` sets it) |
| `MOCK_NOW` | unset | Pins the mock's clock, for example `MOCK_NOW=2026-11-12T15:10:00+05:00 npm run mock`. Handy on weekends, when every screen shows days off |

## Version notes

The Excel export uses exceljs 4.4.0, its latest stable release (December 2024). It depends on an old `uuid` flagged by `npm audit` (GHSA-w5hq-g745-h8pq, a missing bounds check when a buffer is passed). exceljs only calls `uuid.v4()` without a buffer, and the browser loads exceljs's own pre-bundled copy, so the flagged code never runs and an override wouldn't change what ships. `angular.json` allows exceljs and the CommonJS pieces jspdf's optional SVG support pulls in (core-js, html2canvas, raf, rgbcolor), so the build stays free of warnings; all of them load only when someone exports. `angular.json` also keeps the build cache on in CI (`cli.cache.environment: all`): without it the dev server skips prebundling, exceljs arrives as CommonJS and the Excel export breaks in the e2e run.

TypeScript is held at 6.0.3 because Angular 22 only supports `>=6.0 <6.1`. TypeScript 7 is out but Angular doesn't support it yet.
