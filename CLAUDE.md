# Opro HRMS Project Instructions

> **Read this file in full before doing anything.**
> These rules apply to every response, every task, and every session.

Opro is a company based in the Maldives. This repo holds its HR portal: attendance (fed by a biometric device), leave, holidays, employee profiles with a virtual ID card, and visa tracking for expatriate staff.

| Part | Stack | Status |
|---|---|---|
| `frontend/` | Angular 22, Tailwind CSS v4, Vitest, Playwright | Every employee page built. Team view next |
| `frontend/dev-server/` | Plain Node mock API serving JSON fixtures | In progress |
| `backend/` | Java Spring Boot | Not started |

---

## AI Behaviour Rules

- **Always address the user as "Parnika"** at the very start of every response, before anything else.
- **Always ask clarifying questions** before starting any non-trivial implementation. Never assume intent. If a requirement is ambiguous, stop and ask.
- **Be brutally honest.** If a suggested approach is wrong, inefficient, or will cause future pain, say so directly and recommend the correct solution, even if it contradicts what was asked.
- **Minimal changes principle.** Make the smallest set of changes that correctly satisfies the requirement. Do not refactor unrelated code, rename files, or restructure folders unless explicitly asked.
- **Remove dead code after every iteration.** Scan all touched files for unused imports, variables, unreachable code, unused inputs/outputs and unused types. Remove them before declaring done.
- **Always ask before adding a new dependency.** State why it is needed, what it does, and whether a built-in alternative exists.
- **Always use the latest stable version of every dependency.** Verify the latest stable release on npm and pin it exactly (no `^` or `~`, except `@types/*` which may use `^`). Before starting any task, run `npm outdated` in `frontend/` and update stale packages. The only exception is a version a framework's peer range blocks (TypeScript is held to what Angular supports). Note those in `HOW-TO-RUN.md`.
- **Use the ponytail skill** to question every piece of code and write the minimum code that does the job.
- **Maintain `HOW-TO-RUN.md`** at the repo root: folder structure, what lives where, and how to run everything. Update it whenever any of that changes.
- **Reuse and extend existing components** before creating a near duplicate.
- **Prefer readability.** Keep comments short and only where genuinely needed.
- **Think about security on every change** and act on it.
- **Follow SOLID and good coding principles.**
- **Always leave the codebase clean.**
- **Write like a human.** No agentic jargon, no AI filler words, no dashes as punctuation in prose or UI copy (use commas or full stops instead).

---

## Product Requirements

### Roles

| Role | Who | Can do |
|---|---|---|
| Employee | Everyone | Own attendance, leave, holidays, profile, ID card, visa, notifications |
| Manager | People with direct reports | Everything an employee can, plus a **Team view** for their **direct reports only** |
| HR Admin | *Planned, not in v1* | Maintains holidays, visa records, leave policy, employee master data |

- A manager is also an employee. A **My view / Team view** switch sits in the header and is only rendered for managers. The last chosen view is remembered per browser.
- Until HR Admin exists, holidays, visa data and leave policy are read only and come from the backend (mock JSON for now).
- The UI hides what a role cannot use, but **the backend is the real gate**. Never rely on a route guard for security.

### Login

- Real login is decided when the backend is built (SSO is the likely target). Session lives in an **httpOnly, Secure, SameSite=Strict cookie** set by the server. No tokens in `localStorage` or `sessionStorage`, ever.
- The mock server offers a "pick a user" login screen so every role can be tested.
- Angular's built in XSRF support (`XSRF-TOKEN` cookie → `X-XSRF-TOKEN` header) is used for all mutations.

### Pages (v1)

**Employee view**

| Route | Contents |
|---|---|
| `/login` | Mock user picker (dev only) |
| `/` Dashboard | Today's punch status and hours so far, leave balance summary, next holidays, visa alert if expiring/expired, pending requests, latest announcements |
| `/attendance` | Month view of daily records: first in, last out, all punches, time worked, status. Month summary (present, late, absent, leave, hours). Raise a correction request for a missed or wrong punch, and see their status |
| `/leave` | Balances per leave type, apply for leave (full or half day), list of own requests with status, cancel a pending request or an approved one that has not started |
| `/holidays` | Year list of public holidays grouped by month, next one highlighted, one year either side. Islamic holidays are marked **tentative** until confirmed after moon sighting (the label drops once the date has passed) |
| `/profile` | Virtual ID card (printable), personal and job details, emergency contact, visa and work permit details, request a change to personal details |
| Notifications | Header panel, not a page: leave decisions, correction decisions, visa reminders, announcements |

