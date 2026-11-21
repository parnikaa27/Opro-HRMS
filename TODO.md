# To do

What's left before Opro HRMS can go live, and what's waiting on someone. Kept up to date with every change: add what comes up, remove what's done.

## Before launch

- [ ] **Microsoft sign in (Entra ID SSO).** To discuss with Parnika. People are matched to their employee record by their Microsoft email; roles (HR, super admin) and HODs are mapped by hand. Until then the only sign in is the dev "pick a user" screen, which exists only in the `dev` profile, so a production server has no way in.
- [ ] **Where the backend runs.** Netlify can't run Spring Boot or PostgreSQL. Options: Azure App Service with Azure Database for PostgreSQL (fits Microsoft 365 and Entra), or Render or Railway.
- [ ] **Production database and backups.** Managed PostgreSQL 18, automatic backups, and a restore that has actually been tried.
- [ ] **Security headers on the app.** A strict Content Security Policy, `X-Frame-Options`, `Referrer-Policy` and HSTS wherever the frontend is served. Files already get `nosniff` and a sandbox policy.
- [ ] **Domain and HTTPS.** The session cookie is `Secure`, so the portal only works over HTTPS.
- [ ] **Turn the Netlify demo off**, or put it behind a password, once real people use the real portal.

## Gaps found testing every journey (19 November)

Walked through by hand as Arjun (expatriate employee), Vikram (HOD), Ananya (HR) and Rajesh (super admin), against Spring on a fresh database, and every page at phone width. The 48 automated journeys pass on the mock and on Spring; these are what they don't catch.

**Rules that are missing**
- [ ] Leave can be booked on a day the person punched in, which counts that day twice. Parnika chose any day in the leave year; refusing days with punches is a small change if wanted.
- [ ] Waiting requests never expire or escalate (Parnika: nothing for now). A leave day already past (Rohit, 18 November) still waits, and the HOD gets no reminder.
- [ ] No cover when an HOD is away: only a super admin can step in. Consider an acting HOD for a date range.

