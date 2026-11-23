# Opro HRMS Project Instructions

> **Read this file in full before doing anything.**
> These rules apply to every response, every task, and every session.

Opro is a company based in the Maldives. This repo holds its HR portal: attendance (punched from the portal, at an office or from home), leave, holidays, employee profiles with a virtual ID card, and visa tracking for expatriate staff.

| Part | Stack | Status |
|---|---|---|
| `frontend/` | Angular 22, Tailwind CSS v4, Vitest, Playwright | Employee, manager and HR views built on the Figma layout, with the look reworked on 23 November (see Design) |
| `design/figma-make/` | `App.tsx` and `index.css` copied from the Figma Make file "Opro HRMS Portal" | Where the layout and class names come from. The look has moved on from it |
| `frontend/dev-server/` | Plain Node mock API serving JSON fixtures | For the Netlify demo and the second e2e run only. Development runs on Spring |
| `backend/` | Java 25, Spring Boot 4.1, PostgreSQL 18, Flyway, Maven | Every endpoint is live: session, profile with photo, holidays and events, attendance, leave with medical certificates, documents, announcements, change requests, notifications, the team view, the HR view, punching from the office or home, daily visa reminders, leave types HR manages with carry forward, compensatory off and flight allowances. The mock stays for frontend work, and the e2e tests run against both |

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
- **Maintain `TODO.md`** at the repo root: everything left before launch, everything waiting on Parnika, and what's deferred. Add to it whenever something is left open, and remove items when they're done.
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
| HOD | People with direct reports (called `MANAGER` in code) | Everything an employee can, plus a **Team view** for their **direct reports only**, where they decide leave, punch fixes, home days, comp off and overtime. Not stored: anyone with an active report is an HOD, so a reporting line change moves the access with it |
| HR | HR staff, who are also employees | Everything an employee can, plus an **HR view** for the whole company (see HR below). HR never decides at the HOD step; they approve after the HOD only where Policies ask for it (see Approvals) |
| Super admin | Seniors, set on the record (`is_super_admin`) by the backend team | Everything an employee can, plus a **company view**: where everyone is today, anyone's leave and attendance history, and **stepping in on any waiting decision at the HOD step** (leave, punch fixes, home days, comp off, overtime, performance plans, appraisals and probation reviews), never HR's step, when an HOD is away, at any time, never for themselves. Each decision shows who made it. Their own leave, punch fixes and home days are approved as they're sent, and they earn no comp off or overtime |

- **Everyone except a super admin has a reporting manager.** The server refuses to add or save anyone else without one.

- An HOD is also an employee. A view switch sits in the header with **Employee**, plus **HOD** for HODs, **HR** for HR staff and **Super admin** for super admins. It only renders when there is more than one option. The last chosen view is remembered per browser, and only restored if the person still has that role.
- Holidays, events, visa records, leave policy and announcements are read only for everyone except HR.
- The UI hides what a role cannot use, but **the backend is the real gate**. Never rely on a route guard for security.

### Login

- **To do, to discuss with Parnika: Microsoft sign in (Entra ID SSO).** People will be matched to their employee record by their Microsoft email; roles and HODs are mapped by hand. Until then the dev pick a user screen is the only sign in, and it must never ship. Session lives in an **httpOnly, Secure, SameSite=Strict cookie** set by the server. No tokens in `localStorage` or `sessionStorage`, ever.
- The mock server offers a "pick a user" login screen so every role can be tested.
- Angular's built in XSRF support (`XSRF-TOKEN` cookie → `X-XSRF-TOKEN` header) is used for all mutations.

### Pages (v1)