**Team view (managers only)**

| Route | Contents |
|---|---|
| `/team` | Today at a glance for direct reports: in, late, not in yet, on leave. Visa alerts for the team |
| `/team/approvals` | Pending leave requests and attendance correction requests. Approve or reject with an optional note. History of past decisions |
| `/team/attendance` | Attendance for all direct reports, by day or month |
| `/team/calendar` | Who is out when, merged with public holidays |
| `/team/:employeeId` | One report's profile, leave balance, attendance and visa |

### Attendance rules (placeholders, confirm with HR)

| Rule | Value |
|---|---|
| Time zone | Maldives Time, UTC+5 (`Indian/Maldives`), single zone |
| Work week | Sunday to Thursday. Friday and Saturday off |
| Shift | 09:00 to 17:00 |
| Late | First punch after 09:15 (15 minute grace) |
| Half day | Less than 4 hours worked |
| Absent | No punch, no approved leave, not a holiday or weekend |
| Ramadan hours | 09:00 to 14:00 |
| Overtime | Minutes beyond the shift, shown only, no approval flow in v1 |

- The biometric device (model not yet known) pushes raw punches to the backend. A day may have **many punches** (breaks). The backend pairs them and works out first in, last out, time worked and status. **The frontend only displays these values. It never calculates attendance status.**

### Leave rules (placeholders, confirm with HR against the Maldives Employment Act)

| Type | Days per year |
|---|---|
| Annual | 30 |
| Sick | 30 (medical certificate needed beyond 2 consecutive days) |
| Family responsibility | 10 |
| Maternity | 60 |
| Paternity | 3 |
| Unpaid | No limit |

- Leave year follows the calendar year. Carry forward: none until HR confirms.
- Half days allowed (first half or second half).
- Weekends and public holidays inside a leave range do not count.
- The apply form only offers types the person has a balance for, plus types the policy marks `isUnlimited`. A missing balance never means "no cap".
- Sick leave longer than `documentRequiredAfterDays` shows a note to hand a medical certificate to HR. No upload in v1.
- Single level approval by the direct manager.
- Statuses: `pending`, `approved`, `rejected`, `cancelled`.
- The backend owns day counts and balances. The frontend may preview a count but the server's number wins.

### Visa and work permit

- Only expatriate staff have visa records. Maldivian nationals see "Not applicable" instead of an empty section.
- Fields: work permit number, visa number, passport (**last 4 digits only, the API never sends the full number**), passport expiry, visa issue date, visa expiry date.
- Status shown: **Valid**, **Expiring soon** (60 days or less), **Expired**. Passport expiry gets the same treatment.
- Managers see visa status for their reports. Visa reminders appear on the dashboard and in notifications.

### Virtual ID card

- Front: initials (photos come later), full name, designation, department, employee ID, blood group. Back: email, phone, work location, joining date, emergency contact, a return address.
- Both sides are sized in container units, so the same markup prints at real ID card size (85.6 × 54 mm). Printing uses `window.print()` and a print stylesheet that hides everything else. No PDF library, no QR code in v1.
- The card is the profile's only view of personal details. Changes go to HR through a request (`POST /api/profile/change-requests` with `field` and `details`).

### Footer

Company name, "Malé, Republic of Maldives", HR contact email, copyright year. **Address and email are placeholders** in `core/config.ts` until Parnika confirms them. Links to Leave policy, Privacy and Help get added once those pages exist.

### Non functional

- English only, but use CSS logical properties (`margin-inline-start`, not `margin-left`) so Dhivehi (right to left) can be added later without a rewrite.
- Fully responsive. Phones are a first class target, many staff will check punches and leave on mobile.
- Light and dark mode via `prefers-color-scheme`, with a manual toggle.
- WCAG 2.2 AA.
- **Not indexed by search engines.** `<meta name="robots" content="noindex, nofollow">` and a `robots.txt` that disallows everything. No Open Graph, no structured data, no SEO work. Each page still gets a clear `<title>` via the router's `title` property.

