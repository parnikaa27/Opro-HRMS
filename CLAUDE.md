# Opro HRMS Project Instructions

> **Read this file in full before doing anything.**
> These rules apply to every response, every task, and every session.

Opro is a company based in the Maldives. This repo holds its HR portal: attendance (fed by a biometric device), leave, holidays, employee profiles with a virtual ID card, and visa tracking for expatriate staff.

| Part | Stack | Status |
|---|---|---|
| `frontend/` | Angular 22, Tailwind CSS v4, Vitest, Playwright | Employee, manager and HR views built. Employee and manager pages match the Figma design; HR pages reuse its classes |
| `design/figma-make/` | `App.tsx` and `index.css` copied from the Figma Make file "Opro HRMS Portal" | The visual source of truth |
| `frontend/dev-server/` | Plain Node mock API serving JSON fixtures | In progress |
| `backend/` | Java 25, Spring Boot 4.1, PostgreSQL 18, Flyway, Maven | Every endpoint is live: session, profile with photo, holidays and events, attendance, leave with medical certificates, documents, announcements, change requests, notifications, the team view and the HR view. The mock stays for frontend work and the e2e tests |

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
| Manager | People with direct reports | Everything an employee can, plus a **Team view** for their **direct reports only**. Not stored: anyone with an active report is a manager, so a reporting line change moves the access with it |
| HR | HR staff, who are also employees | Everything an employee can, plus an **HR view** for the whole company (see HR below) |

- A manager is also an employee. A view switch sits in the header with **Employee**, plus **Manager** for managers and **HR** for HR staff. It only renders when there is more than one option. The last chosen view is remembered per browser, and only restored if the person still has that role.
- Holidays, events, visa records, leave policy and announcements are read only for everyone except HR.
- The UI hides what a role cannot use, but **the backend is the real gate**. Never rely on a route guard for security.

### Login

- Real login is decided when the backend is built (SSO is the likely target). Session lives in an **httpOnly, Secure, SameSite=Strict cookie** set by the server. No tokens in `localStorage` or `sessionStorage`, ever.
- The mock server offers a "pick a user" login screen so every role can be tested.
- Angular's built in XSRF support (`XSRF-TOKEN` cookie → `X-XSRF-TOKEN` header) is used for all mutations.

### Pages (v1)