The layout of every page comes from the Figma Make file and its look follows Design below. Sidebar nav for employees: Overview, Attendance, Leave, Calendar, Documents, Performance. For HODs: Overview, People, Attendance, Leave (with a count of what's waiting), Calendar, Performance. Profile is reached from the name menu at the top right.

**Employee view**

| Route | Contents |
|---|---|
| `/login` | Mock user picker (dev only) |
| `/` Overview | Title band with the date, a welcome card for new joiners until onboarding is done (first day, HOD, buddy, tasks), today's attendance (time in, expected out, effective hours, punch in and out), leave balance, visa status, recent attendance table, dark staff card, next holiday and long weekend, latest leave request |
| `/performance` | Their plan for the open appraisal cycle as five numbered sections (Goals and KPIs, Plan for certifications, Learning and development, Accomplishments, Strengths), each a tile that opens a form to add as many entries as they like, each with a cross. Saved as a draft, sent to their HOD in one go, with a line saying what happens next and why it came back. Then their appraisals with each goal rated and the HOD's comment on the plan (accept the rating), and any probation review. Never the HOD's recommendations |
| `/documents` | Every document on HR's list that applies to them, with its status (missing, waiting for HR, verified, sent back with HR's reason, expired), its dates and each file to download. Upload one or more files at once of the ones employees send (each picked file listed with a cross to take it off before sending), with the start date and, where the type expires, the end date, and take a wrong file off until HR verifies it |
| `/attendance` | My attendance: four summary cards (days present, work hours, on time, overtime), the attendance log for a chosen month, CSV export, punch fix requests and their status, and the punch button while today is on screen |
| `/leave` | Leave and time off: two balance rings, then a balance table for their leave year (type, this year, carried forward, approved, taken so far, waiting, left; comp off says when it runs out), request history with cancel (pending, or approved and not started), and the Request leave modal laid out like the paper form (new, amended or extended application, flight entitlement and salary advance ticks, the days marked AL, PH or OFF and the day they're back) with a success screen |
| `/calendar` | Company calendar: month grid with public holidays and company events, upcoming holidays, the holiday policy. Islamic holidays are marked **tentative** until confirmed after moon sighting. `/holidays` redirects here |
| `/profile` | Virtual ID card (printable), personal and job details, emergency contact, visa and work permit details (with employment approval and the work permit medical), their record (bank details they enter for HR to verify, shown as the last 4 digits; insurance, education and experience HR keeps), request a change to personal details, the flight allowance (used, waiting and left in USD, MVR or INR) with flight claims, their allowances (monthly ones and one-off grants), and their resignation (resign, withdraw while it waits, then the exit date and what to hand back) |
| Notifications | Header panel, not a page: leave, punch fix, home working, compensatory off, overtime and flight claim decisions, goals set, an appraisal or probation review done, a cycle opened (HODs), visa reminders, announcements, every change HR makes to your record (punches, leave recorded for you, balance adjustments, visa, details, photo, a detail change request) changes to working hours, and on the day, birthdays and work anniversaries (theirs, and their reports' for HODs and HR). Each says what changed and why, in plain words. Marking someone as leaving sends nothing: HR tells people in person |
| Search | Top bar, ⌘K or Ctrl K. Finds pages, and colleagues in the employee view (name, role, department and work email to write to, nothing else). HODs, HR and super admins find people to open in their own views |

**Team view (HODs only)**

| Route | Contents |
|---|---|
| `/team` | Manager overview: title band, team members, pending requests, average attendance and out of office cards, waiting leave with one click approve, team today, a month attendance chart with CSV export, visa alerts, and reports still onboarding (the HOD's tasks, picking a buddy) |
| `/team/people` | Card directory of direct reports with today's status and search |
| `/team/approvals` | Leave requests in tabs (Pending, Approved, Declined, Punch fixes, Home working, Comp off, Overtime, Resignations). Approve in one click. Declining opens a modal that needs a reason, so the employee can plan around it. Waiting leave shows who else is off on those dates |
| `/team/attendance` | Team summary cards and a table with one row per report (days present, late, missed, hours, today), month picker, CSV export |
| `/team/performance` | The four steps of an appraisal, reports on probation to review (confirm, extend with a new date, or don't confirm), then each report in the open cycle under tabs by what's needed: Plans to approve (the whole plan, numbered, to approve or send back with a note), To appraise (with the rest of their plan alongside), Waiting on others, and Appraised |
| `/team/calendar` | The company calendar plus who on the team is away (approved filled, pending dashed) |
| `/team/:employeeId` | One report's leave balances, attendance log with a month picker (a week at a time, Show more for the next), leave requests, staff card and visa, and their one-off allowances, with granting another |

**Super admin view (super admins only)**

Sidebar: People, Dashboard, Attendance, Leave (count waiting across Opro), Calendar, Performance, Reports. Reuses the Team view's pages with `scope: 'company'` in route data. Route input binding sets a missing input to `undefined`, so every route that uses these pages sets `scope`, the team ones too.

| Route | Contents |
|---|---|
| `/company` | Everyone at Opro with today's status, and a count of who is at the office, from home, at a resort, on leave or not in |
| `/company/attendance` | Summary cards and one row per person, month picker, CSV export |
| `/company/leave` | The leave requests page for every request at Opro: approve in one click, decline with a reason, to step in when an HOD is away |
| `/company/performance` | The Team view's performance page for everyone at Opro with an HOD, naming each person's HOD: approve a plan, appraise or review probation when an HOD is away. Never HR's step, never their own |
| `/company/calendar` | The company calendar plus who at Opro is away |
| `/company/dashboard`, `/company/reports` | The executive dashboard and reports, the same as HR's (see below) |
| `/company/:employeeId` | One person's balances, attendance log with a month picker (a week at a time, Show more for the next), leave requests, staff card and visa |

**HR view (HR role only)**

Sidebar: Overview, Dashboard, People, Calendar, Visas, Inbox (count open), Announcements, Performance, Policies, Reports.

| Route | Contents |
|---|---|
| `/hr` | Title band, people, on leave today, visas to act on and inbox counts, who is on leave today, visa alerts, tentative holidays in the next 60 days, new joiners still onboarding, and documents to collect |
| `/hr/people` | The People page for everyone at Opro, with Add person and a toggle to include people who have left |
| `/hr/people/new`, `/hr/people/:employeeId/edit` | Add a person, or edit their details and manager. A page, not a modal, because the form is long |
| `/hr/people/:employeeId` | One person's balances, this month's log (a week at a time, Show more for the next), requests (with any medical certificate to open), balance change log, staff card, visa and their record (insurance, bank details to verify, education, experience). Set their days of a type or give or take away a type (Leave days), adjust a balance, update visa, set their flight allowance. A More menu holds edit details, change photo and mark as leaving |
| `/hr/calendar` | Holidays and events per year: add, edit, delete, confirm a tentative date, add the civil holidays to an empty year |
| `/hr/visas` | Every expatriate, people with no record first, then soonest visa or passport expiry, and the expatriate quota: approvals by job category with slots used, expiry, and any job category with no quota |
| `/hr/inbox` | Profile change requests in tabs (Open, Done, Declined), requests the HOD approved that HR approves too (approve, or decline with a reason), resignations the HOD approved (approve with the exit date, or decline), one-off allowances HODs granted (approve, or decline with a reason), and documents and bank details to check, oldest first: verify, or send back with a reason. Declining needs a reason |
| `/hr/announcements` | Post, edit and take down notes from HR. A new one notifies everyone |
| `/hr/dashboard` | The executive dashboard: employees, joiners, leavers with attrition and retention, who's in today and who isn't in yet; locals and expatriates, gender, employment type, age, departments and nationalities; today's attendance and this month's; leave waiting, annual leave used, sick leave by month; papers expired or expiring within 60 days and quota use; birthdays and anniversaries this month, probation ending within 30 days, contracts within 60; performance (on probation, appraised so far, average rating, rated 4 or 5, recommended for promotion). Only what today's data supports: recruitment, payroll and training appear when those modules exist |
| `/hr/reports` | Headcount, joiners and leavers, workforce mix, leave balances, leave taken, attendance and visa and permit expiry, each shown as a table and saved as CSV, Excel or PDF |
| `/hr/performance` | Open and close appraisal cycles, plans the HOD approved for HR to approve or send back, how far the latest cycle has got (where each plan stands, rating, the HOD's promotion and increment recommendations, whether the person has accepted), and every probation review |
| `/hr/policy` | Policies: add, edit and remove leave types (yearly days, half days, given to everyone or people HR picks, lapse or carry forward up to a cap; a new entitlement applies from the next leave year; approved by the HOD, or the HOD then HR), which other requests HR approves after the HOD, the work schedule as dated versions, the documents Opro keeps, what comes back when someone leaves, the kinds of allowance, the onboarding task list, and the exchange rates for flight allowances |

### Attendance rules (placeholders, confirm with HR)

| Rule | Value |
|---|---|
| Time zone | Maldives Time, UTC+5 (`Indian/Maldives`), single zone |
| Work week | Saturday to Thursday. Friday is the only day off |
| Shift | 09:00 to 17:00. HR changes it from Policies |
| Late | First punch after 09:15 (15 minute grace, set by HR) |
| Half day | Less than 4 hours worked (set by HR) |
| Absent | No punch, no approved leave, not a holiday or weekend |
| Overtime | Time after the shift ends, from 30 minutes (placeholder) |

- **Shift rules are dated versions.** HR sets shift start and end, grace and the half day threshold from a date after today. Days already worked keep the version they were worked under. A version that hasn't started can be cancelled. The work week is not editable. There are no Ramadan hours: every day follows the one schedule in force.
- The backend sends `expectedOut` and `scheduledMinutes` with each day, from the version in force. The frontend shows them and never works out a shift itself.
- **Punch fix requests** have a type: **Working from resort**, **Forgot to punch**, **Late punch** or **Other**. A reason is required for Late punch and Other only. Approving one adds the punch they missed; approving a **late punch** voids their late punch in (logged, never deleted) and puts in the time they arrived, so lateness and hours are worked out again. A late punch can't move the punch in later.
- **Punch fixes are the HOD's to decide.** HR doesn't add or void punches. An approved fix adds a `manual` punch linked to its request, and the backend works the day out again. Corrected days show "Corrected" to everyone who sees them. HR's old punch edits stay in `punch_edit` as history.
- Raw punches are never edited. A wrong one is voided and a missing one is added with source `manual`. Each day is worked out per request from the punches, the schedule version in force, holidays, approved full day leave and the weekend (`DayCalculator`).
- The dev profile fills recent weeks with believable portal punches on start up, mostly from the office and some from home (`DevPunchSeeder`).
- A day may have **many punches** (breaks). The backend pairs them and works out first in, last out, time worked and status. **The frontend only displays these values. It never calculates attendance status.**

### Punching (replaces the fingerprint devices)

- Staff punch in and out from the portal (`POST /api/attendance/punch`). Punching in asks once: **at the office**, **at a resort** or **from home**. The first punch sets the day's mode, and every later punch that day must match it.
- **At the office:** the browser sends its location and accuracy. The server works out the distance to the nearest work location and refuses anything further than its radius (**300 m**), or a location less precise than **150 m**. Only the office name and the distance are stored, never coordinates.
- **At a resort:** the same check against client resort pins, with a **5 km** radius. It counts like the office, with no approval.
- **Work location and resort pins are placeholders** in `backend/src/main/resources/application.yml` (`opro.punch.offices`: Malé office and Hulhumalé site; `opro.punch.resorts`: one "Client resort") until Parnika confirms them.
- **From home:** no location. The first home punch of a day creates a home day for the manager, who approves or declines it on the Home working tab. Declining needs a reason and turns the day into an absence (punches kept, 0 hours).
- A double tap within a minute is refused. A person's punches are locked while one saves.
- Old fingerprint device punches stay in history with the device's name. The device status screens and `/api/devices` are gone.
- Honest limit: a browser location can be faked with free apps. The fingerprint was the proof someone was there; the distance check is a weaker one.

### Leave rules (placeholders, confirm with HR against the Maldives Employment Act)

| Type | Days per year |
|---|---|
| Annual | 30 |
| Sick | 30 (medical certificate needed beyond 2 consecutive days) |
| Family responsibility | 10 |
| Maternity | 60 |
| Paternity | 3 |
| Unpaid | No limit |
| Compensatory off | Earned, see below |

- **Each person's leave year runs from their joining anniversary** to the day before the next (someone who joined on 29 February starts on the 28th in other years). `leave_year` is the calendar year it starts in (`LeaveYear`). The frontend works out the same dates for display only (`leaveYearOf`).
- **Leave types are HR's.** HR adds, edits and removes them in Policies. A type is given to **everyone** each year, or to **people HR picks** (maternity, paternity, marriage). Removing a type nobody used deletes it; a used one is **retired**: nobody can book it, history keeps its name. No types exist outside the dev seed until HR adds them, except compensatory off.
- **Carry forward** is set per type: unused days **lapse**, or **carry forward up to a cap** HR sets. What carries is worked out from last year every time, never stored, so a late change to last year still counts. Placeholder: every type lapses until HR confirms.
- **A year opens by itself.** Whenever someone's balances are read, any type for everyone they don't hold yet that year is opened from the policy's default. A new type for everyone reaches everyone straight away.
- **One person's leave:** HR sets how many days of a type someone gets this year (fewer for a late joiner, a type only they get), or takes a type away. Every change needs a reason, is logged and notifies them. A type with a waiting request can't be taken away. HR never changes their own.
- Half days allowed (first half or second half).
- **Notice:** HR can set how many days ahead a type is asked for (`noticeDays`, the paper form asks a month for annual leave). Only a new request needs it, not an amendment or extension. None is set until HR does.
- **Amended and extended requests**, as on the paper form. An amendment names a waiting or approved request that isn't over; its days are given back while checking the balance, and approving it cancels the one it replaces. While it waits, the two hold only the longer of them in the balance. An extension starts straight after the request it extends, with no working day between. Both are decided like any request.
- **Flight entitlement and salary advance** are ticks on the request, shown to the HOD and HR. Nothing else happens yet: flight claims stay on the profile and there's no payroll.
- Weekends and public holidays inside a leave range do not count.
- The apply form only offers types the person has a balance for, plus types the policy marks `isUnlimited`. A missing balance never means "no cap".
- Sick leave longer than `documentRequiredAfterDays` asks for a medical certificate: PDF, JPG or PNG up to 5 MB, attached when applying or later from the request history. It is health data: the employee and HR can open it, managers only see that one is attached. The server checks the file's first bytes, not just its type, and serves it with `nosniff` and a `sandbox` policy.
- Approval by the direct manager, then HR for leave types set to need it (see Approvals). A manager decides only for their active direct reports, never their own leave (that goes to their own manager). Declining needs a reason, enforced on the server.
- Decisions tell the employee in plain words, new requests and punch fixes tell the manager. An approved punch fix adds a manual punch linked to its request.
- Statuses: `pending`, `approved`, `rejected`, `cancelled`.
- The backend owns day counts and balances. The frontend may preview a count but the server's number wins: Spring ignores any `days` the client sends.
- Balances are never stored as totals. Taken is leave used before Opro HRMS (`taken_before`) plus approved requests in the year; pending is pending requests. Applying locks the person's record, so two requests sent at once can't spend the same days.
- A request stays inside one leave year. Leave across the end of someone's leave year is two requests. Booking into next year opens that year's balance from the policy's default, plus anything carried forward, for types the person holds now.
- **A holiday added, moved or removed** recounts the waiting and approved leave over it; the person is told the new count, and leave left with no working day in it is cancelled.
- **Any day in the person's current leave year** can be booked, past or future. Days before it started are refused; HR records anything older.
- Sick leave longer than the certificate limit shows **"Medical certificate missing"** to the HOD and HR until one is attached. They can still approve it.
- Overlapping pending or approved requests are refused. Cancelling works for pending requests, and approved ones that haven't started.

### Compensatory off

- Punching on a Friday or a public holiday asks the manager for compensatory off (Comp off tab). Approved, it earns **1 day**, or **half a day** when the day was shorter than the half day threshold, worked out from the punches when they decide. It can't be approved while they're still punched in. Declining needs a reason.
- It's logged with who approved it and **taken within 14 days of the day worked**, or it's gone (`LeaveType.COMP_OFF_VALID_DAYS`). The balance is worked out from approved claims every time: each comp off request uses the days that run out soonest and cover its dates (`CompOffDays`). HR can't adjust it by hand.

### Approvals

- Every request is decided by the HOD first. HR can ask to **approve after the HOD**: per leave type (Policies, "Approved by"), and once each for punch fixes, home working, comp off and overtime (Policies, "HR after the HOD"). Nothing needs HR until they say so.
- An HOD approval of such a request leaves it **pending, waiting for HR**, with who approved it and when (`hodApprovedByName`, `hodApprovedOn`). The employee and every HR person but them are told. Balances, punches, comp off and overtime only change on the final approval.
- Any HR person decides it from the Inbox, never their own. Declining at either step ends it, with a reason. An HOD who is HR covers both steps in one click. Super admins step in at the HOD step only.
- The rule is read when the HOD approves, so changing it doesn't move requests already waiting for HR.
- Known limit: if the only HR person asks for something that needs HR, nobody can give the second approval.

### Performance

- **Probation reviews:** an HOD reviews each report on probation (`probationEndsOn` set): **confirm** (clears the date), **extend** to a later date, or **don't confirm** (left for HR to act on). Comments are required. The person and HR are told.
- **Appraisal cycles:** HR opens one cycle at a time ("2026 appraisals", with a due date), which asks everyone with an HOD to write their plan and every HOD to approve and appraise. Closing it leaves anything not done undone. Everyone with an HOD is in it; super admins have none.
- **The plan:** each person writes theirs in the open cycle, in five sections. **Goals and KPIs**, each with how it's measured and a weight; weights add up to 100%. Then **Plan for certifications** (name, how, and by when), **Learning and development** (what and how), **Accomplishments** (what and the result) and **Strengths** (a line each), as many entries as they like (`performance_entry`). Saving a section replaces it; the plan stays a draft until sent. Goals are needed to send it; the rest can be empty.
- **Approving the plan:** one submit sends all five to their HOD (or a super admin standing in), who approves it or sends it back with a note, then HR does the same; sent back, it's the person's to change and send again. Nothing changes while it waits. An HOD who is HR covers both steps, and HR never decides their own. Kept per person and cycle in `appraisal_form` (`status`: draft, submitted, hod-approved, approved, rejected). Goals HODs set before this count as approved, and earlier self reviews became one entry per section.
- **Appraisals:** the HOD (or a super admin standing in) only, once the plan is approved (no 360° for now). The rest of the plan sits alongside, and the HOD can comment on it. Each goal and the year overall are rated **1 to 5**: Needs improvement, Below expectations, Meets expectations, Exceeds expectations, Outstanding. Comments are required. Final once saved. **The person has to accept the rating**; there's no way to disagree in the portal. Their Performance page asks until they do, and the HOD and HR see who hasn't.
- **Recommendations:** with the appraisal, the HOD can recommend a promotion and an increment percentage. They're advice for HR, shown on HR's page and the dashboard, never to the person. Nothing changes pay: payroll doesn't exist yet.

### Overtime

- **What counts:** on a working day, time worked after the shift ends, but never more than the day's hours were exceeded by. Coming in early doesn't count, and neither does staying late to make up a late start. Under **30 minutes** (placeholder, `DayCalculator.MIN_OVERTIME_MINUTES`) is not overtime. Fridays and public holidays earn compensatory off instead, never both.
- The backend works it out per day (`overtimeMinutes` on each attendance day). Once a day shows overtime, by punching out or through an approved punch fix, the HOD is asked once (Overtime tab). Super admins have nobody to ask, so they have none.
- Approving keeps the minutes the punches show then, ready for payroll. It is refused if the punches no longer show 30 minutes. Declining needs a reason. Both tell the employee.
- The attendance page's Overtime card shows the month's approved and waiting overtime; declined days don't count (`GET /api/attendance/overtime`).

### Flight allowance

- HR sets each person's **yearly allowance in USD** from their page. It can't go below what's already claimed that year. A year HR hasn't set carries the last amount set, so nobody has to set everyone again each January.
- Employees **claim a flight** from their profile: route, date, amount in USD, MVR or INR, and a receipt (PDF, JPG or PNG up to 5 MB, only they and HR can open it). A claim counts against the year of the flight, is converted to USD at **HR's rate on the day**, and can't go past what's left. **Claims need no approval for now**: one counts as soon as it's made, and they can cancel it to give the money back. HR sees claims and receipts on the person's page, and never sets their own allowance.
- **Exchange rates** (MVR and INR per USD) are set by HR in Policies. The starting rates are placeholders. No outside rates service is used.
- The profile shows allowance, used and left in USD, MVR or INR, remembered per browser.

### Documents

- **HR keeps the list** in Policies: each document's name, who uploads it (**the employee**, or **HR**), whether it **expires** (then a date after today is asked for, and how many days ahead it reminds, default 30), and who needs it: **everyone**, **expatriates** only (anyone not Maldivian), or **people HR asks** one by one from their page (a marriage certificate, say). Stopping asking keeps a copy already on file. A type nobody uploaded is deleted when removed; a used one is retired: nobody is asked for it, copies on file stay. The real list is still to come from Parnika; the dev seed has placeholders.
- **One copy per type per person, with one or more files** (the pages of a passport, each certificate), uploaded one at a time. PDF, JPG or PNG up to 5 MB each, checked by its first bytes.
- **Every copy has dates:** the day it starts, always, and the day it expires for types that do. A file with the same dates is another page of the copy on file; new dates make a new copy, whose files replace the old ones.
- **A wrong file comes off with its cross.** The person can take their own off until HR has verified the copy; HR can take any off (never their own). The last file going takes the copy with it.
- **Reminders** for a verified copy that expires (`DocumentReminders`, run with the morning reminders, each once): the person and HR as many days ahead as HR set for the type, super admins too in the last 7 days, and everyone on the day.
- **HR's overview** shows who still has something to hand in, and what: missing, sent back or expired.
- An employee's upload is **waiting for HR**. HR **verifies** it, or **sends it back** with a reason the employee sees, and they upload again. Both tell the employee.
- HR can upload any type for someone (never for themselves). That copy counts as verified straight away, and the person is told.
- Status is worked out on every read: **missing** without a copy, **expired** once a verified copy's date has passed.
- Only the person and HR can see or open documents. HODs and super admins don't.

### Onboarding

- **HR keeps the task list** in Policies: each task's name, who does it (**HR**, the **HOD** or the **joiner**), and when it's due in days from the joining date (negative is before, up to 90 either way). To start: contract signed, photo and ID card, medical insurance (HR); laptop and desk, first week planned (HOD); upload documents, bank details, read the HR policies (joiner). Changes apply to people added from then on.
- **Adding someone starts their onboarding**: their own copy of the list with real due dates. Their HOD is told what's theirs. HR can start it by hand for someone who joined in the last three months before it existed.
- **Each task is ticked by its owner**: the joiner their own, their HOD the HOD's, any HR person but the joiner HR's (the server checks). Unticking is allowed. Once every task is done, onboarding is complete and the joiner is told.
- **First day:** HR sets the time, place and who to ask for; the joiner is told. **Buddy:** the HOD picks someone from the team; both are told.
- **Where it shows:** a welcome card on the joiner's Overview until it's complete; a "Joining your team" card on the HOD's team overview; a "New joiners" card on HR's overview with progress and what's overdue; and the first weeks card on the person's HR page.

### Allowances

- **HR keeps the kinds** in Policies (to start: housing, food, transport, phone). A kind nobody had is deleted when removed; a used one is retired, and history keeps its name.
- **Monthly allowances:** HR sets what someone gets of a kind every month, in MVR or USD, from the first of a month. A new amount ends the running one the month before it starts (one that hasn't started is replaced), so history stays. HR can stop one after a month. The person is told each time. HR never sets their own.
- **One-off grants:** an HOD grants a report an amount with a reason from that report's page. HR approves it, or declines with a reason the HOD hears; an HOD who is HR covers both. The person is told when it's approved.
- **Who sees them:** the person on their profile, and HR. HODs see only the one-off grants their reports have had. Nothing is paid: they're kept for payroll.

### Leaving Opro

- **Resigning:** anyone resigns from their profile with a reason and the last day they'd like (`release_on`); the day they put it in is recorded. One open resignation at a time. They can withdraw it while it waits. Not once HR has set their last day.
- **Their HOD approves, then HR, always.** Declining at either step needs a reason. An HOD who is HR covers both. Someone with no HOD (a super admin) goes straight to HR. Super admins step in at the HOD step like any request. HR never decides their own.
- **HR's approval sets the exit date**: the day asked for, or another from today on. The person hears it with the list of what to hand back; their HOD hears the date.
- **What comes back** is HR's list in Policies (to start: laptop, ID card, bus travel card, accommodation keys). On the person's page HR ticks each item as returned or never given (undo allowed).
- **Mark as leaving stays locked** for someone with an accepted resignation until every item is ticked: the menu item is disabled, and the server refuses. It then starts with their exit date and "Resigned: their reason".

### Visa and work permit

- Only expatriate staff have visa records. Maldivian nationals see "Not applicable" instead of an empty section.
- Fields: work permit number, visa number, passport (**last 4 digits only, the API never sends the full number**), passport expiry, visa issue date, visa expiry date, and optionally the employment approval (number and expiry, given together) and when the work permit medical is due.
- Status shown: **Valid**, **Expiring soon** (60 days or less), **Expired**. Passport expiry gets the same treatment.
- Managers see visa status for their reports. Visa reminders appear on the dashboard and in notifications.
- A daily job at 08:00 Maldives time (and on start up) sends each reminder once, at 60, 30 and 7 days and on the day it runs out, to the holder, their manager and HR (`VisaReminders`): visa, passport, work permit medical, employment approval and medical insurance. A contract ending (same steps) and probation ending (14 days before and on the day) go to the HOD and HR only. Birthdays and work anniversaries go out on the day (`PeopleReminders`; a 29 February birthday is the 28th in other years). If the server was down, only the most urgent missed one goes out. A renewal starts the reminders again.
- **Expatriate quota:** HR records each approval from the Ministry (job category, slots, approval number, approved and expiry dates). Slots used are counted from active expatriates with that job category on their record, never stored.

### Employee record

- **Bank details:** the person enters bank, name on the account, number and currency (MVR or USD) on their profile. They wait for HR, who checks them against the bank letter and verifies them, or sends them back with a reason. Only HR sees the full number; the person sees the last 4. HODs and super admins never see them. New details always wait for HR again.
- **Medical insurance, education and work experience** are kept by HR on the person's page; the person sees them on their profile and asks HR for changes.
- HR never changes or checks their own record.

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
- **Leave policy:** leave types, yearly entitlements, who gets them and carry forward. See Leave rules.
- **Work schedule**, see Attendance rules. Leave, punch fixes, home days, comp off and overtime are decided by the HOD. HR approves after the HOD only for what Policies say (see Approvals), from the Inbox.
- **Before their first day** someone can't sign in and isn't counted: not in headcount, today's attendance, team lists or appraisal cycles. HR sees them in People as joining on that date, and prepares their photo, documents and onboarding. Anyone added must be **18 by their joining date** (placeholder, `HrPeople.MINIMUM_AGE`).
- **People:** add someone (ID, roles and full annual, sick and family balances come from the server) with gender (male or female), date of birth, employment type (Permanent, Contract, Casual or Intern), when probation and a contract end, and an expatriate's quota job category; edit details and reporting manager (required, except for a super admin) (never themselves or anyone below them), and mark someone as leaving. Nobody is ever deleted: after their last day they can't sign in and drop out of live lists, their records stay, and leave booked after that day is cancelled. Someone with active reports can't leave until those reports have a new manager.
- **Photos:** HR uploads them from the person's page. The browser crops to 4:5 and re-encodes a small JPEG, which also strips location data. They show on the ID card, the staff card and avatars.
- **Balance adjustments:** add or remove days for one person with a required reason. Every change is logged with who, when and why. Adjusting a type they don't hold yet (paternity, say) creates that balance.
- **Visa records:** add or update visa, work permit and passport details on renewal.
- **Profile change requests:** an inbox for the requests employees send from their profile.
- **Announcements:** post and edit the notes from HR.
- HR never acts on their own record: their own balance and allowance are set by another HR person, and their own leave and punch fixes go through their HOD like anyone else's. The server refuses it.
- Out of scope for now: granting the HR or super admin role from the portal (set on the record by the backend team). The work week is fixed in code (`WorkWeek`, `WEEKEND_DAYS`): Saturday to Thursday.

### Exports

- Reports save as **CSV, Excel or PDF**. Spring builds the rows; the browser shows them and saves the same rows (`shared/utils/export.ts`). Excel and PDF use exceljs and jspdf with jspdf-autotable, loaded only when someone exports. Excel keeps every value as plain data, never a formula.
- "Export report" downloads a CSV built in the browser. Every cell is quoted, and cells starting with `=`, `+`, `-` or `@` get a leading apostrophe so a spreadsheet never runs them as formulas.

### Non functional

- English only. Dhivehi is not planned.
- Fully responsive. Phones are a first class target, many staff will check punches and leave on mobile. Checked at 375, 768, 900, 1024 and 1280 px with nothing wider than the screen. On phones, tables turn into stacked rows (each value under its column's name, `class="stacks"` and `data-label` on each cell; a cell says "None" or "Not yet" rather than nothing, and an empty one hides), request rows show their dates, amounts and reasons under the name instead of hiding them, and request tabs scroll on one line. Between 861 and 1100 px the side column sits under the main one.
- Light and dark. The Figma design has no dark version, so dark is generated from the light stylesheets by `scripts/build-dark-theme.mjs` into `src/styles/dark.css`: light surfaces become navy tinted dark ones, text turns light, coloured text is lifted until it reads, and the parts that are dark on purpose (sidebar, staff card, title band, primary buttons) stay as they are. The script reports any text under 4.5:1 against the dark card. Never edit `dark.css` by hand: change the script or the light styles and run `npm run theme:dark`. `npm run check` fails if it is stale.
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

### Visual: the Figma layout, made calm (23 November)
- **Layout and class names** come from the Figma Make file "Opro HRMS Portal" (`design/figma-make/`). Before building a page, read the matching component in `App.tsx` and reuse its class names.
- **The look** was reworked with Parnika on 23 November ("unslop"). Character: steady, exact, sunlit. Chrome stays quiet; the richness goes to two moments, the staff ID card (laminate edge, lanyard slot) and today's punch card, whose times are set large like a time-clock stamp.
- `frontend/src/styles/portal.css` started as the Figma stylesheet and now carries this look. Anything it doesn't cover goes in `src/styles.css` under a comment saying why.
- **One colour ramp.** Light neutrals tinted toward the lagoon: page `#f3f7f6`, card `#ffffff`, subtle `#f8faf9`, raised `#eef2f3`, line `#e6ecee`, strong line `#d9e2e3`, faint `#b3c4ca` (decoration and inactive days only, never text). Three text roles: ink `#16313f`, secondary `#526972`, muted `#606e77`. Navy `#102d3f` (and `#183d50`, `#1e4a5e`) for the sidebar, staff card and title band, with `#ffffff`, `#a9c0c8` and `#7896a1` on it. Don't add a new hex; pick from the ramp.
- **One accent.** Dark aqua `#067a71` for buttons, links, selected states, focus rings and aqua text (5.2:1 with white). Bright aqua `#11ae9e` only for rings, charts and indicators that sit beside text, never under text. Statuses: late `#98640f` on `#fff4dd`, danger `#b44a35` on `#fff0ed`, leave `#6543a5` on `#eee8ff`, info `#25729c` on `#e5f4fb`. Yellow `#ffc85a` and coral `#f27f68` are fills only. Every text colour reaches 4.5:1 on its surface.
- **No** hue gradients, coloured shadows, glows or decorative art. Shadows are neutral and small. Stat icons are neutral; the number carries the card.
- **Spacing** on a 4px grid; **corners** 4, 6, 8, 10, 12, 16 or 20, plus round for avatars and dots.
- **Labels in sentence case**, never uppercase with tracking. The physical ID cards keep their printed uppercase.
- **Motion:** one curve, `--ease` (`cubic-bezier(0.22, 1, 0.36, 1)`), on named properties only, 120 to 300 ms.
- No sparkles: announcements use a megaphone.
- Icons are Lucide shapes stored in `shared/ui/icon-shapes.ts`. Add new ones from Lucide the same way, not a new icon library.
- People without a photo show initials in the same frames.
- Status colour is never the only signal. Always pair it with text or an icon.

### Typography
- Manrope for page titles, headings and big figures, DM Sans for everything else. Both self hosted.
- Weights: 600 for headings and figures, 500 for labels and navigation, 400 for text. Nothing heavier.
- Nothing under 12px (Parnika's call, for reading). Letter spacing 0, except a slight -0.2px on headings from 22px.
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
  TODO.md
  design/figma-make/   # App.tsx and index.css from the Figma Make file. Reference only, not built
  frontend/
    src/styles.css     # Tailwind, fonts, tokens and our additions to the design
    src/styles/portal.css  # The design's stylesheet, started from Figma
    src/app/
      core/            # App wide singletons: auth, layout shell (header, nav, footer), guards, interceptors, config
      shared/ui/       # Pure presentational pieces (logo, icon, status pill, avatar, title band, dialog, month switcher)
      shared/utils/    # Pure helper functions (dates, formatting)
      features/
        dashboard/
        attendance/
        leave/
        holidays/
        documents/
        profile/       # Staff cards, personal details, visa
        team/          # HOD screens, also the super admin's company view
      models/          # Shared TypeScript types mirroring API responses
    public/            # Static assets, robots.txt
    src/testing/       # Test helpers and fixtures, never shipped
    e2e/               # Playwright tests
    netlify/functions/ # The Netlify demo's function, wrapping the mock
    dev-server/        # Mock API (frontend development and the Netlify demo)
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
- Spring Boot is the only layer between the browser and the data. Do not add a separate BFF: Spring is it. Each screen gets what it shows, counted and grouped on the server, never a pile of records for the browser to add up (the dashboard and reports are the model).

### Mock server

- `frontend/dev-server/server.mjs` uses only Node built ins. It serves the JSON in `dev-server/data/` and keeps changes in memory until restart.
- **One toggle:** `USE_MOCK_BACKEND`. Unset (the default) sends `/api` to Spring on port 8080, so every screen reads the database. `true` sends it to the mock on port 4300, for the Netlify demo, the second e2e run and frontend work without Java. Nothing else changes.
- Never change a URL or add a branch in app code to support mocking. If the mock needs a code change, fix the mock.
- When a new endpoint is added, add its mock route and fixture in the same change. When the real backend changes a response shape, update the mock immediately.
- Keep the mock dumb: realistic fixtures, no business logic.
- **Netlify demo:** `netlify.toml` deploys the frontend with the mock as a Netlify function (`frontend/netlify/functions/mock-api.mjs`, which calls the mock's exported `handle`). There, and only there, `MOCK_STATELESS_SESSIONS` lets the session cookie name the person, so a fresh function copy still knows them. Made up data only; never point it at real data.

### API contract (v1)

The full, generated reference is Swagger UI at `http://localhost:8080/swagger-ui.html` when Spring runs on the dev profile (springdoc, off everywhere else). Every controller carries a `@Tag` with a plain description; add one to any new controller. This table is the summary.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/session/users` | Mock login picker (dev only) |
| POST | `/api/session/login` | Mock login, sets session cookie |
| POST | `/api/session/logout` | Clears session |
| GET | `/api/me` | Logged in employee profile, roles and visa (absent for nationals) |
| GET | `/api/people` | Everyone working at Opro today, for search: `id`, `fullName`, `designation`, `department`, `email`, `photoUrl` only |
| GET | `/api/attendance?month=YYYY-MM` | Own daily records. Each punch carries where it was made in `device` (an office, "Home", or an old device's name). Days punched from the portal carry `workMode`, and home days `homeStatus` |
| POST | `/api/attendance/punch` | Punch now: `mode` (`office`, `resort` or `home`), plus `latitude`, `longitude` and `accuracy` for an office or resort. Returns today |
| GET / POST | `/api/attendance/corrections` | Own correction requests / raise one (`date`, `kind`, `category`: resort, forgot, late or other, `requestedTime`, `reason` for late and other) |
| GET | `/api/leave/types` | Leave types from the policy, retired ones included with `retiredOn`. `isUnlimited` marks types with no balance, like unpaid. `noticeDays` is how far ahead a new request is made |
| GET | `/api/leave/balances` | Own balances for their current leave year, with `carriedOver`, `takenToDate` (approved days up to today) and, for comp off, `expiresOn` |
| GET / POST | `/api/leave/requests` | Own requests / apply (`type`, `from`, `to`, `halfDay`, `reason`, `kind`: initial, amended or extended with `relatedRequestId`, `usesFlightEntitlement`, `wantsSalaryAdvance`) |
| POST | `/api/leave/requests/:id/cancel` | Cancel own request |
| GET | `/api/holidays?year=YYYY` | Public holidays |
| POST | `/api/profile/change-requests` | Ask HR to change personal details |
| GET | `/api/announcements` | Company announcements |
| GET | `/api/events?year=YYYY` | Company events for the calendar |
| GET | `/api/documents` | Every document type that applies to them, with their copy's `status`, dates and any `decisionNote` |
| PUT | `/api/documents/:type/file?issuedOn=&expiresOn=` | Upload one file of an own copy (raw body, 5 MB max) of a type employees send. Same dates add a page, new ones make a new copy |
| GET / DELETE | `/api/documents/:type/files/:fileId` | Download one file / take it off (until HR verifies the copy) |
| GET | `/api/notifications` | Own notifications |
| POST | `/api/notifications/read` | Mark all own notifications read |
| GET | `/api/team` | Direct reports with today's attendance and visa |
| GET | `/api/team/:id` | One report's profile, visa and leave balances |
| GET | `/api/team/attendance?month=YYYY-MM` | Reports' daily records |
| GET | `/api/team/leave-requests?status=` | Reports' leave requests |
| POST | `/api/team/leave-requests/:id/decision` | Approve or reject |
| GET | `/api/team/corrections?status=` | Reports' correction requests |
| POST | `/api/team/corrections/:id/decision` | Approve or reject. Approving adds the punch to the record, the same way an HR punch fix does |
| GET | `/api/team/home-days?status=` | Reports' days worked from home |
| GET / POST | `/api/team/comp-offs?status=`, `/api/team/comp-offs/:id/decision` | Reports' days off worked, with `workedMinutes` and the `days` they earn / decide one |
| GET / POST | `/api/team/overtime?status=`, `/api/team/overtime/:id/decision` | Reports' overtime, with `minutes` (approved, or what the punches show now) / approve, or reject with a `note` |
| POST | `/api/team/home-days/:id/decision` | Approve or reject. Rejecting needs a `note` and makes the day an absence |
| GET / POST | `/api/company/...` | Super admins only. Every `/api/team` route (people, one person, attendance, leave requests, corrections, home days, comp offs, overtime and their decisions) with everyone in scope instead of direct reports. Spring serves both from one `/api/{scope:team|company}` mapping. Never decides their own |
| GET | `/api/hr/employees` | Everyone, with today's attendance and visa. HR only, like every `/api/hr` route |
| GET | `/api/hr/employees/:id` | One person's profile, visa, leave balances and balance adjustments |
| PUT | `/api/hr/employees/:id/visa` | Add or update visa, work permit and passport (last 4 only) |
| GET | `/api/hr/attendance?employeeId=&month=YYYY-MM` | One person's daily records |
| GET | `/api/hr/leave-requests?status=` | Every leave request, read only |
| POST | `/api/hr/balance-adjustments` | Add or remove days with a reason (`employeeId`, `type`, `days`, `reason`) |
| GET | `/api/hr/approvals` | What the HOD approved and HR approves too, by kind (`leave`, `corrections`, `homeDays`, `compOffs`, `overtime`), never the reader's own |
| POST | `/api/hr/approvals/:kind/:id/decision` | HR's step (`kind` is `leave`, `corrections`, `home-days`, `comp-offs` or `overtime`): `approved`, or `rejected` with a `note` |
| GET / PUT | `/api/hr/approval-rules` | Whether HR approves after the HOD (`punchFixes`, `homeDays`, `compOff`, `overtime`). Leave types carry `needsHrApproval` |
| POST / PUT / DELETE | `/api/hr/leave-types`, `/api/hr/leave-types/:code` | Add a type / change its rules (`name`, `allowsHalfDay`, `isUnlimited`, `defaultEntitlement`, `isForEveryone`, `carriesForward`, `carryForwardCap`, `needsHrApproval`) / remove it (deleted if unused, otherwise retired) |
| PUT | `/api/hr/employees/:id/leave/:code` | Set one person's days of a type this year (`days`, `reason`). Also gives a type to just them |
| POST | `/api/hr/employees/:id/leave/:code/remove` | Take a type away from one person (`reason`) |
| GET | `/api/flights` | Own flight allowance this year, used, waiting, HR's rates and every claim |
| POST | `/api/flights/claims` | Claim a flight (`flightDate`, `route`, `amount`, `currency`) |
| PUT / GET | `/api/flights/claims/:id/receipt` | Attach (raw body, 5 MB max) or open the receipt on an own claim |
| POST | `/api/flights/claims/:id/cancel` | Cancel an own claim still waiting |
| GET | `/api/hr/flight-claims/:id/receipt` | Open any receipt |
| GET / PUT | `/api/hr/employees/:id/flights`, `/api/hr/employees/:id/flight-allowance` | One person's flight year / set their allowance (`year`, `amountUsd`) |
| PUT | `/api/hr/exchange-rates` | MVR and INR per USD (`mvr`, `inr`) |
| POST / PUT / DELETE | `/api/hr/holidays`, `/api/hr/holidays/:id` | Manage holidays. Confirming a tentative one notifies everyone |
| POST | `/api/hr/holidays/start-year` | Add the fixed civil holidays to a year (`year`) |
| POST / PUT / DELETE | `/api/hr/events`, `/api/hr/events/:id` | Manage company events |
| GET | `/api/hr/change-requests` | Profile change requests |
| GET / POST | `/api/performance`, `/api/performance/appraisals/:id/accept` | Own goals, `entries` and `form` (the plan's `status`) in the open cycle, appraisals (without recommendations) and probation reviews / accept the rating |
| PUT / PUT / POST | `/api/performance/goals`, `/api/performance/sections/:section`, `/api/performance/submit` | Write own goals (`goals`: `title`, `measure`, `weight`, adding to 100) / write one section (`section`: certification, learning, accomplishment or strength; `entries`: `title`, `details`, `targetOn` for certifications) / send the whole plan to the HOD |
| GET | `/api/{team,company}/performance` | Direct reports (or everyone with an HOD, for a super admin) with probation dates, their HOD's name, goals, entries, `form` and appraisal in the open cycle |
| POST / POST / POST | `/api/{team,company}/performance/:id/decision`, `.../appraisal`, `.../probation-review` | Approve their plan, or send it back with a `note` / appraise (`rating`, `comments`, `recommendsPromotion`, `incrementPercent`, `goals`: `goalId`, `rating`, `comment`, `selfReviewComment`) / review probation (`outcome`, `extendedTo`, `comments`) |
| GET / POST / POST | `/api/hr/performance`, `/api/hr/appraisal-cycles`, `/api/hr/appraisal-cycles/:id/close` | Cycles, the latest one's progress and every probation review / open a cycle (`name`, `dueOn`) / close it |
| POST | `/api/hr/performance/:id/decision` | HR's step on a plan the HOD approved: `approved`, or `rejected` with a `note`. Never their own |
| GET | `/api/insights/dashboard`, `/api/insights/reports/:kind?year=&month=&by=` | HR and super admins only: the executive dashboard's figures / one report's `title`, `fileName`, `columns` and `rows` (`kind`: headcount, movement, mix, balances, leave, attendance or papers; `by` groups the mix). Spring counts and groups them, so the browser gets only what the page shows |
| GET / PUT | `/api/profile/record`, `/api/profile/bank-account` | Own record (bank shown as last 4) / enter bank details for HR to verify (`bankName`, `accountName`, `accountNumber`, `currency`) |
| GET | `/api/hr/employees/:id/record` | One person's insurance, bank details (full number), education and experience |
| PUT / DELETE | `/api/hr/employees/:id/insurance` | Set (`provider`, `policyNumber`, `expiresOn`) or remove someone's medical insurance |
| POST / DELETE | `/api/hr/employees/:id/education`, `.../education/:entryId`, `/api/hr/employees/:id/experience`, `.../experience/:entryId` | Add or remove a qualification or a past job |
| GET / POST | `/api/hr/bank-accounts`, `/api/hr/employees/:id/bank-account/decision` | Bank details waiting for HR / `verified`, or `rejected` with a `note` |
| GET / POST / PUT / DELETE | `/api/hr/quotas`, `/api/hr/quotas/:id` | Expatriate quota approvals with `used` counted per job category |
| GET / POST / PUT / DELETE | `/api/hr/document-types`, `/api/hr/document-types/:code` | HR's document list / add (`name`, `uploadedBy`, `hasExpiry`, `isForExpatriatesOnly`, `remindDaysBefore`, `isForEveryone`) / change / remove (deleted if unused, otherwise retired) |
| GET | `/api/hr/documents` | Uploads waiting for HR, oldest first, never the reader's own |
| GET | `/api/hr/documents/to-collect` | Everyone with something missing, sent back or expired, and what |
| POST / DELETE | `/api/hr/employees/:id/document-types/:type` | Ask one person for a type not for everyone / stop asking |
| GET | `/api/hr/employees/:id/documents` | One person's documents |
| PUT | `/api/hr/employees/:id/documents/:type/file?issuedOn=&expiresOn=` | Upload one file for them, counted as verified |
| GET / DELETE | `/api/hr/employees/:id/documents/:type/files/:fileId` | Open one file / take it off |
| POST | `/api/hr/employees/:id/documents/:type/decision` | `verified`, or `rejected` with a `note` |
| POST | `/api/hr/change-requests/:id/decision` | `done` or `declined` with a `note` |
| POST / PUT / DELETE | `/api/hr/announcements`, `/api/hr/announcements/:id` | Manage announcements. A new one notifies everyone |
| POST | `/api/hr/employees` | Add a person. The server sets the ID and roles, and seeds balances |
| PUT | `/api/hr/employees/:id` | Edit details and `managerId` |
| POST / DELETE | `/api/hr/employees/:id/leaving` | Set a last day with a reason / take it back before it passes. Refused while someone who resigned still has an item out. `?include=former` on the list adds people who have left |
| GET | `/api/onboarding` | Own onboarding (204 when not onboarding): first day, HOD, buddy and every task |
| POST / DELETE | `/api/onboarding/:employeeId/items/:itemId/done` | Tick or untick a task. Only its owner: the joiner, their HOD, or HR (never their own) |
| GET / PUT | `/api/team/onboarding`, `/api/team/onboarding/:employeeId/buddy` | Reports still onboarding / pick a buddy (`buddyId`) |
| GET / GET / POST / PUT | `/api/hr/onboarding`, `/api/hr/employees/:id/onboarding`, same, `.../onboarding/first-day` | Everyone still onboarding / one person's (204 when none) / start it by hand / set the first day (`time` HH:MM, `place`, `contact`) |
| GET / POST / DELETE | `/api/hr/onboarding-tasks`, `/api/hr/onboarding-tasks/:id` | HR's task list / add one (`name`, `owner`: hr, hod or joiner, `dueInDays`) / remove one |
| GET / GET | `/api/allowances`, `/api/allowance-types` | Own monthly allowances and one-off grants / the kinds of allowance, retired ones with `retiredOn` |
| GET / POST | `/api/team/allowance-grants` | One-off grants the HOD's reports have had / grant one (`employeeId`, `type`, `amount`, `currency`: MVR or USD, `reason`) |
| GET / PUT / POST | `/api/hr/employees/:id/allowances`, `.../allowances/:type`, `.../allowances/:type/stop` | Someone's allowances / set a monthly one (`amount`, `currency`, `startsOn` on the 1st, `note`) / stop one after a month (`lastMonth`: YYYY-MM). Never their own |
| GET / POST | `/api/hr/allowance-grants`, `/api/hr/allowance-grants/:id/decision` | One-off grants waiting for HR, never the reader's own / `approved`, or `rejected` with a `note` |
| POST / DELETE | `/api/hr/allowance-types`, `/api/hr/allowance-types/:code` | Add a kind (`name`) / remove one (deleted if unused, otherwise retired) |
| GET / POST | `/api/resignation`, `/api/resignation/:id/withdraw` | Own resignations, newest first, with the checklist once accepted / resign (`reason`, `releaseOn`) / withdraw one still waiting |
| GET / POST | `/api/{team,company}/resignations?status=`, `.../:id/decision` | The HOD's step on reports' resignations (`approved`, or `rejected` with a `note`) |
| GET / POST | `/api/hr/resignations`, `/api/hr/resignations/:id/decision` | Resignations waiting for HR, never the reader's own / `approved` with an `exitOn`, or `rejected` with a `note` |
| GET | `/api/hr/employees/:id/exit` | Their accepted resignation with the checklist. 204 when they haven't resigned |
| PUT / DELETE | `/api/hr/employees/:id/exit/items/:itemId` | Tick an item off (`outcome`: `returned` or `not-given`) / untick it |
| GET / POST / DELETE | `/api/hr/exit-items`, `/api/hr/exit-items/:id` | HR's list of what comes back / add one (`name`) / remove one |
| PUT / DELETE | `/api/hr/employees/:id/photo` | Upload (raw JPEG body, 1 MB max) or remove a photo |
| GET | `/api/employees/:id/photo` | A photo, for anyone signed in. URLs carry a version, so they cache forever |
| GET / POST / DELETE | `/api/hr/schedules`, `/api/hr/schedules/:id` | Work schedule versions / add one from a future date / cancel one not yet started |
| PUT | `/api/leave/requests/:id/certificate` | Attach a medical certificate to own sick leave (raw body, 5 MB max) |
| GET | `/api/leave/requests/:id/certificate`, `/api/hr/leave-requests/:id/certificate` | Open a certificate: own, or any for HR. Never for managers |

### Files
- Photos, medical certificates, receipts and documents are stored in PostgreSQL (`stored_file`) for now, so they share transactions and backups with the rest. Moving to object storage later only touches the `files` package.
- Every upload is the raw request body, read through `Upload.read`: allowed type, size limit (photos 1 MB JPEG; certificates, receipts and documents 5 MB PDF, JPG or PNG), and the first bytes must match the type. Anything else is refused before it is stored.
- Every file is served by `Files.serve` with `nosniff` and `Content-Security-Policy: sandbox`. Photo URLs carry a version and cache for good; certificates and documents are never cached.

### Backend conventions
- Java 25 LTS, Spring Boot 4.1, PostgreSQL 18, Maven with its wrapper. Spring Boot's parent POM pins library versions; don't override one without a reason written beside it.
- One package per feature (`employee`, `leave`, `attendance`...), mirroring `frontend/src/app/features`. Controllers stay thin and talk to a feature service.
- Records for request and response shapes, named to match the frontend's models field for field. Entities are classes with getters, no setters the API doesn't need.
- Constructor injection, package private where possible. No Lombok.
- Every error leaves as `{"message": "..."}`, written for the person reading it. Throw `ApiException` with a status for refusals people can act on. Never send stack traces or internal details.
- Bean Validation on every request body. The frontend's checks are for comfort, these are the real ones. `ApiErrors` puts a broken rule into words ("Currency has to be MVR or USD."); a rule's own `message` reads after the field's name.
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
- Pages use the design's own classes from `portal.css` (`card`, `card-heading`, `eyebrow`, `status-pill`, `primary-button`, `page-view`, `page-title` and so on), written as the Figma markup uses them.
- **Tailwind CSS v4** is for small layout gaps the design classes don't cover. Its tokens in `src/styles.css` map onto the same ramp.
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

- The only frontend env variable that changes behaviour is `USE_MOCK_BACKEND`, read by `proxy.conf.mjs` at dev time. The rest pick ports (`MOCK_PORT`, `SPRING_PORT`) or the e2e backend (`E2E_BACKEND`). Document any new variable in `HOW-TO-RUN.md`.
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
- The e2e journeys run against the mock and against Spring on a throwaway database. A difference between them is a bug in the mock.
- GitHub Actions (`.github/workflows/ci.yml`) runs the backend build, the frontend checks and both e2e runs on every pull request and push to `main`.

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
| E2E against Spring | `npm run test:e2e:spring` (throwaway database, needs Docker) |
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
- [ ] `npm run test:e2e` and `npm run test:e2e:spring` affected journeys passing (each starts its own backend)
- [ ] Dead code scan on all touched files
- [ ] `npm run test:coverage` meets 80%

And inside `backend/` when it changed (Docker Desktop running):

- [ ] `./mvnw verify` builds with no new warnings and every test passes

If any step fails, stop, fix it and rerun that step before moving on.

**Always include the Final Checks Checklist results in the summary.**