---

## Design & Creative Philosophy

> Think like a **senior product designer and senior engineer who happens to be a real human**. Every decision, every piece of copy, every interaction should feel crafted by someone with taste and years of experience.

This is a daily work tool. People open it to check a punch, apply for leave or approve a request, then leave. Calm, fast and obvious beats impressive.

### Human first mindset
- **Have opinions.** Commit to one direction and defend it.
- **Design with intention.** Every spacing value, colour and animation has a reason. "It's the default" is not one.
- **Sweat the details.** No 1px misalignments, no jank, no "close enough".
- **Challenge the brief** when a pattern is wrong for the context.

### Copy
- Banned words: "delve", "elevate", "leverage", "utilize", "streamline", "cutting edge", "seamless", "robust", "empower", "unlock", "reimagine", "holistic", "synergy", "game changer", "dive in", "let's explore", "in today's world", "it's worth noting", "at the end of the day".
- Be specific. "You've got 12 days of annual leave left" beats "Leave balance information".
- Microcopy has personality but stays respectful. Empty states, errors and confirmations are written, not defaulted.
- Use real quotation marks (" "), proper ellipses (…), no dashes as punctuation.

### Visual
- No gradient blob heroes, no generic stock illustration, no turquoise ocean postcard clichés just because the company is in the Maldives.
- Colours are curated, defined in `oklch()`, and live as design tokens in one place. Hover and active states come from `color-mix()`.
- Not everything symmetric. The dashboard uses a deliberate, uneven grid.
- Status colour is never the only signal. Always pair it with text or an icon.

### Typography
- Avoid "Inter for everything" and the generic geometric heading plus humanist body pairing.
- Hierarchy through weight, size, case, colour and spacing, not size alone.
- Times, dates and numbers use tabular figures so columns line up.

### Modern CSS to use where it earns its place
Container queries, subgrid, `:has()`, native nesting, `@scope`, `color-mix()`, `oklch()`, View Transitions (route changes, view switch), `linear()` spring easing, scroll driven animations used sparingly, layered shadows. Always respect `prefers-reduced-motion`. Design proper `:focus-visible` styles.

---

## Folder Structure

```
HRMS/
  CLAUDE.md
  HOW-TO-RUN.md
  frontend/
    src/app/
      core/            # App wide singletons: auth, layout shell (header, nav, footer), guards, interceptors, config
      shared/ui/       # Pure presentational pieces (button, badge, card, empty state, stat, avatar)
      shared/utils/    # Pure helper functions (dates, formatting)
      features/
        dashboard/
        attendance/
        leave/
        holidays/
        profile/       # ID card, personal details, visa
        team/          # Manager only screens
      models/          # Shared TypeScript types mirroring API responses
    public/            # Static assets, robots.txt
    src/testing/       # Test helpers and fixtures, never shipped
    e2e/               # Playwright tests
    dev-server/        # Mock API (frontend development only)
      server.mjs
      data/            # JSON fixtures
    proxy.conf.mjs     # Sends /api to the mock or to Spring
  backend/             # Spring Boot (later)
```

Unit tests sit next to the file they test (`leave-balance.ts` → `leave-balance.spec.ts`), which is the Angular convention.

---

## Architecture Rules

### API access

```
Browser → /api/... (same origin) → Angular dev proxy → mock server or Spring Boot
Production: browser → /api/... → Spring Boot (served behind the same domain)
```

- The browser only ever calls relative `/api/...` URLs. No backend host, key or secret exists in frontend code or `environment` files, since everything shipped to the browser is public.
- Spring Boot is the only layer between the browser and the data. Do not add a separate BFF.

### Mock server

- `frontend/dev-server/server.mjs` uses only Node built ins. It serves the JSON in `dev-server/data/` and keeps changes in memory until restart.
- **One toggle:** `USE_MOCK_BACKEND`. `true` (default) sends `/api` to the mock on port 4300. `false` sends it to Spring on port 8080. Nothing else changes.
- Never change a URL or add a branch in app code to support mocking. If the mock needs a code change, fix the mock.
- When a new endpoint is added, add its mock route and fixture in the same change. When the real backend changes a response shape, update the mock immediately.
- Keep the mock dumb: realistic fixtures, no business logic.