The look of every page comes from the Figma Make file (see Design below). Sidebar nav for employees: Overview, Attendance, Leave, Calendar, Documents. For managers: Overview, People, Attendance, Leave (with a count of what's waiting), Calendar. Profile is reached from the name menu at the top right.

**Employee view**

| Route | Contents |
|---|---|
| `/login` | Mock user picker (dev only) |
| `/` Overview | Welcome banner, today's attendance (time in, expected out, effective hours, device sync), leave balance, visa status, recent attendance table, dark staff card, next holiday and long weekend, latest leave request |
| `/documents` | Employment documents with status and download (sample files from the mock until storage exists) |
| `/attendance` | My attendance: four summary cards, the attendance log for a chosen month, CSV export, punch fix requests and their status, and the device's sync state |
| `/leave` | Leave and time off: balance rings, other leave types, request history with cancel (pending, or approved and not started), and the Request leave modal with a working day preview and a success screen |
| `/calendar` | Company calendar: month grid with public holidays and company events, upcoming holidays, the holiday policy. Islamic holidays are marked **tentative** until confirmed after moon sighting. `/holidays` redirects here |
| `/profile` | Virtual ID card (printable), personal and job details, emergency contact, visa and work permit details, request a change to personal details |
| Notifications | Header panel, not a page: leave and punch fix decisions, visa reminders, announcements, every change HR makes to your record (punches, leave recorded for you, balance adjustments, visa, details, photo, a detail change request) and changes to working hours. Each says what changed and why, in plain words. Marking someone as leaving sends nothing: HR tells people in person |
| Search | Top bar, ⌘K or Ctrl K. Finds pages, and people for managers |

**Team view (managers only)**

| Route | Contents |
|---|---|
| `/team` | Manager overview: welcome banner, team members, pending requests, average attendance and out of office cards, waiting leave with one click approve, team today, a month attendance chart with CSV export, visa alerts |
| `/team/people` | Card directory of direct reports with today's status and search |
| `/team/approvals` | Leave requests in tabs (Pending, Approved, Declined, Punch fixes). Approve in one click. Declining opens a modal that needs a reason, so the employee can plan around it. Waiting leave shows who else is off on those dates |
| `/team/attendance` | Team summary cards and a table with one row per report (days present, late, missed, hours, today), month picker, CSV export, every device's status |
| `/team/calendar` | The company calendar plus who on the team is away (approved filled, pending dashed) |
| `/team/:employeeId` | One report's leave balances, this month's attendance log, leave requests, staff card and visa. Read only |

**HR view (HR role only)**

Sidebar: Overview, People, Leave (count waiting), Calendar, Visas, Inbox (count open), Announcements, Policies.

| Route | Contents |
|---|---|
| `/hr` | Welcome banner, people, waiting decisions, visas to act on and inbox counts, oldest waiting leave, visa alerts, tentative holidays in the next 60 days |
| `/hr/people` | The People page for everyone at Opro, with Add person and a toggle to include people who have left |
| `/hr/people/new`, `/hr/people/:employeeId/edit` | Add a person, or edit their details and manager. A page, not a modal, because the form is long |
| `/hr/people/:employeeId` | One person's balances, this month's log with Fix punches on every row, requests, balance change log, staff card and visa. Record leave, adjust a balance, update visa. A More menu holds edit details, change photo and mark as leaving |
| `/hr/leave` | The leave requests page for every request in the company, so HR can step in when a manager is away |
| `/hr/calendar` | Holidays and events per year: add, edit, delete, confirm a tentative date, add the civil holidays to an empty year |
| `/hr/visas` | Every expatriate, people with no record first, then soonest visa or passport expiry |
| `/hr/inbox` | Profile change requests in tabs (Open, Done, Declined). Declining needs a reason |
| `/hr/announcements` | Post, edit and take down notes from HR. A new one notifies everyone |
| `/hr/policy` | Policies: leave types with yearly days and half day rule (a new entitlement applies from the next leave year), and the work schedule as dated versions |

### Attendance rules (placeholders, confirm with HR)

| Rule | Value |
|---|---|
| Time zone | Maldives Time, UTC+5 (`Indian/Maldives`), single zone |
| Work week | Sunday to Thursday. Friday and Saturday off |
| Shift | 09:00 to 17:00. HR changes it from Policies |
| Late | First punch after 09:15 (15 minute grace, set by HR) |
| Half day | Less than 4 hours worked (set by HR) |
| Absent | No punch, no approved leave, not a holiday or weekend |
| Ramadan hours | 09:00 to 14:00 |
| Overtime | Minutes beyond the shift, shown only, no approval flow in v1 |

- **Shift rules are dated versions.** HR sets shift start and end, grace, half day threshold and Ramadan hours from a date after today. Days already worked keep the version they were worked under. A version that hasn't started can be cancelled. Ramadan hours apply from the first day of Ramadan to the day before Eid al Fitr in the holiday calendar (backend). The work week is not editable.
- The backend sends `expectedOut` and `scheduledMinutes` with each day, from the version in force. The frontend shows them and never works out a shift itself.
- **Punch fixes by HR:** add a missing punch or void a wrong one, one change at a time, always with a reason. Device punches are never overwritten, every change is logged with who, when and why, and the backend works the day out again. An approved punch fix request goes through the same path, logged as approved by whoever decided it. Corrected days show "Corrected" to everyone who sees them.
- Raw punches are never edited. A wrong one is voided and a missing one is added with source `manual`. Each day is worked out per request from the punches, the schedule version in force, holidays, approved full day leave and the weekend (`DayCalculator`).
- Ramadan hours are stored on the schedule but not applied yet. HR now confirms the first day of Ramadan and Eid al Fitr in the calendar, so the next step is applying those dates when a day is worked out.
- Until a device is connected, the dev profile fills recent weeks with believable punches on start up (`DevPunchSeeder`). Real devices replace it.
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
- Sick leave longer than `documentRequiredAfterDays` asks for a medical certificate: PDF, JPG or PNG up to 5 MB, attached when applying or later from the request history. It is health data: the employee and HR can open it, managers only see that one is attached. The server checks the file's first bytes, not just its type, and serves it with `nosniff` and a `sandbox` policy.
- Single level approval by the direct manager. A manager decides only for their active direct reports, never their own leave (that goes to their own manager). Declining needs a reason, enforced on the server.
- Decisions tell the employee in plain words, new requests and punch fixes tell the manager. An approved punch fix adds a manual punch linked to its request.
- Statuses: `pending`, `approved`, `rejected`, `cancelled`.
- The backend owns day counts and balances. The frontend may preview a count but the server's number wins: Spring ignores any `days` the client sends.
- Balances are never stored as totals. Taken is leave used before Opro HRMS (`taken_before`) plus approved requests in the year; pending is pending requests. Applying locks the person's record, so two requests sent at once can't spend the same days.
- A request stays inside one leave year. Leave across New Year is two requests. Booking into next year opens that year's balance from the policy's default, for types the person holds now.
- Overlapping pending or approved requests are refused. Cancelling works for pending requests, and approved ones that haven't started.

### Visa and work permit

- Only expatriate staff have visa records. Maldivian nationals see "Not applicable" instead of an empty section.
- Fields: work permit number, visa number, passport (**last 4 digits only, the API never sends the full number**), passport expiry, visa issue date, visa expiry date.
- Status shown: **Valid**, **Expiring soon** (60 days or less), **Expired**. Passport expiry gets the same treatment.
- Managers see visa status for their reports. Visa reminders appear on the dashboard and in notifications.

### Virtual ID card

- Front: photo (initials until HR adds one), full name, designation, department, employee ID, blood group. Back: email, phone, work location, joining date, emergency contact, a return address.
- Both sides are sized in container units, so the same markup prints at real ID card size (85.6 × 54 mm). Printing uses `window.print()` and a print stylesheet that hides everything else. No PDF library, no QR code in v1.
- The card is the profile's only view of personal details. Changes go to HR through a request (`POST /api/profile/change-requests` with `field` and `details`).

### Footer

Logo, "People first, always.", "© year Opro Pvt Ltd · Malé, Republic of Maldives", links to Privacy, HR policies and Support. **Legal name, address, HR email and the two policy URLs are placeholders** in `core/config.ts` until Parnika confirms them.

### HR

- HR is a role on an employee record. HR staff get a third view switch option, "HR", and see the whole company.
- **Holiday calendar:** add, edit and delete holidays per year. Mark an Islamic date confirmed after moon sighting, which notifies everyone. An empty year can start from the fixed civil holidays (New Year, Independence Day, Victory Day, Republic Day).
- **Company events** on the calendar ("Office social", "Team review"), managed by HR.
- **Leave policy:** leave types and yearly entitlements.
- **Work schedule** and **punch fixes**, see Attendance rules.
- **People:** add someone (ID, roles and full annual, sick and family balances come from the server), edit details and manager (never themselves or anyone below them), and mark someone as leaving. Nobody is ever deleted: after their last day they can't sign in and drop out of live lists, their records stay, and leave booked after that day is cancelled. Someone with active reports can't leave until those reports have a new manager.
- **Photos:** HR uploads them from the person's page. The browser crops to 4:5 and re-encodes a small JPEG, which also strips location data. They show on the ID card, the staff card and avatars.
- **Balance adjustments:** add or remove days for one person with a required reason. Every change is logged with who, when and why. Adjusting a type they don't hold yet (paternity, say) creates that balance.
- **Leave on someone's behalf** is saved as approved and only offers types the person holds a balance for, plus unlimited ones. HR can approve or reject any request when the manager is away.
- **Visa records:** add or update visa, work permit and passport details on renewal.
- **Profile change requests:** an inbox for the requests employees send from their profile.
- **Announcements:** post and edit the notes from HR.
- HR never acts on their own record: their own leave, balance and punch fixes go through their manager like anyone else's. The server refuses it.
- Out of scope for now: granting the HR role from the portal (set on the record by the backend team), changing the work week.

### Exports

- "Export report" downloads a CSV built in the browser. Every cell is quoted, and cells starting with `=`, `+`, `-` or `@` get a leading apostrophe so a spreadsheet never runs them as formulas.

### Non functional

- English only, but use CSS logical properties (`margin-inline-start`, not `margin-left`) so Dhivehi (right to left) can be added later without a rewrite.
- Fully responsive. Phones are a first class target, many staff will check punches and leave on mobile.
- Light and dark. The Figma design has no dark version, so dark is generated from the light stylesheets by `scripts/build-dark-theme.mjs` into `src/styles/dark.css`: light surfaces become navy tinted dark ones, text turns light, coloured text is lifted until it reads, and the parts that are dark on purpose (sidebar, staff card, welcome banner, primary buttons) stay as they are. The script reports any text under 4.5:1 against the dark card. Never edit `dark.css` by hand: change the script or the light styles and run `npm run theme:dark`. `npm run check` fails if it is stale.
- The portal follows the device setting. Light, Dark or Auto in the name menu overrides it, remembered per browser. Printing is always light.
- If a dark design arrives from the designer, it replaces the generated values.
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

### Visual: the Figma design is the source of truth
- **Match the Figma Make file "Opro HRMS Portal" exactly**: layout, sections, navigation, colours, type and spacing. Its code is copied into `design/figma-make/`. Before building or changing a page, read the matching component in `App.tsx` and its classes in `index.css`, and reuse those class names.
- `frontend/src/styles/portal.css` is that stylesheet, ported verbatim. Only font names differ, and sidebar rules also cover links. Don't restyle its classes. Anything the design doesn't cover (search results, our extra statuses, states the mock design only shows one version of, a phone overflow fix) goes in `src/styles.css` under a comment saying why.
- Palette: navy `#102d3f`, aqua `#11ae9e`, aqua dark `#078e83`, page `#f3f7f6`, ink `#16313f`, muted `#71828c`, yellow `#ffc85a`, coral `#f27f68`.
- Icons are Lucide shapes stored in `shared/ui/icon-shapes.ts`. Add new ones from Lucide the same way, not a new icon library.
- People without a photo show initials in the same frames.
- Status colour is never the only signal. Always pair it with text or an icon.

### Typography
- Manrope for headings and big numbers, DM Sans for everything else, as the design specifies. Both self hosted.
- Times use the design's 12 hour clock ("08:56 AM"). Durations read "6h 14m", table hours "08h 54m".
- Times, dates and numbers use tabular figures so columns line up.

### CSS
Respect `prefers-reduced-motion`. Keep visible `:focus-visible` styles. Use modern CSS (nesting, `:has()`, container queries) in our own additions where it earns its place.

---

## Folder Structure

```
HRMS/
  CLAUDE.md
  HOW-TO-RUN.md
  design/figma-make/   # App.tsx and index.css from the Figma Make file. Reference only, not built
  frontend/
    src/styles.css     # Tailwind, fonts, tokens and our additions to the design
    src/styles/portal.css  # The Figma stylesheet, ported
    src/app/
      core/            # App wide singletons: auth, layout shell (header, nav, footer), guards, interceptors, config
      shared/ui/       # Pure presentational pieces (logo, icon, status pill, avatar, welcome banner, dialog, month switcher)
      shared/utils/    # Pure helper functions (dates, formatting)
      features/
        dashboard/
        attendance/
        leave/
        holidays/
        documents/
        profile/       # Staff cards, personal details, visa
        team/          # Manager only screens
      models/          # Shared TypeScript types mirroring API responses
    public/            # Static assets, robots.txt
    src/testing/       # Test helpers and fixtures, never shipped
    e2e/               # Playwright tests
    dev-server/        # Mock API (frontend development only)
      server.mjs
      data/            # JSON fixtures
    proxy.conf.mjs     # Sends /api to the mock or to Spring
    scripts/build-dark-theme.mjs  # Generates src/styles/dark.css from the light styles
  backend/             # Spring Boot 4.1 on Java 25, Maven (./mvnw)
    compose.yaml       # PostgreSQL for development. Project name opro-hrms
    src/main/java/mv/opro/hrms/
      employee/        # One package per feature, like the frontend
      session/
      security/
      common/          # Error shape shared by every endpoint
    src/main/resources/db/migration/  # Flyway, the schema
    src/main/resources/db/dev/        # Dev seed data, dev profile only
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
| GET | `/api/attendance?month=YYYY-MM` | Own daily records. Each punch carries the `device` that recorded it |
| GET / POST | `/api/attendance/corrections` | Own correction requests / raise one |
| GET | `/api/leave/types` | Leave types from the policy. `isUnlimited` marks types with no balance, like unpaid |
| GET | `/api/leave/balances` | Own balances |
| GET / POST | `/api/leave/requests` | Own requests / apply |
| POST | `/api/leave/requests/:id/cancel` | Cancel own request |
| GET | `/api/holidays?year=YYYY` | Public holidays |
| POST | `/api/profile/change-requests` | Ask HR to change personal details |
| GET | `/api/announcements` | Company announcements |
| GET | `/api/events?year=YYYY` | Company events for the calendar |
| GET | `/api/devices` | Biometric devices with location, online state and last sync time |
| GET | `/api/documents` | Own documents (`updatedOn` or `expiresOn`, `status`) |
| GET | `/api/documents/:id/file` | Download one document |
| GET | `/api/notifications` | Own notifications |
| POST | `/api/notifications/read` | Mark all own notifications read |
| GET | `/api/team` | Direct reports with today's attendance and visa |
| GET | `/api/team/:id` | One report's profile, visa and leave balances |
| GET | `/api/team/attendance?month=YYYY-MM` | Reports' daily records |
| GET | `/api/team/leave-requests?status=` | Reports' leave requests |
| POST | `/api/team/leave-requests/:id/decision` | Approve or reject |
| GET | `/api/team/corrections?status=` | Reports' correction requests |
| POST | `/api/team/corrections/:id/decision` | Approve or reject. Approving adds the punch to the record, the same way an HR punch fix does |
| GET | `/api/hr/employees` | Everyone, with today's attendance and visa. HR only, like every `/api/hr` route |
| GET | `/api/hr/employees/:id` | One person's profile, visa, leave balances and balance adjustments |
| PUT | `/api/hr/employees/:id/visa` | Add or update visa, work permit and passport (last 4 only) |
| GET | `/api/hr/attendance?employeeId=&month=YYYY-MM` | One person's daily records |
| GET / POST | `/api/hr/leave-requests?status=` | Every leave request / record leave for someone, saved as approved |
| POST | `/api/hr/leave-requests/:id/decision` | Approve or reject any request |
| GET | `/api/hr/corrections?status=` | Every correction request |
| POST | `/api/hr/corrections/:id/decision` | Approve or reject |
| POST | `/api/hr/balance-adjustments` | Add or remove days with a reason (`employeeId`, `type`, `days`, `reason`) |
| PUT | `/api/hr/leave-types/:code` | Change a leave type's name, `defaultEntitlement` or `allowsHalfDay` |
| POST / PUT / DELETE | `/api/hr/holidays`, `/api/hr/holidays/:id` | Manage holidays. Confirming a tentative one notifies everyone |
| POST | `/api/hr/holidays/start-year` | Add the fixed civil holidays to a year (`year`) |
| POST / PUT / DELETE | `/api/hr/events`, `/api/hr/events/:id` | Manage company events |
| GET | `/api/hr/change-requests` | Profile change requests |
| POST | `/api/hr/change-requests/:id/decision` | `done` or `declined` with a `note` |
| POST / PUT / DELETE | `/api/hr/announcements`, `/api/hr/announcements/:id` | Manage announcements. A new one notifies everyone |
| POST | `/api/hr/employees` | Add a person. The server sets the ID and roles, and seeds balances |
| PUT | `/api/hr/employees/:id` | Edit details and `managerId` |
| POST / DELETE | `/api/hr/employees/:id/leaving` | Set a last day with a reason / take it back before it passes. `?include=former` on the list adds people who have left |
| PUT / DELETE | `/api/hr/employees/:id/photo` | Upload (raw JPEG body, 1 MB max) or remove a photo |
| GET | `/api/employees/:id/photo` | A photo, for anyone signed in. URLs carry a version, so they cache forever |
| GET / POST / DELETE | `/api/hr/schedules`, `/api/hr/schedules/:id` | Work schedule versions / add one from a future date / cancel one not yet started |
| GET / POST | `/api/hr/punch-edits?employeeId=&month=` | The punch fix log / add or void one punch (`action`, `time`, `reason`) |
| PUT | `/api/leave/requests/:id/certificate` | Attach a medical certificate to own sick leave (raw body, 5 MB max) |
| GET | `/api/leave/requests/:id/certificate`, `/api/hr/leave-requests/:id/certificate` | Open a certificate: own, or any for HR. Never for managers |

### Files
- Photos, medical certificates and documents are stored in PostgreSQL (`stored_file`) for now, so they share transactions and backups with the rest. Moving to object storage later only touches the `files` package.
- Every upload is the raw request body, read through `Upload.read`: allowed type, size limit (photos 1 MB JPEG, certificates 5 MB PDF, JPG or PNG), and the first bytes must match the type. Anything else is refused before it is stored.
- Every file is served by `Files.serve` with `nosniff` and `Content-Security-Policy: sandbox`. Photo URLs carry a version and cache for good; certificates and documents are never cached.

### Backend conventions
- Java 25 LTS, Spring Boot 4.1, PostgreSQL 18, Maven with its wrapper. Spring Boot's parent POM pins library versions; don't override one without a reason written beside it.
- One package per feature (`employee`, `leave`, `attendance`...), mirroring `frontend/src/app/features`. Controllers stay thin and talk to a feature service.
- Records for request and response shapes, named to match the frontend's models field for field. Entities are classes with getters, no setters the API doesn't need.
- Constructor injection, package private where possible. No Lombok.
- Every error leaves as `{"message": "..."}`, written for the person reading it. Throw `ApiException` with a status for refusals people can act on. Never send stack traces or internal details.
- Bean Validation on every request body. The frontend's checks are for comfort, these are the real ones.
- The schema changes only through a new Flyway migration. Never edit one that has been applied anywhere shared. Hibernate only validates (`ddl-auto: validate`).
- "Today" always comes from the injected `Clock` (Maldives time), never `LocalDate.now()` on its own.
- Roles are worked out per request: manager from active reports, HR from the record. Load the signed in employee through `CurrentUser` so a leaving date or new reporting line applies at once.
- The `dev` profile holds everything development only: the local database, the seed people and the pick a user sign in. Nothing in it may ship.
- Tests are integration tests against a real server and a throwaway PostgreSQL (Testcontainers), using a cookie keeping client so the session cookie and XSRF round trip are tested as a browser sees them.

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
- Lists show `ListSkeleton` while their first load is in flight, never their empty state. An empty state that flashes before data arrives is a lie.

### Styling
- Pages use the design's own classes from `portal.css` (`card`, `card-heading`, `eyebrow`, `status-pill`, `primary-button`, `page-view`, `page-title` and so on), written exactly as the Figma markup uses them.
- **Tailwind CSS v4** is for small layout gaps the design classes don't cover. Its tokens in `src/styles.css` map onto the Figma palette.
- Fonts: Manrope and DM Sans through `@fontsource-variable`.
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

And inside `backend/` when it changed (Docker Desktop running):

- [ ] `./mvnw verify` builds with no new warnings and every test passes

If any step fails, stop, fix it and rerun that step before moving on.

**Always include the Final Checks Checklist results in the summary.**
