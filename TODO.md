# To do

What's left before Opro HRMS can go live, and what's waiting on someone. Kept up to date with every change: add what comes up, remove what's done.

## Before launch

- [ ] **Microsoft sign in (Entra ID SSO).** To discuss with Parnika. People are matched to their employee record by their Microsoft email; roles (HR, super admin) and HODs are mapped by hand. Until then the only sign in is the dev "pick a user" screen, which exists only in the `dev` profile, so a production server has no way in.
- [ ] **Where the backend runs.** Netlify can't run Spring Boot or PostgreSQL. Options: Azure App Service with Azure Database for PostgreSQL (fits Microsoft 365 and Entra), or Render or Railway.
- [ ] **Production database and backups.** Managed PostgreSQL 18, automatic backups, and a restore that has actually been tried.
- [ ] **Security headers on the app.** A strict Content Security Policy, `X-Frame-Options`, `Referrer-Policy` and HSTS wherever the frontend is served. Files already get `nosniff` and a sandbox policy.
- [ ] **Domain and HTTPS.** The session cookie is `Secure`, so the portal only works over HTTPS.
- [ ] **Turn the Netlify demo off**, or put it behind a password, once real people use the real portal.

## Demo

- [ ] **Publish the Netlify demo**: connect the repository on Netlify (steps in `HOW-TO-RUN.md`). It needs your Netlify account, so it's yours to do. Add the site password if the link shouldn't be open.

## Waiting on information from Parnika

- [ ] **Office and resort locations.** The pins and radii in `backend/src/main/resources/application.yml` are placeholders. Office punches fail at the real office until they're right.
- [ ] **Leave rules**, checked against the Maldives Employment Act: days per type (annual 30, sick 30, family 10, maternity 60, paternity 3), when a medical certificate is needed (after 2 days), and carry forward (every type lapses today).
- [ ] **Attendance rules:** shift 9 to 5, 15 minutes' grace, half day under 4 hours.
- [ ] **The document list:** each document's name, who uploads it, whether it expires, and whether only expatriates need it. HR enters it in Policies. The dev data has placeholders.
- [ ] **Exchange rates:** MVR 15.42 and INR 88 per USD are starting values. HR can change them in Policies.
- [ ] **Footer:** legal name, address, HR email, and the Privacy and HR policy links in `frontend/src/app/core/config.ts`.
- [ ] **Comp off for super admins:** today they earn none for working a Friday or a holiday, because nobody is above them to approve it.

## Later, if needed

- [ ] Granting the HR or super admin role from the portal. Today it's set in the database.
- [ ] Moving files (photos, certificates, receipts, documents) from PostgreSQL to object storage. Only the `files` package changes.
- [ ] A designed dark theme, if the designer sends one. Today's is generated from the light styles.

## From "HR Software Requirements for Maldives" (received 18 November 2026)

What the document asks for, against what's built. "Done" means built and tested; "Partly" says what's missing.

**Decided on 18 November**
- Build order: **foundations first** (employee record, Maldives compliance, executive dashboard, reports, people alerts), then the other modules. The record, compliance and alerts are built, and so are the executive dashboard and reports (CSV, Excel and PDF) for HR and super admins. **Next: overtime, approval chains, then the modules (payroll first)**.
- **Overtime comes back**: worked out from punches beyond the shift and approved by the HOD, ready for payroll.
- **Biometric devices stay out** until there's a device make and model to integrate with. Punching stays in the portal.
- **Approvals become chains HR can set** for each kind of request. Today's single HOD step is the default.
- **Email is the first alert channel**, through Opro's Microsoft 365, so it's tied to Microsoft sign in. SMS and a native app come later.

**1. Executive dashboard**
- Done: workforce (headcount, joiners, leavers, attrition, retention, locals and expatriates, gender, employment type, age, departments, nationalities), attendance today and this month, leave (waiting, annual used, sick trend), compliance (expired and expiring papers, quota use), birthdays, anniversaries, probation and contract endings. For HR and super admins.
- Not yet: business travel, shift status, overtime, and the recruitment, payroll, performance, training and engagement sections (they arrive with their modules).

**2. Employee information**
- Done: profile with gender, date of birth and employment type, emergency contact, passport (last 4 digits), work permit and visa, medical insurance, bank details (entered by the person, verified by HR), education, work experience, documents repository with HR checks.

**3. Recruitment**: not started (vacancy approval, job posting, career portal, resume database, applicant tracking, interviews, evaluation, offer letters, joining checklist).

**4. Onboarding**
- Done: employee number generation, document collection.
- Not yet: email creation and system access (needs Microsoft 365), welcome kit, orientation, induction training, probation tracking.

**5. Attendance**
- Done: GPS punching from the office, a resort or home, mobile friendly, late arrivals, breaks.
- Not yet: biometric integration (clash above), shift scheduling and rosters (one company schedule today), early departure, overtime (clash above).

**6. Leave**
- Done: all the listed types (HR adds any type, emergency leave included), approval by the HOD, calendar, balances.
- Not yet: multi-level approval (clash above).

**7. Payroll**: not started (salary structure in USD and MVR, allowances, overtime, deductions, advances, loans, final settlement, payslips, bank transfer files, reports). Needs the Maldives pension and income tax rules and each bank's file format confirmed.

**8. Performance**: not started (goals, KPIs, probation review, annual appraisal, 360° feedback, ratings, promotion and increment recommendations).

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
- Not yet: approve overtime (clash above), appraisals, recruitment requests, wider reports.

**14. Reports**
- Done: headcount, joiners and leavers (attrition and turnover), workforce mix by department, nationality, gender, age or employment type, leave balances, leave taken, attendance, visa and permit expiry. Each as CSV, Excel or PDF.
- Not yet: recruitment, payroll, salary cost, budget vs actual, training, performance, overtime (with their modules).

**15. Workflows**
- Partly: leave, punch fixes, home days, comp off and document checks, all single level.
- Not yet: recruitment, promotion, salary revision, expense, travel and resignation approvals, multi-level chains.

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

**20. Executive KPIs**: workforce, attendance, leave, compliance, turnover and diversity are on the dashboard. Recruitment, payroll, performance and learning come with their modules.