**Wording and display**
- [ ] When the server's own validation catches something, the message reads like code: `currency must match "MVR|USD"`, `dateOfBirth must be a past date`. The forms stop most of these first, but every message should be written for a person.
- [ ] On phones, empty table cells show a heading with nothing under it (Recommends, Read on HR's Performance page). Say "None" or "Not yet".
- [ ] "Health insurance" is both a document employees upload and the medical insurance HR keeps on the record. Keep one.
- [ ] The dev document list asks expatriates for a National ID. Goes away with the real list.
- [ ] Employees can't look up a colleague: search finds people only for HODs, HR and super admins.

**Missing for go live**
- [ ] Importing people in bulk, with leave already used this year, visas and bank details, from HR's current spreadsheets. Adding everyone one at a time isn't realistic.

## From the meeting with Madhu (19 November)

Being built in batches, one PR each. Leave, documents, exit, the performance changes, allowances and onboarding are done (see Leave below, and Documents, Leaving Opro, Performance, Allowances and Onboarding in CLAUDE.md). Still to come:
- [ ] **Recruitment:** needs its own conversation first.

## Demo

- [ ] **Publish the Netlify demo**: connect the repository on Netlify (steps in `HOW-TO-RUN.md`). It needs your Netlify account, so it's yours to do. Add the site password if the link shouldn't be open.

## Waiting on information from Parnika

- [ ] **Office and resort locations.** The pins and radii in `backend/src/main/resources/application.yml` are placeholders. Office punches fail at the real office until they're right.
- [ ] **Leave rules**, checked against the Maldives Employment Act: days per type (annual 30, sick 30, family 10, maternity 60, paternity 3), when a medical certificate is needed (after 2 days), and carry forward (every type lapses today).
- [ ] **Attendance rules:** shift 9 to 5, 15 minutes' grace, half day under 4 hours.
- [ ] **The document list:** each document's name, who uploads it, whether it expires (and how many days ahead to remind), and whether everyone, only expatriates, or people HR picks need it. HR enters it in Policies. The dev data has placeholders.
- [ ] **Visa copy reminders twice over:** a visa copy that expires on the same day as the visa record reminds once for each. Fine if the copy is the proof HR wants renewed too; otherwise make the visa copy a type that doesn't expire.
- [ ] **Exchange rates:** MVR 15.42 and INR 88 per USD are starting values. HR can change them in Policies.
- [ ] **Footer:** legal name, address, HR email, and the Privacy and HR policy links in `frontend/src/app/core/config.ts`.
- [ ] **Overtime:** 30 minutes past the shift is the placeholder minimum, and whether overtime is paid (at what rate) or taken as time off. Payroll needs the rate.
- [ ] **Performance:** the 1 to 5 scale and its words, and whether appraisals should rate company competencies too. Accepting a rating is required with no way to disagree; if staff ever need to record a disagreement, that's a small change.
- [ ] **Leave notice:** the paper form asks a month ahead for scheduled leave. Set "Asked for (days ahead)" on annual leave in Policies, and on any other type that needs it. Nothing has notice until then.
- [ ] **Flight entitlement and salary advance ticks on leave requests:** today they're shown to the HOD and HR only. Should ticking the flight box start a flight claim, and who acts on a salary advance before payroll exists?
- [ ] **Leaving without resigning** (a contract ending, a dismissal): today the return checklist only applies to someone who resigned. Should HR tick items off for everyone who leaves? And is there a minimum notice period between resigning and the last day?
- [ ] **Allowances:** the real list of kinds and who gets how much, and whether any one-off grants HR makes directly (today only an HOD grants them).
- [ ] **Onboarding:** the real task list, and whether tasks for IT (email, system access) should wait for Microsoft sign in. Today there's no IT role, so the HOD owns the laptop and desk.
- [ ] **Minimum age:** 18 by the joining date is a placeholder. Confirm against the Employment Act.
- [ ] **Comp off for super admins:** today they earn none for working a Friday or a holiday, because nobody is above them to approve it.

## Later, if needed

- [ ] A second HR approver. If the only HR person asks for something that needs HR after the HOD, nobody can give that approval.
- [ ] Granting the HR or super admin role from the portal. Today it's set in the database.
- [ ] Moving files (photos, certificates, receipts, documents) from PostgreSQL to object storage. Only the `files` package changes.
- [ ] A designed dark theme, if the designer sends one. Today's is generated from the light styles.

## From "HR Software Requirements for Maldives" (received 18 November 2026)

What the document asks for, against what's built. "Done" means built and tested; "Partly" says what's missing.

**Decided on 18 November**
- Build order: **foundations first** (employee record, Maldives compliance, executive dashboard, reports, people alerts), then the other modules. The record, compliance and alerts are built, and so are the executive dashboard and reports (CSV, Excel and PDF) for HR and super admins. Overtime and HR's approval step are built too. **Next: the modules, payroll first**.
- **Overtime comes back**: worked out from punches beyond the shift and approved by the HOD, ready for payroll. Done: time after the shift ends, from 30 minutes, raised by itself, working days only (days off keep earning comp off).
- **Biometric devices stay out** until there's a device make and model to integrate with. Punching stays in the portal.
- **Approvals become chains HR can set** for each kind of request. Done on 19 November as one optional step: HR approves after the HOD, set per leave type and for punch fixes, home days, comp off and overtime.
- **Email is the first alert channel**, through Opro's Microsoft 365, so it's tied to Microsoft sign in. SMS and a native app come later.

**1. Executive dashboard**
- Done: workforce (headcount, joiners, leavers, attrition, retention, locals and expatriates, gender, employment type, age, departments, nationalities), attendance today and this month, leave (waiting, annual used, sick trend), compliance (expired and expiring papers, quota use), birthdays, anniversaries, probation and contract endings. For HR and super admins.
- Not yet: business travel, shift status, overtime (built, not on the dashboard yet), and the recruitment, payroll, training and engagement sections (they arrive with their modules).

**2. Employee information**
- Done: profile with gender, date of birth and employment type, emergency contact, passport (last 4 digits), work permit and visa, medical insurance, bank details (entered by the person, verified by HR), education, work experience, documents repository with HR checks.

**3. Recruitment**: not started (vacancy approval, job posting, career portal, resume database, applicant tracking, interviews, evaluation, offer letters, joining checklist).

**4. Onboarding**
- Done: employee number generation, document collection.
- Done since: an onboarding checklist HR keeps, with tasks for HR, the HOD and the joiner, first-day details, a buddy, and progress for HR. Probation reviews are in Performance.
- Not yet: email creation and system access (needs Microsoft 365), induction training (comes with learning and development).

**5. Attendance**
- Done: GPS punching from the office, a resort or home, mobile friendly, late arrivals, breaks.
- Done since: overtime, approved by the HOD.
- Not yet: biometric integration (clash above), shift scheduling and rosters (one company schedule today), early departure.

**6. Leave**
- Done: all the listed types (HR adds any type, emergency leave included), approval by the HOD, calendar, balances.
- Done on 19 November, from the meeting with Madhu: leave years from each person's joining date, compensatory off valid for 14 days, a balance table (this year, carried forward, approved, taken so far, waiting, left), and the paper form's fields (new, amended or extended application, flight entitlement and salary advance ticks, notice per type, the days marked and the return date).
- Done since: HR can approve after the HOD.

**7. Payroll**: not started (salary structure in USD and MVR, allowances, overtime, deductions, advances, loans, final settlement, payslips, bank transfer files, reports). Needs the Maldives pension and income tax rules and each bank's file format confirmed.

**8. Performance**
- Done: probation reviews, appraisal cycles HR opens, goals with measures and weights, HOD appraisals rated 1 to 5, promotion and increment recommendations, a performance section on the dashboard.
- Done since: goals and KPIs the employee writes (approved by the HOD, then HR), a self review (accomplishments, strengths, learning and development, certifications) the HOD comments on, and accepting the rating.
- Not yet: 360° feedback, company competencies to rate against, acting on recommendations (needs payroll), a performance report.

**9. Learning and development**: not started (calendar, nominations, attendance, feedback, certificates, hours, competency matrix).

**10. HR letters**
- Done: uploading and storing documents.
- Not yet: generating letters from templates (offer, contract, confirmation, promotion, salary revision, transfer, warning, experience, relieving, NOC) and an HR policies library.

**11. Visa and immigration**
- Done: work permit and visa tracking, employment approval tracking, expatriate quota by job category with slots used, and alerts at 60, 30 and 7 days and on the day for visa, passport, work permit medical, employment approval and medical insurance.
- Not yet: quota expiry and "quota full" alerts (shown on the Visas page today, not sent).

**12. Employee self service**
- Done: apply for leave, attendance records, ask HR to change details, flight claims.
- Not yet: payslips, downloading generated letters, general HR requests, training calendar, other expense claims.

**13. Manager self service**
- Done: approve leave, punch fixes and home days, team dashboard, team attendance export.
- Done since: approve overtime.
- Done since: appraisals and probation reviews.
- Not yet: recruitment requests, wider reports.

**14. Reports**
- Done: headcount, joiners and leavers (attrition and turnover), workforce mix by department, nationality, gender, age or employment type, leave balances, leave taken, attendance, visa and permit expiry. Each as CSV, Excel or PDF.
- Not yet: an overtime report (the data exists now), and recruitment, payroll, salary cost, budget vs actual, training and performance (with their modules).

**15. Workflows**
- Partly: leave, punch fixes, home days, comp off and overtime (the HOD, then HR where Policies say so), and document checks.
- Not yet: recruitment, promotion, salary revision, expense, travel and resignation approvals, steps beyond HR (the HOD's own HOD, a named person).

**16. Notifications**
- Done: in-app notifications, visa, passport, medical, approval and insurance reminders, contract and probation endings, birthdays and work anniversaries, leave decisions.
- Not yet: payroll and training reminders. Email (decided first), SMS and a mobile app as channels.

**17. Security**
- Done: role-based access enforced on the server, logs of HR's changes, XSRF protection, secure sessions.
- Not yet: multi-factor authentication (comes with Microsoft sign in), encryption at rest and backups (with hosting), a log of every user's activity.

**18. Integrations**: not started (biometric devices, accounting or ERP, bank payroll files, Microsoft 365 email, Outlook calendar, Teams, a mobile app, a public API).

**19. Maldives compliance**
- Done: Maldives public holidays with tentative Islamic dates, the Saturday to Thursday week, custom work schedules, visa lifecycle.
- Done since: expatriate quota, employment approval tracking, medical and insurance reminders.
- Done since: local vs expat reporting (dashboard and workforce mix report).
- Not yet: Employment Act compliance reports, once HR says which ones the Ministry asks for.

**20. Executive KPIs**: workforce, attendance, leave, compliance, turnover and diversity are on the dashboard. Performance is on it too. Recruitment, payroll and learning come with their modules.