### API contract (v1)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/session/users` | Mock login picker (dev only) |
| POST | `/api/session/login` | Mock login, sets session cookie |
| POST | `/api/session/logout` | Clears session |
| GET | `/api/me` | Logged in employee profile, roles and visa (absent for nationals) |
| GET | `/api/attendance?month=YYYY-MM` | Own daily records |
| GET / POST | `/api/attendance/corrections` | Own correction requests / raise one |
| GET | `/api/leave/types` | Leave types from the policy. `isUnlimited` marks types with no balance, like unpaid |
| GET | `/api/leave/balances` | Own balances |
| GET / POST | `/api/leave/requests` | Own requests / apply |
| POST | `/api/leave/requests/:id/cancel` | Cancel own request |
| GET | `/api/holidays?year=YYYY` | Public holidays |
| POST | `/api/profile/change-requests` | Ask HR to change personal details |
| GET | `/api/announcements` | Company announcements |
| GET | `/api/notifications` | Own notifications |
| POST | `/api/notifications/read` | Mark all own notifications read |
| GET | `/api/team` | Direct reports with today's attendance and visa |
| GET | `/api/team/:id` | One report's profile, visa and leave balances |
| GET | `/api/team/attendance?month=YYYY-MM` | Reports' daily records |
| GET | `/api/team/leave-requests?status=` | Reports' leave requests |
| POST | `/api/team/leave-requests/:id/decision` | Approve or reject |
| GET | `/api/team/corrections?status=` | Reports' correction requests |
| POST | `/api/team/corrections/:id/decision` | Approve or reject |

### Angular conventions
- Standalone components only, `ChangeDetectionStrategy.OnPush`, zoneless change detection.
- Signals for state: `signal`, `computed`, `input()`, `output()`, `model()`. `inject()` instead of constructor injection.
- Built in control flow (`@if`, `@for`, `@defer`). No `*ngIf` / `*ngFor`.
- Every feature route is lazy loaded.
- Reads use `httpResource`, created through a feature service method so each resource lives and dies with the component that uses it. Mutations use `HttpClient` inside the same service. Components never call `HttpClient` directly.
- **Always read a resource through `valueOr(resource, fallback)`.** `resource.value()` throws while the resource is in error, which would crash the whole page instead of showing the card's error state.
- Forms use Signal Forms (`@angular/forms/signals`, stable since Angular 22). Frontend validation is for user experience only. The backend validates for security (Spring Bean Validation).
- Menus and panels use the native `popover` attribute, dialogs use `<dialog>`. No CDK or UI kit unless a real gap shows up.
- Shared state (session, current view) lives in small `providedIn: 'root'` services built on signals. No NgRx or other state libraries without Parnika's approval.
- Prop drilling beyond 2 levels → move state into a service or restructure.

### Styling
- **Tailwind CSS v4** for layout and spacing. Design tokens (colours, fonts, shadows, easing) are defined once with `@theme` in `src/styles.css`. Colours use `light-dark()`, so dark mode follows `color-scheme`, which the theme toggle sets on `<html>`.
- Fonts: Fraunces for display (greetings, page titles, big numbers), IBM Plex Sans for everything else. Both self hosted through `@fontsource`.
- Component specific CSS goes in the component's own stylesheet when Tailwind can't express it cleanly.
- No inline `style` attributes except truly dynamic single values (a progress width).
- More than ~5 utility classes on an element repeated in several places → extract a shared component.

---

## Naming & Style

- **PascalCase**: classes, components, types, interfaces, enums.
- **camelCase**: variables, functions, signals, non class files' exports.
- **kebab-case for all filenames**: `leave-balance.ts`, `attendance-api.ts`. Follow the current Angular style guide (no `.component` suffix).
- No `I` prefix on interfaces. Name things for their domain meaning.
- Named exports everywhere (Angular convention). Inputs that are booleans start with `is` or `has`. Outputs are named for the event (`approved`, `cancelled`), not `onX`, per Angular's style guide.

---

## TypeScript Standards

