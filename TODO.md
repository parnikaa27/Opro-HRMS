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