- Strict mode and Angular strict templates stay on.
- Never use `any`. Use `unknown` and narrow.
- No `as` assertions except for untyped third party code, with a comment saying why.
- No `!` non null assertions. Guard explicitly.
- Use `undefined` for optional values. Avoid `null`, except where Angular itself produces it (async pipe, form controls). Convert at that boundary.
- `interface` for object shapes that get extended, `type` for unions and mapped types.
- Types used in more than one file live in `src/app/models/`.

---

## Coding Standards

### General
- `async/await` over `.then()` chains. RxJS is fine where Angular hands you an Observable, keep pipes short.
- Handle every error. Never swallow one silently. Show the user something useful.
- `const` everywhere. No `let` or `var` unless a loop truly needs it.
- No single letter names except loop indices.
- No magic numbers. Extract named constants (grace minutes, expiry warning days).
- Always use braces for control structures.

### Functions & immutability
- Arrow functions for helpers. Implicit returns for simple expressions.
- Never mutate data. Use spread, `map`, `filter`, `reduce`, and `signal.update()` with new objects.
- No rest parameters. Use named object parameters.
- Prefer pure functions.

### Conditionals
- Simple → one line ternary. Complex → guard clauses.
- Spread conditionally rather than mutating objects.

### Components
- Keep components small. Extract a child when a template passes ~60 lines.
- Pass only the fields a component needs, not whole objects, unless it genuinely uses the whole model.
- `computed()` for derived values. No logic heavier than a property read in templates.

---

## Security Practices

- No secrets, backend URLs or keys in frontend code. Anything in the bundle is public.
- Session in an httpOnly cookie. Nothing sensitive in Web Storage.
- XSRF protection on all mutations.
- Never use `innerHTML` / `bypassSecurityTrust*` unless unavoidable, and sanitise first.
- Mask personal identifiers (passport, ID numbers) at the API, not just in the UI.
- Managers can only reach their own reports' data. The backend enforces this, the UI mirrors it.
- Set a strict Content Security Policy when the app is served.
- `noindex` everywhere. This portal holds staff personal data.

---

## Configuration & Environment

- The only frontend env variable is `USE_MOCK_BACKEND`, read by `proxy.conf.mjs` at dev time. Document any new variable in `HOW-TO-RUN.md`.
- Runtime constants (expiry warning days, footer details) live in `src/app/core/config.ts`.

---

## Performance

- Lazy load every feature route. Use `@defer` for below the fold widgets.
- `NgOptimizedImage` for all images.
- Self host fonts. No third party font CDNs (they leak staff IP addresses).
- `routerLink` for all internal navigation.

---

## Testing

- Write tests for every new feature and bug fix before marking a task done. Cover happy path, edge cases and errors.
- Never change production code just to make testing easier.
- Arrange / Act / Assert. One concept per test.
- Test what the user sees, not internals.
- Playwright selectors use `data-testid`, never CSS classes or copy text.
- Coverage target: **80%** lines and branches minimum.

### Commands (run inside `frontend/`)

| Name | Command |
|---|---|
| Type check | `npm run check:type` |
| Lint | `npm run lint` |
| Lint fix | `npm run lint:fix` |
| Unit tests (Vitest) | `npm run test:unit` |
| Unit (watch) | `npm run test:unit:watch` |
| Coverage | `npm run test:coverage` |
| E2E (Playwright) | `npm run test:e2e` |
| All checks | `npm run check` |

---

## Lint Workflow

1. `npm run lint:fix`
2. `npm run lint`
3. Fix what's left by hand.
4. `npm run lint` again until exit code 0.

Do not report lint as passing until it exits with 0.

---

## Documentation

- Update `HOW-TO-RUN.md` when adding routes, env variables, scripts or folders.
- Update this file when a requirement or architectural decision changes, and replace placeholders as Parnika confirms them.

---

## Final Checks Checklist

After **every** code change, run these in order inside `frontend/`:

- [ ] `npm run lint:fix`
- [ ] `npm run lint` exits with 0
- [ ] `npm run check:type` has zero errors
- [ ] `npm run test:unit` all passing
- [ ] `npm run test:e2e` affected journeys passing (needs the mock server running)
- [ ] Dead code scan on all touched files
- [ ] `npm run test:coverage` meets 80%

If any step fails, stop, fix it and rerun that step before moving on.

**Always include the Final Checks Checklist results in the summary.**
