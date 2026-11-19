// Mock of the Spring API for frontend development. Node built ins only, state lives in memory until restart.
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { addDays, buildAttendance, clockNow, decideHomeDay, maldivesNow, punchNow, rebuildDay, toMinutes } from './attendance.mjs';

const PORT = Number(process.env.MOCK_PORT ?? 4300);
const MAX_BODY_BYTES = 10_000;
// Compensatory off is taken within this many days of the day worked.
const COMP_OFF_VALID_DAYS = 14;
const SESSION_COOKIE = 'opro_session';
const XSRF_COOKIE = 'XSRF-TOKEN';
// The Netlify demo runs this file as a function that can restart at any time, losing every session in memory.
// There the session cookie names who signed in, so a fresh start still knows them. Only acceptable because
// everyone in the mock is made up and the sign in is "pick a user" anyway.
const SESSIONS_SURVIVE_RESTARTS = process.env.MOCK_STATELESS_SESSIONS === 'true';

const load = (name) => JSON.parse(readFileSync(new URL(`./data/${name}.json`, import.meta.url), 'utf8'));

const db = {
  employees: load('employees'),
  visas: load('visas'),
  leaveTypes: load('leave-types'),
  leaveBalances: load('leave-balances'),
  leaveRequests: load('leave-requests'),
  holidays: load('holidays').map((holiday, index) => ({ id: `HD-${index + 1}`, ...holiday })),
  events: load('events'),
  corrections: load('corrections'),
  announcements: load('announcements'),
  notifications: load('notifications'),
  changeRequests: load('change-requests'),
  adjustments: load('balance-adjustments'),
  schedules: load('schedules'),
  flightAllowances: load('flight-allowances'),
  flightClaims: load('flight-claims'),
  rates: load('exchange-rates'),
  documentTypes: load('document-types'),
  records: load('records'),
  compOffs: [],
  // The two late days in Spring's dev seed, with the minutes Spring works out from its fixed punches.
  overtime: load('overtime'),
  performance: load('performance'),
  // Which requests HR approves after the HOD. Leave types carry their own needsHrApproval.
  approvalRules: { punchFixes: false, homeDays: false, compOff: false, overtime: false },
  receipts: new Map(),
  // Uploaded files live in memory like everything else, keyed by employee or request.
  photos: new Map(),
  certificates: new Map(),
  documentFiles: new Map(),
};
db.attendance = buildAttendance(db);
// The approvals that go with the generated days worked from home.
db.homeDays = db.attendance
  .filter(({ workMode }) => workMode === 'home')
  .map(({ employeeId, date, homeStatus }) => ({ id: `HW-${employeeId}-${date}`, employeeId, date, status: homeStatus }));

const longDate = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const sessions = new Map();
const FRIDAY = 5;
const FIX_CATEGORIES = ['resort', 'forgot', 'late', 'other'];
const SENT = Symbol('sent');

// The smallest valid PDF: one page with one line of text. Only plain ASCII names are used, so no escaping beyond parentheses.
const samplePdf = (line) => {
  const text = line.normalize('NFD').replace(/[^\x20-\x7e]/g, '').replace(/[()\\]/g, '');
  const stream = `BT /F1 14 Tf 72 760 Td (${text}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let body = '%PDF-1.4\n';
  const offsets = objects.map((object, index) => {
    const offset = body.length;
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}`;
  return `${body}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
};

// The same people's documents Spring seeds: their contract, visa or national ID papers, and insurance waiting for HR.
// Each has one file, served as a sample PDF.
const seedDocuments = (employees, visas) => employees.flatMap((employee) => {
  const visa = visas.find(({ employeeId }) => employeeId === employee.id);
  const copy = (type, fields) => ({
    employeeId: employee.id, type, status: 'verified', issuedOn: employee.joinedOn, files: [{ id: `DF-${employee.id}-${type}`, uploadedOn: employee.joinedOn }], ...fields,
  });
  return [
    copy('employment-contract', { updatedOn: employee.joinedOn }),
    ...(visa ? [copy('visa-copy', { issuedOn: visa.visaIssuedOn, expiresOn: visa.visaExpiry }), copy('passport-copy', { expiresOn: visa.passportExpiry })] : []),
    ...(employee.nationality === 'Maldivian' ? [copy('national-id', {})] : []),
    copy('health-insurance', { updatedOn: '2026-02-05', issuedOn: '2026-02-01', status: 'pending' }),
  ];
});
db.documents = seedDocuments(db.employees, db.visas);
// Types not for everyone reach only the people HR asks.
db.askedFor = [{ type: 'marriage-certificate', employeeId: 'OPR-0015' }];
// What HR collects back before someone leaves, and resignations with what's been ticked off.
db.exitItems = [{ id: 'EI-1', name: 'Laptop' }, { id: 'EI-2', name: 'ID card' }, { id: 'EI-3', name: 'Bus travel card' }, { id: 'EI-4', name: 'Accommodation keys' }];
db.resignations = [];

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const today = () => maldivesNow().date;
const nameOf = (employeeId) => db.employees.find(({ id }) => id === employeeId)?.fullName;
const withName = (item) => ({
  ...item,
  employeeName: nameOf(item.employeeId),
  ...(item.decidedBy && { decidedByName: nameOf(item.decidedBy) }),
  ...(item.hodApprovedBy && { hodApprovedByName: nameOf(item.hodApprovedBy) }),
});
// Photos are versioned in the URL, so a new one is never hidden behind a cached old one.
const profileOf = (employee) => ({
  ...employee,
  visa: db.visas.find(({ employeeId }) => employeeId === employee.id),
  ...(db.photos.has(employee.id) && { photoUrl: `/api/employees/${employee.id}/photo?v=${db.photos.get(employee.id).version}` }),
});
// Someone past their last day keeps their records but drops out of every live list.
const isActive = (employee) => !employee.lastDay || employee.lastDay >= today();
const activeEmployees = () => db.employees.filter(isActive);
const reportsOf = (user) => activeEmployees().filter(({ managerId }) => managerId === user.id);
// Manager access follows from having reports, so changing a reporting line updates it.
const withRoles = (employee) => ({ ...employee, roles: [...employee.roles.filter((role) => role !== 'MANAGER'), ...(reportsOf(employee).length ? ['MANAGER'] : [])] });

const requireManager = (user) => {
  if (!user.roles.includes('MANAGER')) {
    throw new HttpError(403, 'Managers only');
  }
  return new Set(reportsOf(user).map(({ id }) => id));
};

const byStatus = (status) => (item) => !status || item.status === status;
const inMonth = (month) => (record) => !month || record.date.startsWith(month);

const requireHr = (user) => {
  if (!user.roles.includes('HR')) {
    throw new HttpError(403, 'HR only');
  }
};

const requireSuperAdmin = (user) => {
  if (!user.roles.includes('SUPER_ADMIN')) {
    throw new HttpError(403, 'Super admins only');
  }
};

const requireInsights = (user) => {
  if (!user.roles.includes('HR') && !user.roles.includes('SUPER_ADMIN')) {
    throw new HttpError(403, 'HR and super admins only');
  }
};

// An HOD's direct reports, or everyone for a super admin, who can step in on any decision.
const peopleIn = (user, scope) => {
  if (scope === 'company') {
    requireSuperAdmin(user);
    return activeEmployees();
  }
  requireManager(user);
  return reportsOf(user);
};
const idsIn = (user, scope) => new Set(peopleIn(user, scope).map(({ id }) => id));

const notifyEveryone = (kind, text) => {
  db.notifications = [
    ...activeEmployees().map(({ id }) => ({ id: `NT-${randomUUID().slice(0, 6)}`, employeeId: id, kind, text, createdOn: today(), isRead: false })),
    ...db.notifications,
  ];
};

const notify = (employeeId, kind, text) => {
  db.notifications = [{ id: `NT-${randomUUID().slice(0, 6)}`, employeeId, kind, text, createdOn: today(), isRead: false }, ...db.notifications];
};

// Notifications read like a person wrote them: "Tuesday 10 November", "5:20 PM", "3 days of sick leave".
const clockFormat = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
const sayTime = (time) => clockFormat.format(new Date(`2000-01-01T${time}:00Z`));
const sayDate = (date) => longDate.format(new Date(`${date}T00:00:00Z`));
// A date in another year says the year, so a far off one is never mistaken for a near one.
const otherYearFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const sayDateFromToday = (date) => (date.slice(0, 4) === today().slice(0, 4) ? sayDate(date) : otherYearFormat.format(new Date(`${date}T00:00:00Z`)));
const sayDates = ({ from, to }) => (from === to ? sayDate(from) : `${sayDate(from)} to ${sayDate(to)}`);
const sayDays = (days) => `${Math.abs(days)} ${Math.abs(days) === 1 ? 'day' : 'days'}`;
const typeName = (code) => db.leaveTypes.find((type) => type.code === code)?.name.toLowerCase() ?? code;
const sentence = (text) => (/[.!?]$/.test(text) ? text : `${text}.`);

const findOr404 = (collection, id, what) => {
  const item = db[collection].find((entry) => entry.id === id);
  if (!item) {
    throw new HttpError(404, `${what} not found`);
  }
  return item;
};

const replaceIn = (collection, updated) => {
  db[collection] = db[collection].map((entry) => (entry.id === updated.id ? updated : entry));
  return updated;
};

const removeFrom = (collection, id, what) => {
  findOr404(collection, id, what);
  db[collection] = db[collection].filter((entry) => entry.id !== id);
  return undefined;
};

const appliesTo = (type, employee) =>
  !type.retiredOn && (type.isForEveryone
    ? employee.nationality !== 'Maldivian' || !type.isForExpatriatesOnly
    : db.askedFor.some((entry) => entry.type === type.code && entry.employeeId === employee.id));

// Every type that applies to them, plus anything they hold of a retired one, with missing and expired worked out.
const documentEntries = (employee) => {
  const held = db.documents.filter(({ employeeId }) => employeeId === employee.id);
  return [...db.documentTypes]
    .sort((first, second) => first.sortOrder - second.sortOrder || first.name.localeCompare(second.name))
    .map((type) => ({ type, document: held.find((entry) => entry.type === type.code) }))
    .filter(({ type, document }) => document || appliesTo(type, employee))
    .map(({ type, document }) => documentView(type, document));
};
const documentView = (type, document) => ({
  type: type.code, name: type.name, uploadedBy: type.uploadedBy, hasExpiry: type.hasExpiry, isForEveryone: type.isForEveryone, files: [],
  ...(document && { ...document, employeeName: nameOf(document.employeeId) }),
  status: !document ? 'missing' : document.status === 'verified' && document.expiresOn && document.expiresOn < today() ? 'expired' : document.status,
});
const activeDocumentType = (code) => {
  const type = db.documentTypes.find((entry) => entry.code === code && !entry.retiredOn);
  if (!type) {
    throw new HttpError(404, 'Document type not found');
  }
  return type;
};
const heldDocument = (employeeId, code) => {
  const document = db.documents.find((entry) => entry.employeeId === employeeId && entry.type === code);
  if (!document) {
    throw new HttpError(404, 'Document not found');
  }
  return document;
};
// One file at a time. Same dates add a page to the copy on file; new ones make a new copy that replaces its files.
// An employee's own upload waits for HR. HR's counts as verified, and the person is told.
const uploadDocument = ({ by, owner, code, file, issuedOn, expiresOn }) => {
  const type = activeDocumentType(code);
  const isOwn = by.id === owner.id;
  if (isOwn && (type.uploadedBy !== 'employee' || !appliesTo(type, owner))) {
    throw new HttpError(403, `HR adds your ${type.name.toLowerCase()}.`);
  }
  if (!DATE.test(String(issuedOn)) || issuedOn > today()) {
    throw new HttpError(400, "Enter the date it starts. It can't be after today.");
  }
  if (type.hasExpiry && !(DATE.test(String(expiresOn)) && expiresOn > today())) {
    throw new HttpError(400, 'Enter the date it expires. It has to be after today.');
  }
  const expires = type.hasExpiry ? expiresOn : undefined;
  const held = db.documents.find((entry) => entry.employeeId === owner.id && entry.type === code);
  const isSameCopy = held && held.issuedOn === issuedOn && held.expiresOn === expires;
  const added = { id: `DF-${randomUUID().slice(0, 8)}`, uploadedOn: today() };
  const document = {
    employeeId: owner.id, type: code, status: isOwn ? 'pending' : 'verified', updatedOn: today(), issuedOn, ...(expires && { expiresOn: expires }),
    files: [...(isSameCopy ? held.files : []), added],
  };
  db.documents = [...db.documents.filter((entry) => entry !== held), document];
  db.documentFiles.set(added.id, file);
  if (!isOwn) {
    notify(owner.id, 'record', `HR added your ${type.name.toLowerCase()}.`);
  }
  return documentView(type, document);
};
// Someone takes their own file off until HR verifies the copy; HR takes any off. The last one takes the copy with it.
const removeDocumentFile = ({ by, owner, code, fileId }) => {
  const document = heldDocument(owner.id, code);
  if (!document.files.some(({ id }) => id === fileId)) {
    throw new HttpError(404, 'File not found');
  }
  if (by.id === owner.id && document.status === 'verified') {
    throw new HttpError(409, 'HR has verified this, so ask HR to take a file off.');
  }
  const kept = { ...document, files: document.files.filter(({ id }) => id !== fileId) };
  db.documents = db.documents.filter((entry) => entry !== document).concat(kept.files.length ? [kept] : []);
  return documentView(db.documentTypes.find((type) => type.code === code), kept.files.length ? kept : undefined);
};
const sendDocument = (res, employee, code, fileId) => {
  const type = db.documentTypes.find((entry) => entry.code === code);
  if (!heldDocument(employee.id, code).files.some(({ id }) => id === fileId)) {
    throw new HttpError(404, 'File not found');
  }
  const uploaded = db.documentFiles.get(fileId);
  if (uploaded) {
    return sendFile(res, uploaded, type.name);
  }
  // A one page sample PDF for the seeded copies, named the way Spring names real documents.
  res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${type.name}.pdf"` });
  res.end(samplePdf(`${type.name} for ${employee.fullName}`));
  return SENT;
};
// A resignation as the portal shows it: names filled in, and the checklist once it's approved.
const resignationView = (resignation) => ({
  ...resignation,
  employeeName: nameOf(resignation.employeeId),
  ...(resignation.hodApprovedBy && { hodApprovedByName: nameOf(resignation.hodApprovedBy) }),
  ...(resignation.decidedBy && { decidedByName: nameOf(resignation.decidedBy) }),
  checklist: resignation.status === 'approved'
    ? db.exitItems.map(({ id, name }) => ({ itemId: id, name, ...(resignation.ticks?.[id] && { outcome: resignation.ticks[id].outcome, tickedOn: resignation.ticks[id].tickedOn }) }))
    : [],
});
// Ticks an item off (returned or not-given), or unticks it. HR never on their own.
const tickExitItem = (user, employeeId, itemId, outcome) => {
  requireHr(user);
  if (employeeId === user.id) {
    throw new HttpError(403, 'Another HR person handles your own exit.');
  }
  const resignation = approvedResignationOf(employeeId);
  if (!resignation) {
    throw new HttpError(404, "They haven't resigned.");
  }
  if (!db.exitItems.some(({ id }) => id === itemId) || (outcome !== undefined && !['returned', 'not-given'].includes(outcome))) {
    throw new HttpError(404, 'Item not found');
  }
  const { [itemId]: _dropped, ...kept } = resignation.ticks ?? {};
  return replaceResignation({ ...resignation, ticks: outcome ? { ...kept, [itemId]: { outcome, tickedOn: today() } } : kept });
};
const approvedResignationOf = (employeeId) => db.resignations.find((entry) => entry.employeeId === employeeId && entry.status === 'approved');
const stillOutFor = (employeeId) => {
  const resignation = approvedResignationOf(employeeId);
  return resignation ? resignationView(resignation).checklist.filter(({ outcome }) => !outcome).map(({ name }) => name) : [];
};
const hrBut = (employeeId) => activeEmployees().filter((employee) => employee.roles.includes('HR') && employee.id !== employeeId);
const replaceResignation = (changed) => {
  db.resignations = db.resignations.map((entry) => (entry.id === changed.id ? changed : entry));
  return resignationView(changed);
};
const rejectResignation = (user, resignation, note) => {
  const clean = String(note ?? '').trim();
  if (!clean) {
    throw new HttpError(400, 'Give a short reason so they know where they stand.');
  }
  notify(resignation.employeeId, 'record', `${user.fullName} didn't accept your resignation: ${sentence(clean)} Talk to them about what happens next.`);
  return replaceResignation({ ...resignation, status: 'rejected', decidedBy: user.id, decidedOn: today(), decisionNote: clean });
};
// They hear the exit date and what to bring back; their HOD hears the date.
const approveResignation = (user, resignation, exitOn) => {
  const bring = db.exitItems.map(({ name }) => name.toLowerCase()).join(', ');
  notify(resignation.employeeId, 'record', `Your resignation was accepted. Your exit date is ${sayDate(exitOn)}.${bring ? ` Before you go, return your ${bring} to HR.` : ''}`);
  const managerId = db.employees.find(({ id }) => id === resignation.employeeId)?.managerId;
  if (managerId && managerId !== user.id) {
    notify(managerId, 'record', `${nameOf(resignation.employeeId)}'s exit date is ${sayDate(exitOn)}.`);
  }
  return replaceResignation({ ...resignation, status: 'approved', decidedBy: user.id, decidedOn: today(), exitOn });
};

// HR never handles their own documents.
const someoneElseForDocuments = (user, id) => {
  if (id === user.id) {
    throw new HttpError(403, 'Another HR person handles your own documents.');
  }
  return findOr404('employees', id, 'Employee');
};
const validDocumentType = (body) => {
  const name = String(body.name ?? '').trim();
  if (!name || !['employee', 'hr'].includes(body.uploadedBy) || typeof body.hasExpiry !== 'boolean' || typeof body.isForExpatriatesOnly !== 'boolean') {
    throw new HttpError(400, 'Give it a name, who uploads it, and whether it expires');
  }
  return {
    name, uploadedBy: body.uploadedBy, hasExpiry: body.hasExpiry, isForExpatriatesOnly: body.isForExpatriatesOnly,
    remindDaysBefore: Number(body.remindDaysBefore ?? 30), isForEveryone: body.isForEveryone !== false,
  };
};
const checkDocumentName = (name, code) => {
  if (db.documentTypes.some((type) => !type.retiredOn && type.code !== code && type.name.toLowerCase() === name.toLowerCase())) {
    throw new HttpError(409, "There's already a document called that.");
  }
};

// The rest of someone's record. The full account number goes to HR only; everyone else sees the last 4.
const bankView = (employeeId, account, isFull) => {
  const { accountNumber, ...rest } = account;
  return { employeeId, employeeName: nameOf(employeeId), ...rest, ...(isFull && { accountNumber }), accountLast4: accountNumber.slice(-4) };
};
const recordOf = (employeeId, isFullBank) => {
  const bank = db.records.bankAccounts[employeeId];
  const withoutOwner = ({ employeeId: _owner, ...entry }) => entry;
  return {
    ...(db.records.insurance[employeeId] && { insurance: db.records.insurance[employeeId] }),
    ...(bank && { bankAccount: { ...bankView(employeeId, bank, isFullBank), employeeName: undefined } }),
    education: db.records.education.filter((entry) => entry.employeeId === employeeId).sort((first, second) => second.completedYear - first.completedYear).map(withoutOwner),
    experience: db.records.experience.filter((entry) => entry.employeeId === employeeId).sort((first, second) => second.from.localeCompare(first.from)).map(withoutOwner),
  };
};
// HR never changes their own record.
const someoneElse = (user, id) => {
  requireHr(user);
  if (id === user.id) {
    throw new HttpError(403, 'Another HR person handles your own record.');
  }
  return findOr404('employees', id, 'Employee').id;
};
// Used slots are counted from the active expatriates in that job category, never stored.
const quotaView = (quota) => ({
  ...quota,
  used: activeEmployees().filter((employee) => employee.nationality !== 'Maldivian' && employee.jobCategory?.trim().toLowerCase() === quota.jobCategory.trim().toLowerCase()).length,
});
const validQuota = (body) => {
  const slots = Number(body.slots);
  if (!String(body.jobCategory ?? '').trim() || !Number.isInteger(slots) || slots < 1 || !String(body.approvalNumber ?? '').trim() || !DATE.test(String(body.approvedOn)) || !DATE.test(String(body.expiresOn))) {
    throw new HttpError(400, 'Give the job category, slots, approval number and dates');
  }
  if (body.expiresOn <= body.approvedOn) {
    throw new HttpError(400, 'The expiry has to come after the approval date.');
  }
  return { jobCategory: body.jobCategory.trim(), slots, approvalNumber: body.approvalNumber.trim(), approvedOn: body.approvedOn, expiresOn: body.expiresOn };
};

const pick = (body, keys) => Object.fromEntries(keys.filter((key) => body[key] !== undefined).map((key) => [key, body[key]]));

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_GRACE_MINUTES = 60;
const MAX_REASON = 300;

const requireReason = (body) => {
  const reason = String(body.reason ?? '').trim();
  if (!reason || reason.length > MAX_REASON) {
    throw new HttpError(400, 'A short reason is required');
  }
  return reason;
};

// The same checks Spring would run on a new schedule version.
const validSchedule = (body) => {
  const times = ['shiftStart', 'shiftEnd'];
  if (!times.every((key) => TIME.test(String(body[key] ?? '')))) {
    throw new HttpError(400, 'Times must look like 09:00');
  }
  const shiftLength = toMinutes(body.shiftEnd) - toMinutes(body.shiftStart);
  const grace = Number(body.graceMinutes);
  const halfDay = Number(body.halfDayMinutes);
  if (shiftLength <= 0) {
    throw new HttpError(400, 'A shift has to end after it starts');
  }
  if (!Number.isInteger(grace) || grace < 0 || grace > MAX_GRACE_MINUTES || !Number.isInteger(halfDay) || halfDay <= 0 || halfDay >= shiftLength) {
    throw new HttpError(400, 'Grace or half day is out of range');
  }
  if (!DATE.test(String(body.effectiveFrom)) || body.effectiveFrom <= today()) {
    throw new HttpError(400, 'A new schedule can only start after today');
  }
  return { ...pick(body, ['effectiveFrom', ...times]), graceMinutes: grace, halfDayMinutes: halfDay };
};

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const EMPLOYEE_ID_PREFIX = 'OPR-';
const EMPLOYEE_ID_DIGITS = 4;
const MAX_FIELD = 120;
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// The fields HR can set. Anything else in the body is ignored, the way a Spring DTO would.
const EMPLOYMENT_TYPES = ['Permanent', 'Contract', 'Casual', 'Intern'];
const validEmployee = (body, id) => {
  const text = (value) => String(value ?? '').trim();
  const fields = ['fullName', 'designation', 'department', 'email', 'phone', 'nationality', 'workLocation'];
  const details = Object.fromEntries(fields.map((key) => [key, text(body[key])]));
  const contact = { name: text(body.emergencyContact?.name), relation: text(body.emergencyContact?.relation), phone: text(body.emergencyContact?.phone) };
  if ([...Object.values(details), ...Object.values(contact)].some((value) => !value || value.length > MAX_FIELD)) {
    throw new HttpError(400, 'Every field is needed');
  }
  if (!EMAIL.test(details.email) || db.employees.some((employee) => employee.email.toLowerCase() === details.email.toLowerCase() && employee.id !== id)) {
    throw new HttpError(409, 'That email is already in use');
  }
  if (!DATE.test(String(body.joinedOn)) || !BLOOD_GROUPS.includes(body.bloodGroup)) {
    throw new HttpError(400, 'Check the joining date and blood group');
  }
  if (!['male', 'female'].includes(body.gender) || !DATE.test(String(body.dateOfBirth)) || body.dateOfBirth >= today() || !EMPLOYMENT_TYPES.includes(body.employmentType)) {
    throw new HttpError(400, 'Check the gender, date of birth and employment type');
  }
  if ([body.probationEndsOn, body.contractEndsOn].some((end) => end && end <= body.joinedOn)) {
    throw new HttpError(400, 'Probation and contract end dates come after the joining date.');
  }
  const optional = Object.fromEntries(['probationEndsOn', 'contractEndsOn', 'jobCategory'].filter((key) => text(body[key])).map((key) => [key, text(body[key])]));
  return {
    ...details, employmentType: body.employmentType, gender: body.gender, dateOfBirth: body.dateOfBirth, ...optional,
    joinedOn: body.joinedOn, bloodGroup: body.bloodGroup, emergencyContact: contact, ...(body.managerId && { managerId: String(body.managerId) }),
  };
};

// Everyone but a super admin reports to someone: active, and never the person or anyone below them.
const checkManager = (employee, managerId) => {
  if (!managerId) {
    if (employee.roles.includes('SUPER_ADMIN')) {
      return;
    }
    throw new HttpError(400, 'Pick their reporting manager.');
  }
  const below = (id) => db.employees.filter((entry) => entry.managerId === id).flatMap((entry) => [entry.id, ...below(entry.id)]);
  const manager = activeEmployees().find(({ id }) => id === managerId);
  if (!manager || managerId === employee.id || below(employee.id).includes(managerId)) {
    throw new HttpError(400, 'Pick a manager who is active and not one of their reports');
  }
};

const punchMinutesOf = (record) => record.punches.map(({ at }) => toMinutes(at.slice(11, 16)));

// Punches are never overwritten: a missing one is added or a wrong one voided, and the day is worked out again.
const editPunch = ({ employeeId, date, action, time }) => {
  const record = db.attendance.find((entry) => entry.employeeId === employeeId && entry.date === date);
  if (!record || date > today()) {
    throw new HttpError(404, 'No attendance for that day');
  }
  if (!TIME.test(time) || !['add', 'void'].includes(action)) {
    throw new HttpError(400, 'Say which punch time to add or void');
  }
  const minutes = punchMinutesOf(record);
  const minute = toMinutes(time);
  if (action === 'add' && minutes.includes(minute)) {
    throw new HttpError(409, 'There is already a punch at that time');
  }
  if (action === 'void' && !minutes.includes(minute)) {
    throw new HttpError(404, 'No punch at that time');
  }
  const next = action === 'add' ? [...minutes, minute] : minutes.filter((entry) => entry !== minute);
  const rebuilt = rebuildDay({ record, punchMinutes: next, schedules: db.schedules });
  db.attendance = db.attendance.map((entry) => (entry === record ? rebuilt : entry));
};

const decisionText = (collection, { status, decisionNote, ...item }) => {
  const outcome = status === 'approved' ? 'was approved.' : `was declined: ${sentence(decisionNote ?? 'no reason given')}`;
  return collection === 'corrections'
    ? `Your punch fix for ${sayDate(item.date)} ${outcome}${status === 'approved' ? ` The ${sayTime(item.requestedTime)} punch is now on your record.` : ''}`
    : `Your ${typeName(item.type)} for ${sayDates(item)} ${outcome}`;
};

// An approved fix adds its punch. If the punch is already there, or the day is older than the mock's history,
// there is nothing left to change.
const applyFix = (correction) => {
  // A late punch moves their punch in: the late one is voided first, then the real time is added.
  const record = db.attendance.find((entry) => entry.employeeId === correction.employeeId && entry.date === correction.date);
  const first = record && punchMinutesOf(record)[0];
  if (correction.category === 'late' && first !== undefined && first > toMinutes(correction.requestedTime)) {
    editPunch({ employeeId: correction.employeeId, date: correction.date, action: 'void', time: record.punches[0].at.slice(11, 16) });
  }
  try {
    editPunch({ employeeId: correction.employeeId, date: correction.date, action: 'add', time: correction.requestedTime });
  } catch (error) {
    if (!(error instanceof HttpError) || ![404, 409].includes(error.status)) {
      throw error;
    }
  }
};

// A day worked from home: the decision lands on the day itself, and a declined one counts as absent.
const homeDecisionText = (user, { status, decisionNote, date }) =>
  status === 'approved'
    ? `${user.fullName} approved working from home on ${sayDate(date)}.`
    : `${user.fullName} didn't approve working from home on ${sayDate(date)}, so it counts as absent: ${sentence(decisionNote ?? 'no reason given')}`;

const RULE_FOR = { corrections: 'punchFixes', homeDays: 'homeDays', compOffs: 'compOff', overtime: 'overtime' };
const NOTICE_KIND = { leaveRequests: 'leave', corrections: 'correction', homeDays: 'home', compOffs: 'leave', overtime: 'overtime' };
const needsHr = (collection, item) =>
  collection === 'leaveRequests' ? Boolean(db.leaveTypes.find(({ code }) => code === item.type)?.needsHrApproval) : db.approvalRules[RULE_FOR[collection]];
const whatFor = (collection, item) => ({
  leaveRequests: () => `${typeName(item.type)} for ${sayDates(item)}`,
  corrections: () => `punch fix for ${sayDate(item.date)}`,
  homeDays: () => `day working from home on ${sayDate(item.date)}`,
  compOffs: () => `compensatory off for working on ${sayDate(item.date)}`,
  overtime: () => `${sayDuration(overtimeView(item).minutes)} of overtime on ${sayDate(item.date)}`,
})[collection]();
const viewOf = (collection, item) => (collection === 'compOffs' ? compOffView(item) : collection === 'overtime' ? overtimeView(item) : withName(item));

// The HOD step, never for themselves. When HR approves after the HOD, an approval passes it to HR, unless the HOD is HR.
const decide = (collection, user, scope, id, body) => {
  const ids = idsIn(user, scope);
  const item = db[collection].find((entry) => entry.id === id && entry.employeeId !== user.id && ids.has(entry.employeeId));
  if (!item) {
    throw new HttpError(404, 'Request not found');
  }
  if (item.status !== 'pending' || !['approved', 'rejected'].includes(body.decision)) {
    throw new HttpError(409, 'This request has already been decided');
  }
  if (item.hodApprovedBy) {
    throw new HttpError(409, 'Their HOD approved this. It now waits for HR.');
  }
  if (collection === 'overtime' && body.decision === 'approved' && !overtimeView(item).minutes) {
    throw new HttpError(409, 'Their punches that day no longer show half an hour past the shift. Decline it, or fix their punches.');
  }
  if (body.decision === 'approved' && needsHr(collection, item) && !user.roles.includes('HR')) {
    const passed = { ...item, hodApprovedBy: user.id, hodApprovedOn: today() };
    db[collection] = db[collection].map((entry) => (entry.id === id ? passed : entry));
    const what = whatFor(collection, item);
    notify(item.employeeId, NOTICE_KIND[collection], `${user.fullName} approved your ${what}. It now waits for HR.`);
    activeEmployees()
      .filter((employee) => employee.roles.includes('HR') && employee.id !== item.employeeId)
      .forEach((hr) => notify(hr.id, 'approval', `${user.fullName} approved ${nameOf(item.employeeId)}'s ${what}. It needs HR too. Decide it from Inbox.`));
    return viewOf(collection, passed);
  }
  return finishDecision(collection, user, item, body);
};

// The HR step: only what the HOD passed on, never their own.
const decideForHr = (collection, user, id, body) => {
  requireHr(user);
  const item = db[collection].find((entry) => entry.id === id && entry.status === 'pending' && entry.hodApprovedBy);
  if (!item) {
    throw new HttpError(404, 'Nothing waiting for HR with that id');
  }
  if (item.employeeId === user.id) {
    throw new HttpError(403, 'Your own requests go to another HR person.');
  }
  if (body.decision === 'rejected' && !String(body.note ?? '').trim()) {
    throw new HttpError(400, 'Give a short reason so they know what to do next.');
  }
  return finishDecision(collection, user, item, body);
};

const finishDecision = (collection, user, item, { decision, note }) => {
  const id = item.id;
  if (collection === 'corrections' && decision === 'approved') {
    applyFix(item);
    raiseOvertime(item.employeeId, item.date);
  }
  const decided = { ...item, status: decision, decidedBy: user.id, decidedOn: today(), ...(note && { decisionNote: String(note) }) };
  db[collection] = db[collection].map((entry) => (entry.id === id ? decided : entry));
  if (collection === 'leaveRequests' && decision === 'approved') {
    replaceAmended(item);
  }
  if (collection === 'compOffs') {
    if (decision === 'approved') {
      const earned = compOffView(item).days;
      const held = (db.leaveBalances[item.employeeId] ?? []).find(({ type }) => type === 'comp-off');
      setEntitled(item.employeeId, 'comp-off', (held?.entitled ?? 0) + earned, addDays(item.date, COMP_OFF_VALID_DAYS));
      logAdjustment(item.employeeId, 'comp-off', earned, `Worked on ${sayDate(item.date)}`, user.id);
      db.compOffs = db.compOffs.map((entry) => (entry.id === id ? { ...entry, days: earned } : entry));
    }
    notify(item.employeeId, 'leave', decision === 'approved'
      ? `${user.fullName} approved ${sayDays(compOffView(decided).days)} of compensatory off for working on ${sayDate(item.date)}. Take it by ${sayDate(addDays(item.date, COMP_OFF_VALID_DAYS))}, or it's gone.`
      : `${user.fullName} didn't give compensatory off for working on ${sayDate(item.date)}: ${sentence(String(note ?? 'no reason given'))}`);
    return compOffView(db.compOffs.find((entry) => entry.id === id));
  }
  if (collection === 'overtime') {
    const minutes = overtimeView(item).minutes;
    if (decision === 'approved') {
      db.overtime = db.overtime.map((entry) => (entry.id === id ? { ...entry, minutes } : entry));
    }
    notify(item.employeeId, 'overtime', decision === 'approved'
      ? `${user.fullName} approved ${sayDuration(minutes)} of overtime on ${sayDate(item.date)}.`
      : `${user.fullName} didn't approve overtime on ${sayDate(item.date)}: ${sentence(String(note ?? 'no reason given'))}`);
    return overtimeView(db.overtime.find((entry) => entry.id === id));
  }
  if (collection === 'homeDays') {
    db.attendance = db.attendance.map((entry) => (entry.employeeId === item.employeeId && entry.date === item.date ? decideHomeDay(entry, decision) : entry));
    notify(item.employeeId, 'home', homeDecisionText(user, decided));
    return withName(decided);
  }
  notify(item.employeeId, collection === 'corrections' ? 'correction' : 'leave', decisionText(collection, decided));
  return withName(decided);
};

// An approved amendment replaces the request it amends.
const replaceAmended = ({ kind, relatedRequestId }) => {
  if (kind === 'amended') {
    db.leaveRequests = db.leaveRequests.map((entry) => (entry.id === relatedRequestId && ['pending', 'approved'].includes(entry.status) ? { ...entry, status: 'cancelled' } : entry));
  }
};

// Approved days still to come aren't taken yet.
const takenToDate = (employeeId, { type, taken }) =>
  taken - db.leaveRequests.filter((entry) => entry.employeeId === employeeId && entry.type === type && entry.status === 'approved' && entry.from > today()).reduce((sum, { days }) => sum + days, 0);

// Retired types drop out of everyone's balances. Their history stays.
const balancesOf = (employeeId) =>
  (db.leaveBalances[employeeId] ?? [])
    .filter(({ type }) => !db.leaveTypes.find((entry) => entry.code === type)?.retiredOn)
    .map((balance) => ({ carriedOver: 0, takenToDate: takenToDate(employeeId, balance), ...balance }));

const setEntitled = (employeeId, type, entitled, expiresOn) => {
  const balances = db.leaveBalances[employeeId] ?? [];
  db.leaveBalances = {
    ...db.leaveBalances,
    [employeeId]: balances.some((balance) => balance.type === type)
      ? balances.map((balance) => (balance.type === type ? { ...balance, entitled, ...(expiresOn && { expiresOn }) } : balance))
      : [...balances, { type, entitled, taken: 0, pending: 0, ...(expiresOn && { expiresOn }) }],
  };
};

const logAdjustment = (employeeId, type, days, reason, by) => {
  db.adjustments = [{ id: `BA-${randomUUID().slice(0, 6)}`, employeeId, type, days, reason, by, on: today() }, ...db.adjustments];
};

// Flights are counted in USD. A claim in MVR or INR is converted at HR's rate on the day it's made.
const toUsd = (amount, currency) => Math.round((currency === 'USD' ? amount : amount / db.rates[currency]) * 100) / 100;
const dollars = (usd) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(usd);
const flightTotal = (employeeId, status, year) =>
  db.flightClaims.filter((claim) => claim.employeeId === employeeId && claim.status === status && claim.flightDate.startsWith(String(year))).reduce((sum, claim) => sum + claim.amountUsd, 0);
const flightYearOf = (employeeId) => {
  const year = Number(today().slice(0, 4));
  const allowance = db.flightAllowances.find((entry) => entry.employeeId === employeeId && entry.year === year);
  return {
    year,
    ...(allowance && { allowanceUsd: allowance.amountUsd }),
    usedUsd: flightTotal(employeeId, 'approved', year),
    ratesPerUsd: db.rates,
    claims: db.flightClaims.filter((claim) => claim.employeeId === employeeId).sort((first, second) => second.flightDate.localeCompare(first.flightDate)).map(withName),
  };
};

// A day off worked earns a full day, or half for a short one. The mock reads it off the day's record.
const compOffView = (claim) => {
  const day = db.attendance.find((entry) => entry.employeeId === claim.employeeId && entry.date === claim.date);
  return { ...withName(claim), workedMinutes: day?.workedMinutes ?? 0, days: claim.days ?? (day?.status === 'half-day' ? 0.5 : 1) };
};

// Minutes past the shift: approved, or what the day's record shows now.
const overtimeView = (claim) => {
  const day = db.attendance.find((entry) => entry.employeeId === claim.employeeId && entry.date === claim.date);
  return { ...withName(claim), minutes: claim.minutes ?? day?.overtimeMinutes ?? 0 };
};

const sayDuration = (minutes) => {
  const hours = Math.floor(minutes / 60);
  return hours === 0 ? `${minutes} minutes` : minutes % 60 === 0 ? `${hours}h` : `${hours}h ${minutes % 60}m`;
};

// A working day that shows overtime asks the HOD, once. Super admins have nobody to ask.
const raiseOvertime = (employeeId, date) => {
  const employee = db.employees.find(({ id }) => id === employeeId);
  const day = db.attendance.find((entry) => entry.employeeId === employeeId && entry.date === date);
  if (!employee || employee.roles.includes('SUPER_ADMIN') || !day?.overtimeMinutes || db.overtime.some((entry) => entry.employeeId === employeeId && entry.date === date)) {
    return;
  }
  db.overtime = [{ id: `OT-${employeeId}-${date}`, employeeId, date, status: 'pending' }, ...db.overtime];
  if (employee.managerId) {
    notify(employee.managerId, 'approval', `${employee.fullName} worked ${sayDuration(day.overtimeMinutes)} past the shift on ${sayDate(date)}. Approve the overtime from Leave requests.`);
  }
};

// Performance: the open cycle, goals in a cycle, and an appraisal with the goals it rated, as Spring shapes them.
const openCycle = () => db.performance.cycles.find(({ closedOn }) => !closedOn);
const latestCycle = () => [...db.performance.cycles].sort((first, second) => second.openedOn.localeCompare(first.openedOn))[0];
const goalsOf = (cycleId, employeeId) =>
  db.performance.goals.filter((goal) => goal.cycleId === cycleId && goal.employeeId === employeeId).map(({ id, title, measure, weight, rating, comment }) => ({ id, title, measure, weight, rating, comment }));
const appraisalView = (appraisal) => ({
  ...appraisal,
  cycleName: db.performance.cycles.find(({ id }) => id === appraisal.cycleId)?.name ?? '',
  appraisedByName: nameOf(appraisal.appraisedBy),
  goals: goalsOf(appraisal.cycleId, appraisal.employeeId),
});
// The recommendations are the HOD's advice to HR, so the person's own view leaves them out.
// Someone's part of a cycle: where their goals stand, and their self review.
const formOf = (cycleId, employeeId) => db.performance.forms.find((form) => form.cycleId === cycleId && form.employeeId === employeeId);
const formView = (cycleId, employeeId) => {
  const { cycleId: _cycle, employeeId: _employee, hodApprovedBy, goalsDecidedBy, ...form } = formOf(cycleId, employeeId) ?? { goalsStatus: 'draft' };
  return { ...form, ...(hodApprovedBy && { hodApprovedByName: nameOf(hodApprovedBy) }), ...(goalsDecidedBy && { goalsDecidedByName: nameOf(goalsDecidedBy) }) };
};
const saveForm = (cycleId, employeeId, changes) => {
  const form = { goalsStatus: 'draft', ...formOf(cycleId, employeeId), cycleId, employeeId, ...changes };
  db.performance.forms = [...db.performance.forms.filter((entry) => !(entry.cycleId === cycleId && entry.employeeId === employeeId)), form];
  return form;
};
const requireOwnForm = (user) => {
  if (!user.managerId) {
    throw new HttpError(409, 'You have no HOD to appraise you.');
  }
  const cycle = requireOpenCycle();
  return { cycle, form: formOf(cycle.id, user.id) ?? { goalsStatus: 'draft' } };
};
const finishGoals = (user, cycle, employeeId, body) => {
  if (body.decision !== 'approved') {
    const note = String(body.note ?? '').trim();
    if (!note) {
      throw new HttpError(400, 'Say what to change, so they can fix it.');
    }
    saveForm(cycle.id, employeeId, { goalsStatus: 'rejected', goalsDecidedBy: user.id, goalsDecidedOn: today(), goalsNote: note });
    notify(employeeId, 'performance', `${user.fullName} sent back your goals for ${cycle.name}: ${sentence(note)} Change them on Performance and send them again.`);
    return undefined;
  }
  saveForm(cycle.id, employeeId, { goalsStatus: 'approved', goalsDecidedBy: user.id, goalsDecidedOn: today() });
  notify(employeeId, 'performance', `Your goals for ${cycle.name} are approved.`);
  return undefined;
};
const ownView = (appraisal) => {
  const { recommendsPromotion: _promotion, incrementPercent: _increment, ...rest } = appraisalView(appraisal);
  return rest;
};
const reviewView = (review) => ({ ...review, employeeName: nameOf(review.employeeId), reviewedByName: nameOf(review.reviewedBy) });
const reportOf = (user, employeeId) => {
  requireManager(user);
  const person = reportsOf(user).find(({ id }) => id === employeeId);
  if (!person) {
    throw new HttpError(404, 'Not one of your reports');
  }
  return person;
};
const requireOpenCycle = () => {
  const cycle = openCycle();
  if (!cycle) {
    throw new HttpError(409, 'No appraisal cycle is open. HR opens one.');
  }
  return cycle;
};
const refuseIfAppraised = (cycle, employeeId) => {
  if (db.performance.appraisals.some((appraisal) => appraisal.cycleId === cycle.id && appraisal.employeeId === employeeId)) {
    throw new HttpError(409, `They've already been appraised in ${cycle.name}.`);
  }
};

const MEGABYTE = 1024 * 1024;
// Files are checked by their first bytes, not just the type the browser claims.
const SIGNATURES = {
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47],
  'application/pdf': [0x25, 0x50, 0x44, 0x46],
};
const PHOTO_UPLOAD = { maxBytes: MEGABYTE, types: ['image/jpeg'] };
const CERTIFICATE_UPLOAD = { maxBytes: 5 * MEGABYTE, types: ['image/jpeg', 'image/png', 'application/pdf'] };
const EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'application/pdf': 'pdf' };

const readUpload = async (req, { maxBytes, types }) => {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) {
      throw new HttpError(413, `Files can be up to ${maxBytes / MEGABYTE} MB`);
    }
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  const type = String(req.headers['content-type'] ?? '').split(';')[0].trim();
  const signature = SIGNATURES[type];
  if (!types.includes(type) || !signature || !signature.every((byte, index) => bytes[index] === byte)) {
    throw new HttpError(415, 'That file type isn\'t accepted');
  }
  return { bytes, type };
};

// Served with a sandbox so a file can never run as a page on our origin.
const sendFile = (res, { bytes, type }, name) => {
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': bytes.length,
    'Content-Disposition': `inline; filename="${name}.${EXTENSIONS[type]}"`,
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': 'sandbox',
    'Cache-Control': 'private, max-age=31536000, immutable',
  });
  res.end(bytes);
  return SENT;
};

const routes = [
  ['GET', /^\/api\/session\/users$/, () => activeEmployees().map(withRoles).map(({ id, fullName, designation, roles }) => ({ id, fullName, designation, roles })), { isPublic: true }],
  ['POST', /^\/api\/session\/login$/, ({ body, res }) => {
    if (!activeEmployees().some(({ id }) => id === body.employeeId)) {
      throw new HttpError(400, 'Unknown employee');
    }
    const token = `${body.employeeId}.${randomUUID()}`;
    sessions.set(token, body.employeeId);
    // Secure is left off because the dev proxy runs on plain http. Spring must set it.
    res.appendHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/`);
    return undefined;
  }, { isPublic: true }],
  ['POST', /^\/api\/session\/logout$/, ({ token, res }) => {
    sessions.delete(token);
    res.appendHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
    return undefined;
  }],

  ['GET', /^\/api\/me$/, ({ user }) => profileOf(user)],
  ['POST', /^\/api\/profile\/change-requests$/, ({ user, body }) => {
    const request = { id: `CR-${randomUUID().slice(0, 6)}`, employeeId: user.id, field: String(body.field), details: String(body.details), status: 'open', raisedOn: today() };
    db.changeRequests = [request, ...db.changeRequests];
    return request;
  }],

  ['GET', /^\/api\/attendance$/, ({ user, query }) => db.attendance.filter((record) => record.employeeId === user.id).filter(inMonth(query.get('month')))],
  // Spring checks the distance to an office. The mock only checks a location was sent.
  ['POST', /^\/api\/attendance\/punch$/, ({ user, body }) => {
    const record = db.attendance.find((entry) => entry.employeeId === user.id && entry.date === today());
    if (!record || !['office', 'resort', 'home'].includes(body.mode)) {
      throw new HttpError(400, 'Pick office or home');
    }
    if (body.mode !== 'home' && [body.latitude, body.longitude, body.accuracy].some((value) => typeof value !== 'number')) {
      throw new HttpError(400, `Allow location so we can see you're at the ${body.mode}.`);
    }
    const workMode = record.workMode ?? body.mode;
    if (record.punches.length > 0 && workMode !== body.mode) {
      throw new HttpError(409, `You started today ${workMode === 'home' ? 'working from home' : 'at the office'}. Punch ${record.punches.length % 2 ? 'out' : 'in'} the same way.`);
    }
    const isFirstFromHome = body.mode === 'home' && !db.homeDays.some((entry) => entry.employeeId === user.id && entry.date === today());
    if (isFirstFromHome) {
      const isSuperAdmin = user.roles.includes('SUPER_ADMIN');
      db.homeDays = [{ id: `HW-${user.id}-${today()}`, employeeId: user.id, date: today(), status: isSuperAdmin ? 'approved' : 'pending' }, ...db.homeDays];
      if (user.managerId && !isSuperAdmin) {
        notify(user.managerId, 'approval', `${user.fullName} is working from home today. Approve it from Leave requests.`);
      }
    }
    const isDayOff = new Date(`${today()}T00:00:00Z`).getUTCDay() === FRIDAY || db.holidays.some(({ date }) => date === today());
    // Super admins have nobody to ask, so they don't earn compensatory off.
    if (isDayOff && !user.roles.includes('SUPER_ADMIN') && !db.compOffs.some((entry) => entry.employeeId === user.id && entry.date === today())) {
      db.compOffs = [{ id: `CO-${user.id}-${today()}`, employeeId: user.id, date: today(), status: 'pending' }, ...db.compOffs];
      if (user.managerId) {
        notify(user.managerId, 'approval', `${user.fullName} is working on ${sayDate(today())}, a day off. Give them compensatory off from Leave requests.`);
      }
    }
    const place = { home: 'Home', resort: 'Client resort', office: user.workLocation }[body.mode];
    const homeStatus = body.mode === 'home' ? (db.homeDays.find((entry) => entry.employeeId === user.id && entry.date === today())?.status ?? 'pending') : undefined;
    const punched = punchNow({ record, workMode, place, homeStatus, schedules: db.schedules });
    db.attendance = db.attendance.map((entry) => (entry === record ? punched : entry));
    if (punched.punches.length % 2 === 0) {
      raiseOvertime(user.id, today());
    }
    return punched;
  }],
  ['GET', /^\/api\/attendance\/corrections$/, ({ user }) => db.corrections.filter(({ employeeId }) => employeeId === user.id).map(withName)],
  ['POST', /^\/api\/attendance\/corrections$/, ({ user, body }) => {
    if (!DATE.test(String(body.date)) || body.date > today() || !TIME.test(String(body.requestedTime)) || !['missed-in', 'missed-out'].includes(body.kind) || !FIX_CATEGORIES.includes(body.category)) {
      throw new HttpError(400, 'Say which day, which punch, what time and what happened');
    }
    const reason = String(body.reason ?? '').trim();
    if (['late', 'other'].includes(body.category) && !reason) {
      throw new HttpError(400, 'Say what happened, so your manager can check it.');
    }
    const correction = { id: `AC-${randomUUID().slice(0, 6)}`, employeeId: user.id, date: body.date, kind: body.category === 'late' ? 'missed-in' : body.kind, category: body.category, requestedTime: body.requestedTime, ...(reason && { reason }), status: 'pending', raisedOn: today() };
    // A super admin's fix needs nobody's approval.
    if (user.roles.includes('SUPER_ADMIN')) {
      applyFix(correction);
      db.corrections = [{ ...correction, status: 'approved', decidedBy: user.id, decidedOn: today() }, ...db.corrections];
      return db.corrections[0];
    }
    db.corrections = [correction, ...db.corrections];
    return correction;
  }],

  ['GET', /^\/api\/leave\/types$/, () => db.leaveTypes],
  ['GET', /^\/api\/leave\/balances$/, ({ user }) => balancesOf(user.id)],
  ['GET', /^\/api\/leave\/requests$/, ({ user }) => db.leaveRequests.filter(({ employeeId }) => employeeId === user.id).map(withName)],
  ['POST', /^\/api\/leave\/requests$/, ({ user, body }) => {
    // The real backend counts days itself. The mock trusts the client to keep things simple.
    const kind = body.kind ?? 'initial';
    const request = {
      id: `LR-${randomUUID().slice(0, 6)}`, employeeId: user.id, type: body.type, from: body.from, to: body.to, ...(body.halfDay && { halfDay: body.halfDay }), days: body.days, reason: body.reason,
      status: 'pending', appliedOn: today(), kind, ...(kind !== 'initial' && { relatedRequestId: body.relatedRequestId }),
      usesFlightEntitlement: Boolean(body.usesFlightEntitlement), wantsSalaryAdvance: Boolean(body.wantsSalaryAdvance),
    };
    // A super admin's leave needs nobody's approval.
    const isApproved = user.roles.includes('SUPER_ADMIN');
    db.leaveRequests = [isApproved ? { ...request, status: 'approved', decidedBy: user.id, decidedOn: today() } : request, ...db.leaveRequests];
    if (isApproved) {
      replaceAmended(request);
    }
    return db.leaveRequests[0];
  }],
  ['POST', /^\/api\/leave\/requests\/([\w-]+)\/cancel$/, ({ user, params: [id] }) => {
    const request = db.leaveRequests.find((entry) => entry.id === id && entry.employeeId === user.id);
    if (!request) {
      throw new HttpError(404, 'Request not found');
    }
    const cancelled = { ...request, status: 'cancelled' };
    db.leaveRequests = db.leaveRequests.map((entry) => (entry.id === id ? cancelled : entry));
    return cancelled;
  }],

  ['GET', /^\/api\/holidays$/, ({ query }) => db.holidays.filter(({ date }) => date.startsWith(query.get('year') ?? today().slice(0, 4)))],
  ['GET', /^\/api\/announcements$/, () => db.announcements],
  ['GET', /^\/api\/events$/, ({ query }) => db.events.filter(({ date }) => date.startsWith(query.get('year') ?? today().slice(0, 4)))],
  ['GET', /^\/api\/resignation$/, ({ user }) =>
    db.resignations.filter(({ employeeId }) => employeeId === user.id).sort((first, second) => second.submittedOn.localeCompare(first.submittedOn)).map(resignationView)],
  // Their HOD hears. Someone with no HOD goes straight to HR.
  ['POST', /^\/api\/resignation$/, ({ user, body }) => {
    if (user.lastDay) {
      throw new HttpError(409, 'HR has already set your last day.');
    }
    if (db.resignations.some((entry) => entry.employeeId === user.id && ['pending', 'approved'].includes(entry.status))) {
      throw new HttpError(409, "You've already resigned. Withdraw that one first if the dates have changed.");
    }
    const reason = String(body.reason ?? '').trim();
    if (!DATE.test(String(body.releaseOn)) || body.releaseOn <= today() || !reason) {
      throw new HttpError(400, 'Pick a last day after today.');
    }
    const asked = `${user.fullName} resigned, asking for ${sayDate(body.releaseOn)} as their last day.`;
    const resignation = {
      id: `RS-${randomUUID().slice(0, 6)}`, employeeId: user.id, submittedOn: today(), reason, releaseOn: body.releaseOn, status: 'pending',
      ...(!user.managerId && { hodApprovedOn: today() }),
    };
    db.resignations = [resignation, ...db.resignations];
    if (user.managerId) {
      notify(user.managerId, 'approval', `${asked} Decide it from Leave requests.`);
    } else {
      hrBut(user.id).forEach((hr) => notify(hr.id, 'approval', `${asked} Decide it from Inbox.`));
    }
    return resignationView(resignation);
  }],
  ['POST', /^\/api\/resignation\/([\w-]+)\/withdraw$/, ({ user, params: [id] }) => {
    const resignation = db.resignations.find((entry) => entry.id === id && entry.employeeId === user.id);
    if (!resignation) {
      throw new HttpError(404, 'Resignation not found');
    }
    if (resignation.status !== 'pending') {
      throw new HttpError(409, "It's been decided, so talk to HR about it.");
    }
    return replaceResignation({ ...resignation, status: 'withdrawn', decidedOn: today() });
  }],
  ['GET', /^\/api\/documents$/, ({ user }) => documentEntries(user)],
  ['PUT', /^\/api\/documents\/([\w-]+)\/file$/, ({ user, params: [code], query, body }) =>
    uploadDocument({ by: user, owner: user, code, file: body, issuedOn: query.get('issuedOn'), expiresOn: query.get('expiresOn') }), { upload: CERTIFICATE_UPLOAD }],
  ['GET', /^\/api\/documents\/([\w-]+)\/files\/([\w-]+)$/, ({ user, params: [code, fileId], res }) => sendDocument(res, user, code, fileId)],
  ['DELETE', /^\/api\/documents\/([\w-]+)\/files\/([\w-]+)$/, ({ user, params: [code, fileId] }) => removeDocumentFile({ by: user, owner: user, code, fileId })],
  ['GET', /^\/api\/profile\/record$/, ({ user }) => recordOf(user.id, false)],
  // New details wait for HR to verify them before payroll uses them.
  ['PUT', /^\/api\/profile\/bank-account$/, ({ user, body }) => {
    const account = {
      bankName: String(body.bankName ?? '').trim(), accountName: String(body.accountName ?? '').trim(),
      accountNumber: String(body.accountNumber ?? '').replace(/\s/g, ''), currency: body.currency, status: 'pending', submittedOn: today(),
    };
    if (!account.bankName || !account.accountName || !/^\d{6,40}$/.test(account.accountNumber) || !['MVR', 'USD'].includes(account.currency)) {
      throw new HttpError(400, 'Give the bank, the name on the account, a 6 to 40 digit number and the currency');
    }
    db.records.bankAccounts = { ...db.records.bankAccounts, [user.id]: account };
    return bankView(user.id, account, false);
  }],
  ['GET', /^\/api\/flights$/, ({ user }) => flightYearOf(user.id)],
  ['POST', /^\/api\/flights\/claims$/, ({ user, body }) => {
    const year = Number(String(body.flightDate).slice(0, 4));
    const allowance = db.flightAllowances.find((entry) => entry.employeeId === user.id && entry.year === year);
    if (!allowance) {
      throw new HttpError(409, `You don't have a flight allowance for ${year}. Ask HR about it.`);
    }
    const amountUsd = toUsd(Number(body.amount), body.currency);
    const left = allowance.amountUsd - flightTotal(user.id, 'approved', year);
    if (amountUsd > left) {
      throw new HttpError(409, `That's ${dollars(amountUsd)}, more than the ${dollars(Math.max(0, left))} you have left for ${year}.`);
    }
    const claim = { id: `FC-${randomUUID().slice(0, 6)}`, employeeId: user.id, flightDate: body.flightDate, route: String(body.route).trim(), amount: Number(body.amount), currency: body.currency, amountUsd, hasReceipt: false, status: 'approved', raisedOn: today(), decidedOn: today() };
    db.flightClaims = [claim, ...db.flightClaims];
    return withName(claim);
  }],
  ['PUT', /^\/api\/flights\/claims\/([\w-]+)\/receipt$/, ({ user, params: [id], body }) => {
    const claim = db.flightClaims.find((entry) => entry.id === id && entry.employeeId === user.id && entry.status === 'approved');
    if (!claim) {
      throw new HttpError(404, 'Claim not found');
    }
    db.receipts.set(id, body);
    return withName(replaceIn('flightClaims', { ...claim, hasReceipt: true }));
  }, { upload: CERTIFICATE_UPLOAD }],
  ['GET', /^\/api\/flights\/claims\/([\w-]+)\/receipt$/, ({ user, params: [id], res }) => {
    const receipt = db.flightClaims.some((entry) => entry.id === id && entry.employeeId === user.id) && db.receipts.get(id);
    if (!receipt) {
      throw new HttpError(404, 'No receipt on this claim.');
    }
    return sendFile(res, receipt, `receipt-${id}`);
  }],
  ['POST', /^\/api\/flights\/claims\/([\w-]+)\/cancel$/, ({ user, params: [id] }) => {
    const claim = db.flightClaims.find((entry) => entry.id === id && entry.employeeId === user.id);
    if (!claim || claim.status !== 'approved') {
      throw new HttpError(409, 'This claim is already off your allowance.');
    }
    return withName(replaceIn('flightClaims', { ...claim, status: 'cancelled' }));
  }],
  ['GET', /^\/api\/notifications$/, ({ user }) => db.notifications.filter(({ employeeId }) => employeeId === user.id)],
  ['POST', /^\/api\/notifications\/read$/, ({ user }) => {
    db.notifications = db.notifications.map((entry) => (entry.employeeId === user.id ? { ...entry, isRead: true } : entry));
    return undefined;
  }],

  ['GET', /^\/api\/(team|company)$/, ({ user, params: [scope] }) =>
    peopleIn(user, scope).map((employee) => ({ ...profileOf(withRoles(employee)), today: db.attendance.find((record) => record.employeeId === employee.id && record.date === today()) }))],
  ['GET', /^\/api\/(team|company)\/attendance$/, ({ user, params: [scope], query }) => {
    const ids = idsIn(user, scope);
    return db.attendance.filter((record) => ids.has(record.employeeId)).filter(inMonth(query.get('month'))).map(withName);
  }],
  ['GET', /^\/api\/(team|company)\/leave-requests$/, ({ user, params: [scope], query }) => {
    const ids = idsIn(user, scope);
    return db.leaveRequests.filter((entry) => ids.has(entry.employeeId)).filter(byStatus(query.get('status'))).map(withName);
  }],
  ['POST', /^\/api\/(team|company)\/leave-requests\/([\w-]+)\/decision$/, ({ user, params: [scope, id], body }) => decide('leaveRequests', user, scope, id, body)],
  ['GET', /^\/api\/(team|company)\/corrections$/, ({ user, params: [scope], query }) => {
    const ids = idsIn(user, scope);
    return db.corrections.filter((entry) => ids.has(entry.employeeId)).filter(byStatus(query.get('status'))).map(withName);
  }],
  ['POST', /^\/api\/(team|company)\/corrections\/([\w-]+)\/decision$/, ({ user, params: [scope, id], body }) => decide('corrections', user, scope, id, body)],
  ['GET', /^\/api\/(team|company)\/comp-offs$/, ({ user, params: [scope], query }) => {
    const ids = idsIn(user, scope);
    return db.compOffs.filter((entry) => ids.has(entry.employeeId)).filter(byStatus(query.get('status'))).map(compOffView);
  }],
  ['POST', /^\/api\/(team|company)\/comp-offs\/([\w-]+)\/decision$/, ({ user, params: [scope, id], body }) => decide('compOffs', user, scope, id, body)],
  ['GET', /^\/api\/(team|company)\/overtime$/, ({ user, params: [scope], query }) => {
    const ids = idsIn(user, scope);
    return db.overtime.filter((entry) => ids.has(entry.employeeId)).filter(byStatus(query.get('status'))).map(overtimeView);
  }],
  ['POST', /^\/api\/(team|company)\/overtime\/([\w-]+)\/decision$/, ({ user, params: [scope, id], body }) => decide('overtime', user, scope, id, body)],
  ['GET', /^\/api\/(team|company)\/resignations$/, ({ user, params: [scope], query }) => {
    const ids = idsIn(user, scope);
    return db.resignations.filter((entry) => ids.has(entry.employeeId)).filter(byStatus(query.get('status'))).map(resignationView);
  }],
  // The HOD step. Approving passes it to HR, unless the HOD is HR.
  ['POST', /^\/api\/(team|company)\/resignations\/([\w-]+)\/decision$/, ({ user, params: [scope, id], body }) => {
    const ids = idsIn(user, scope);
    const resignation = db.resignations.find((entry) => entry.id === id && entry.employeeId !== user.id && ids.has(entry.employeeId));
    if (!resignation) {
      throw new HttpError(404, 'Resignation not found');
    }
    if (resignation.status !== 'pending') {
      throw new HttpError(409, 'This resignation has already been decided.');
    }
    if (resignation.hodApprovedOn) {
      throw new HttpError(409, 'Their HOD approved this. It now waits for HR.');
    }
    if (body.decision !== 'approved') {
      return rejectResignation(user, resignation, body.note);
    }
    if (user.roles.includes('HR')) {
      return approveResignation(user, resignation, resignation.releaseOn);
    }
    notify(resignation.employeeId, 'record', `${user.fullName} approved your resignation. It now waits for HR.`);
    hrBut(resignation.employeeId).forEach((hr) => notify(hr.id, 'approval', `${user.fullName} approved ${nameOf(resignation.employeeId)}'s resignation. It needs HR too. Decide it from Inbox.`));
    return replaceResignation({ ...resignation, hodApprovedBy: user.id, hodApprovedOn: today() });
  }],
  ['GET', /^\/api\/(team|company)\/home-days$/, ({ user, params: [scope], query }) => {
    const ids = idsIn(user, scope);
    return db.homeDays.filter((entry) => ids.has(entry.employeeId)).filter(byStatus(query.get('status'))).map(withName);
  }],
  ['POST', /^\/api\/(team|company)\/home-days\/([\w-]+)\/decision$/, ({ user, params: [scope, id], body }) => decide('homeDays', user, scope, id, body)],
  ['GET', /^\/api\/hr\/employees$/, ({ user, query }) => {
    requireHr(user);
    const people = query.get('include') === 'former' ? db.employees : activeEmployees();
    return people.map((employee) => ({ ...profileOf(withRoles(employee)), today: db.attendance.find((record) => record.employeeId === employee.id && record.date === today()) }));
  }],
  ['POST', /^\/api\/hr\/employees$/, ({ user, body }) => {
    requireHr(user);
    const details = validEmployee(body);
    const next = Math.max(...db.employees.map(({ id }) => Number(id.slice(EMPLOYEE_ID_PREFIX.length)))) + 1;
    const employee = { id: `${EMPLOYEE_ID_PREFIX}${String(next).padStart(EMPLOYEE_ID_DIGITS, '0')}`, ...details, roles: ['EMPLOYEE'] };
    checkManager(employee, details.managerId);
    db.employees = [...db.employees, employee];
    // Spring works out every day from the joining date. The mock only needs today, so a new starter can punch in.
    if (employee.joinedOn <= today()) {
      db.attendance = [...db.attendance, { employeeId: employee.id, date: today(), status: 'not-in-yet', punches: [], workedMinutes: 0, overtimeMinutes: 0 }];
    }
    // New starters get the yearly types in full. Maternity and paternity are granted when they apply.
    db.leaveBalances = {
      ...db.leaveBalances,
      [employee.id]: db.leaveTypes.filter(({ code, isUnlimited }) => !isUnlimited && !['maternity', 'paternity'].includes(code)).map(({ code, defaultEntitlement }) => ({ type: code, entitled: defaultEntitlement ?? 0, taken: 0, pending: 0 })),
    };
    return withRoles(employee);
  }],
  ['PUT', /^\/api\/hr\/employees\/([\w-]+)$/, ({ user, params: [id], body }) => {
    requireHr(user);
    const employee = findOr404('employees', id, 'Employee');
    const details = validEmployee(body, id);
    checkManager(employee, details.managerId);
    const { managerId, ...rest } = employee;
    const isNewManager = details.managerId && details.managerId !== managerId;
    notify(id, 'record', `HR updated your details.${isNewManager ? ` You now report to ${nameOf(details.managerId)}.` : ''}`);
    if (isNewManager) {
      notify(details.managerId, 'record', `${employee.fullName} now reports to you.`);
    }
    return withRoles(replaceIn('employees', { ...rest, ...details }));
  }],
  ['GET', /^\/api\/hr\/resignations$/, ({ user }) => {
    requireHr(user);
    return db.resignations.filter(({ status, hodApprovedOn, employeeId }) => status === 'pending' && hodApprovedOn && employeeId !== user.id)
      .sort((first, second) => first.submittedOn.localeCompare(second.submittedOn)).map(resignationView);
  }],
  // HR's step sets the exit date: the day they asked for, unless HR gives another.
  ['POST', /^\/api\/hr\/resignations\/([\w-]+)\/decision$/, ({ user, params: [id], body }) => {
    requireHr(user);
    const resignation = db.resignations.find((entry) => entry.id === id && entry.status === 'pending' && entry.hodApprovedOn);
    if (!resignation) {
      throw new HttpError(404, 'Nothing waiting for HR with that id');
    }
    if (resignation.employeeId === user.id) {
      throw new HttpError(403, 'Your own requests go to another HR person.');
    }
    if (body.decision !== 'approved') {
      return rejectResignation(user, resignation, body.note);
    }
    const exitOn = body.exitOn ?? resignation.releaseOn;
    if (!DATE.test(String(exitOn)) || exitOn < today()) {
      throw new HttpError(400, 'Pick an exit date from today on.');
    }
    return approveResignation(user, resignation, exitOn);
  }],
  ['GET', /^\/api\/hr\/employees\/([\w-]+)\/exit$/, ({ user, params: [id] }) => {
    requireHr(user);
    const resignation = approvedResignationOf(id);
    return resignation ? resignationView(resignation) : undefined;
  }],
  ['PUT', /^\/api\/hr\/employees\/([\w-]+)\/exit\/items\/([\w-]+)$/, ({ user, params: [id, itemId], body }) => tickExitItem(user, id, itemId, body.outcome)],
  ['DELETE', /^\/api\/hr\/employees\/([\w-]+)\/exit\/items\/([\w-]+)$/, ({ user, params: [id, itemId] }) => tickExitItem(user, id, itemId, undefined)],
  ['GET', /^\/api\/hr\/exit-items$/, ({ user }) => {
    requireHr(user);
    return db.exitItems;
  }],
  ['POST', /^\/api\/hr\/exit-items$/, ({ user, body }) => {
    requireHr(user);
    const name = String(body.name ?? '').trim();
    if (!name) {
      throw new HttpError(400, 'Name what comes back.');
    }
    if (db.exitItems.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
      throw new HttpError(409, "That's already on the list.");
    }
    const item = { id: `EI-${randomUUID().slice(0, 6)}`, name };
    db.exitItems = [...db.exitItems, item];
    return item;
  }],
  ['DELETE', /^\/api\/hr\/exit-items\/([\w-]+)$/, ({ user, params: [id] }) => {
    requireHr(user);
    if (!db.exitItems.some((item) => item.id === id)) {
      throw new HttpError(404, 'Item not found');
    }
    db.exitItems = db.exitItems.filter((item) => item.id !== id);
    return undefined;
  }],
  ['POST', /^\/api\/hr\/employees\/([\w-]+)\/leaving$/, ({ user, params: [id], body }) => {
    requireHr(user);
    const employee = findOr404('employees', id, 'Employee');
    const lastDay = String(body.lastDay ?? '');
    if (!DATE.test(lastDay) || lastDay < employee.joinedOn) {
      throw new HttpError(400, 'Pick a last day after they joined');
    }
    const reports = reportsOf(employee);
    if (reports.length) {
      throw new HttpError(409, `Move their ${reports.length} reports to another manager first`);
    }
    const stillOut = stillOutFor(id);
    if (stillOut.length) {
      throw new HttpError(409, `Tick off what they still have first: ${stillOut.join(', ').toLowerCase()}.`);
    }
    // Leave after the last day can't be taken, so it's cancelled with them.
    db.leaveRequests = db.leaveRequests.map((leave) =>
      leave.employeeId === id && leave.from > lastDay && ['pending', 'approved'].includes(leave.status) ? { ...leave, status: 'cancelled' } : leave,
    );
    return withRoles(replaceIn('employees', { ...employee, lastDay, leavingReason: requireReason(body) }));
  }],
  ['DELETE', /^\/api\/hr\/employees\/([\w-]+)\/leaving$/, ({ user, params: [id] }) => {
    requireHr(user);
    const employee = findOr404('employees', id, 'Employee');
    if (!employee.lastDay || employee.lastDay < today()) {
      throw new HttpError(409, 'They have already left');
    }
    const { lastDay, leavingReason, ...staying } = employee;
    return withRoles(replaceIn('employees', staying));
  }],
  ['GET', /^\/api\/hr\/employees\/([\w-]+)$/, ({ user, params: [id] }) => {
    requireHr(user);
    const employee = findOr404('employees', id, 'Employee');
    return {
      ...profileOf(withRoles(employee)),
      leaveBalances: balancesOf(id),
      adjustments: db.adjustments.filter(({ employeeId }) => employeeId === id).map((entry) => ({ ...entry, byName: nameOf(entry.by) })),
    };
  }],
  // Health data: the employee and HR can open a certificate. Managers only learn that one is attached.
  ['PUT', /^\/api\/leave\/requests\/([\w-]+)\/certificate$/, ({ user, params: [id], body }) => {
    const request = db.leaveRequests.find((entry) => entry.id === id && entry.employeeId === user.id);
    if (!request || request.type !== 'sick' || ['rejected', 'cancelled'].includes(request.status)) {
      throw new HttpError(404, 'No sick leave request to attach it to');
    }
    db.certificates.set(id, body);
    return replaceIn('leaveRequests', { ...request, hasCertificate: true });
  }, { upload: CERTIFICATE_UPLOAD }],
  ['GET', /^\/api\/leave\/requests\/([\w-]+)\/certificate$/, ({ user, params: [id], res }) => {
    const certificate = db.leaveRequests.some((entry) => entry.id === id && entry.employeeId === user.id) && db.certificates.get(id);
    if (!certificate) {
      throw new HttpError(404, 'No certificate');
    }
    return sendFile(res, certificate, `certificate-${id}`);
  }],
  ['GET', /^\/api\/hr\/leave-requests\/([\w-]+)\/certificate$/, ({ user, params: [id], res }) => {
    requireHr(user);
    const certificate = db.certificates.get(id);
    if (!certificate) {
      throw new HttpError(404, 'No certificate');
    }
    return sendFile(res, certificate, `certificate-${id}`);
  }],
  ['GET', /^\/api\/employees\/([\w-]+)\/photo$/, ({ params: [id], res }) => {
    const photo = db.photos.get(id);
    if (!photo) {
      throw new HttpError(404, 'No photo');
    }
    return sendFile(res, photo, `${id}-photo`);
  }],
  ['PUT', /^\/api\/hr\/employees\/([\w-]+)\/photo$/, ({ user, params: [id], body }) => {
    requireHr(user);
    const employee = findOr404('employees', id, 'Employee');
    db.photos.set(id, { ...body, version: randomUUID().slice(0, 8) });
    notify(id, 'record', 'HR added a new photo to your ID card.');
    return profileOf(withRoles(employee));
  }, { upload: PHOTO_UPLOAD }],
  ['DELETE', /^\/api\/hr\/employees\/([\w-]+)\/photo$/, ({ user, params: [id] }) => {
    requireHr(user);
    findOr404('employees', id, 'Employee');
    db.photos.delete(id);
    notify(id, 'record', 'HR removed the photo from your ID card. It shows your initials for now.');
    return undefined;
  }],
  ['PUT', /^\/api\/hr\/employees\/([\w-]+)\/visa$/, ({ user, params: [id], body }) => {
    requireHr(user);
    findOr404('employees', id, 'Employee');
    // Only the last 4 passport digits are ever stored or sent.
    if (Boolean(body.employmentApprovalNumber) !== Boolean(body.employmentApprovalExpiry)) {
      throw new HttpError(400, "Give the employment approval's number and expiry together.");
    }
    const visa = {
      employeeId: id, ...pick(body, ['workPermitNumber', 'visaNumber', 'visaIssuedOn', 'visaExpiry', 'passportExpiry', 'employmentApprovalNumber', 'employmentApprovalExpiry', 'medicalDueOn']),
      passportLast4: String(body.passportLast4 ?? '').slice(-4),
    };
    db.visas = [...db.visas.filter(({ employeeId }) => employeeId !== id), visa];
    notify(id, 'visa', 'HR updated your visa and work permit details. Expiry reminders follow the new dates.');
    return visa;
  }],
  ['GET', /^\/api\/hr\/attendance$/, ({ user, query }) => {
    requireHr(user);
    const employeeId = query.get('employeeId');
    return db.attendance.filter((record) => !employeeId || record.employeeId === employeeId).filter(inMonth(query.get('month'))).map(withName);
  }],
  ['GET', /^\/api\/hr\/leave-requests$/, ({ user, query }) => {
    requireHr(user);
    return db.leaveRequests.filter(byStatus(query.get('status'))).map(withName);
  }],
  ['POST', /^\/api\/hr\/balance-adjustments$/, ({ user, body }) => {
    requireHr(user);
    findOr404('employees', body.employeeId, 'Employee');
    const days = Number(body.days);
    if (!Number.isFinite(days) || days === 0 || !String(body.reason ?? '').trim()) {
      throw new HttpError(400, 'An adjustment needs a number of days and a reason');
    }
    const adjustment = { id: `BA-${randomUUID().slice(0, 6)}`, employeeId: body.employeeId, type: body.type, days, reason: String(body.reason).trim(), by: user.id, on: today() };
    db.adjustments = [adjustment, ...db.adjustments];
    const balances = db.leaveBalances[body.employeeId] ?? [];
    const existing = balances.find(({ type }) => type === body.type);
    db.leaveBalances = {
      ...db.leaveBalances,
      [body.employeeId]: existing
        ? balances.map((balance) => (balance.type === body.type ? { ...balance, entitled: balance.entitled + days } : balance))
        : [...balances, { type: body.type, entitled: days, taken: 0, pending: 0 }],
    };
    notify(adjustment.employeeId, 'leave', `HR ${days > 0 ? 'added' : 'removed'} ${sayDays(days)} ${days > 0 ? 'to' : 'from'} your ${typeName(adjustment.type)}. ${sentence(adjustment.reason)}`);
    return { ...adjustment, byName: user.fullName };
  }],
  ['GET', /^\/api\/hr\/approvals$/, ({ user }) => {
    requireHr(user);
    const waiting = (collection, dateOf) =>
      db[collection]
        .filter((entry) => entry.status === 'pending' && entry.hodApprovedBy && entry.employeeId !== user.id)
        .sort((first, second) => dateOf(first).localeCompare(dateOf(second)))
        .map((entry) => viewOf(collection, entry));
    return {
      leave: waiting('leaveRequests', ({ from }) => from),
      corrections: waiting('corrections', ({ raisedOn }) => raisedOn),
      homeDays: waiting('homeDays', ({ date }) => date),
      compOffs: waiting('compOffs', ({ date }) => date),
      overtime: waiting('overtime', ({ date }) => date),
    };
  }],
  ['POST', /^\/api\/hr\/approvals\/(leave|corrections|home-days|comp-offs|overtime)\/([\w-]+)\/decision$/, ({ user, params: [kind, id], body }) =>
    decideForHr({ leave: 'leaveRequests', corrections: 'corrections', 'home-days': 'homeDays', 'comp-offs': 'compOffs', overtime: 'overtime' }[kind], user, id, body)],
  ['GET', /^\/api\/hr\/approval-rules$/, ({ user }) => {
    requireHr(user);
    return db.approvalRules;
  }],
  ['PUT', /^\/api\/hr\/approval-rules$/, ({ user, body }) => {
    requireHr(user);
    db.approvalRules = { punchFixes: Boolean(body.punchFixes), homeDays: Boolean(body.homeDays), compOff: Boolean(body.compOff), overtime: Boolean(body.overtime) };
    return db.approvalRules;
  }],
  ['PUT', /^\/api\/hr\/leave-types\/([\w-]+)$/, ({ user, params: [code], body }) => {
    requireHr(user);
    const type = db.leaveTypes.find((entry) => entry.code === code);
    if (!type) {
      throw new HttpError(404, 'Leave type not found');
    }
    const updated = { ...type, noticeDays: undefined, ...pick(body, ['name', 'allowsHalfDay', 'defaultEntitlement', 'documentRequiredAfterDays', 'isForEveryone', 'carriesForward', 'carryForwardCap', 'needsHrApproval', 'noticeDays']) };
    db.leaveTypes = db.leaveTypes.map((entry) => (entry.code === code ? updated : entry));
    return updated;
  }],
  ['POST', /^\/api\/hr\/leave-types$/, ({ user, body }) => {
    requireHr(user);
    const code = String(body.name ?? '').trim().toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 20);
    if (!code || db.leaveTypes.some((entry) => entry.code === code)) {
      throw new HttpError(409, "There's already a leave type called that.");
    }
    const type = { code, ...pick(body, ['name', 'allowsHalfDay', 'isUnlimited', 'defaultEntitlement', 'documentRequiredAfterDays', 'isForEveryone', 'carriesForward', 'carryForwardCap', 'needsHrApproval', 'noticeDays']) };
    db.leaveTypes = [...db.leaveTypes.filter(({ code: existing }) => existing !== 'comp-off'), type, ...db.leaveTypes.filter(({ code: existing }) => existing === 'comp-off')];
    if (type.isForEveryone && !type.isUnlimited) {
      activeEmployees().forEach(({ id }) => setEntitled(id, code, Number(type.defaultEntitlement ?? 0)));
    }
    return type;
  }],
  ['DELETE', /^\/api\/hr\/leave-types\/([\w-]+)$/, ({ user, params: [code] }) => {
    requireHr(user);
    if (code === 'comp-off') {
      throw new HttpError(409, 'Compensatory off pays back Fridays and holidays worked, so it stays.');
    }
    const isUsed = db.leaveRequests.some(({ type }) => type === code) || Object.values(db.leaveBalances).some((balances) => balances.some(({ type }) => type === code));
    db.leaveTypes = isUsed ? db.leaveTypes.map((entry) => (entry.code === code ? { ...entry, retiredOn: today() } : entry)) : db.leaveTypes.filter((entry) => entry.code !== code);
    return undefined;
  }],
  ['PUT', /^\/api\/hr\/employees\/([\w-]+)\/leave\/([\w-]+)$/, ({ user, params: [id, code], body }) => {
    requireHr(user);
    const held = (db.leaveBalances[id] ?? []).find(({ type }) => type === code);
    const days = Number(body.days);
    if (held && days < held.taken + held.pending) {
      throw new HttpError(409, `They've already taken or booked ${sayDays(held.taken + held.pending)}, so it can't go below that.`);
    }
    if (days !== (held?.entitled ?? 0)) {
      logAdjustment(id, code, days - (held?.entitled ?? 0), String(body.reason).trim(), user.id);
    }
    setEntitled(id, code, days);
    notify(id, 'leave', `HR set your ${typeName(code)} to ${sayDays(days)} this year. ${sentence(String(body.reason))}`);
    return undefined;
  }],
  ['POST', /^\/api\/hr\/employees\/([\w-]+)\/leave\/([\w-]+)\/remove$/, ({ user, params: [id, code], body }) => {
    requireHr(user);
    db.leaveBalances = { ...db.leaveBalances, [id]: (db.leaveBalances[id] ?? []).filter(({ type }) => type !== code) };
    notify(id, 'leave', `HR removed ${typeName(code)} from your leave. ${sentence(String(body.reason))}`);
    return undefined;
  }],
  ['GET', /^\/api\/hr\/flight-claims\/([\w-]+)\/receipt$/, ({ user, params: [id], res }) => {
    requireHr(user);
    const receipt = db.receipts.get(id);
    if (!receipt) {
      throw new HttpError(404, 'No receipt on this claim.');
    }
    return sendFile(res, receipt, `receipt-${id}`);
  }],
  ['GET', /^\/api\/hr\/employees\/([\w-]+)\/flights$/, ({ user, params: [id] }) => {
    requireHr(user);
    findOr404('employees', id, 'Employee');
    return flightYearOf(id);
  }],
  ['PUT', /^\/api\/hr\/employees\/([\w-]+)\/flight-allowance$/, ({ user, params: [id], body }) => {
    requireHr(user);
    const year = Number(body.year);
    const amountUsd = Number(body.amountUsd);
    const claimed = flightTotal(id, 'approved', year) + flightTotal(id, 'pending', year);
    if (amountUsd < claimed) {
      throw new HttpError(409, `They've already claimed ${dollars(claimed)} for ${year}, so it can't go below that.`);
    }
    db.flightAllowances = [...db.flightAllowances.filter((entry) => !(entry.employeeId === id && entry.year === year)), { employeeId: id, year, amountUsd }];
    notify(id, 'flight', `HR set your flight allowance for ${year} to ${dollars(amountUsd)}.`);
    return undefined;
  }],
  ['PUT', /^\/api\/hr\/exchange-rates$/, ({ user, body }) => {
    requireHr(user);
    db.rates = { MVR: Number(body.mvr), INR: Number(body.inr) };
    return db.rates;
  }],
  ['POST', /^\/api\/hr\/holidays$/, ({ user, body }) => {
    requireHr(user);
    const holiday = { id: `HD-${randomUUID().slice(0, 6)}`, date: body.date, name: body.name, isTentative: Boolean(body.isTentative) };
    db.holidays = [...db.holidays, holiday];
    return holiday;
  }],
  ['POST', /^\/api\/hr\/holidays\/start-year$/, ({ user, body }) => {
    requireHr(user);
    // Civil holidays fall on the same date every year. Islamic ones move with the moon, so HR adds those by hand.
    const fixed = [['01-01', "New Year's Day"], ['07-26', 'Independence Day'], ['11-03', 'Victory Day'], ['11-11', 'Republic Day']];
    const added = fixed
      .map(([monthDay, name]) => ({ id: `HD-${randomUUID().slice(0, 6)}`, date: `${body.year}-${monthDay}`, name, isTentative: false }))
      .filter(({ date }) => !db.holidays.some((holiday) => holiday.date === date));
    db.holidays = [...db.holidays, ...added];
    return added;
  }],
  ['PUT', /^\/api\/hr\/holidays\/([\w-]+)$/, ({ user, params: [id], body }) => {
    requireHr(user);
    const holiday = findOr404('holidays', id, 'Holiday');
    const updated = { ...holiday, ...pick(body, ['date', 'name', 'isTentative']) };
    if (holiday.isTentative && updated.isTentative === false) {
      notifyEveryone('holiday', `${updated.name} is confirmed for ${sayDate(updated.date)}`);
    }
    return replaceIn('holidays', updated);
  }],
  ['DELETE', /^\/api\/hr\/holidays\/([\w-]+)$/, ({ user, params: [id] }) => {
    requireHr(user);
    return removeFrom('holidays', id, 'Holiday');
  }],
  ['POST', /^\/api\/hr\/events$/, ({ user, body }) => {
    requireHr(user);
    const event = { id: `EV-${randomUUID().slice(0, 6)}`, date: body.date, name: body.name };
    db.events = [...db.events, event];
    return event;
  }],
  ['PUT', /^\/api\/hr\/events\/([\w-]+)$/, ({ user, params: [id], body }) => {
    requireHr(user);
    return replaceIn('events', { ...findOr404('events', id, 'Event'), ...pick(body, ['date', 'name']) });
  }],
  ['DELETE', /^\/api\/hr\/events\/([\w-]+)$/, ({ user, params: [id] }) => {
    requireHr(user);
    return removeFrom('events', id, 'Event');
  }],
  ['GET', /^\/api\/hr\/change-requests$/, ({ user }) => {
    requireHr(user);
    return db.changeRequests.map(withName);
  }],
  ['POST', /^\/api\/hr\/change-requests\/([\w-]+)\/decision$/, ({ user, params: [id], body }) => {
    requireHr(user);
    const request = findOr404('changeRequests', id, 'Change request');
    if (request.status !== 'open' || !['done', 'declined'].includes(body.decision)) {
      throw new HttpError(409, 'This request has already been handled');
    }
    const field = request.field.toLowerCase();
    notify(request.employeeId, 'record', body.decision === 'done' ? `HR updated your ${field} as you asked.` : `HR couldn't change your ${field}: ${sentence(String(body.note ?? 'no reason given'))}`);
    return withName(replaceIn('changeRequests', { ...request, status: body.decision, decidedBy: user.id, decidedOn: today(), ...(body.note && { decisionNote: String(body.note) }) }));
  }],
  ['POST', /^\/api\/hr\/announcements$/, ({ user, body }) => {
    requireHr(user);
    const announcement = { id: `AN-${randomUUID().slice(0, 6)}`, title: String(body.title), body: String(body.body), publishedOn: today() };
    db.announcements = [announcement, ...db.announcements];
    notifyEveryone('announcement', announcement.title);
    return announcement;
  }],
  ['PUT', /^\/api\/hr\/announcements\/([\w-]+)$/, ({ user, params: [id], body }) => {
    requireHr(user);
    return replaceIn('announcements', { ...findOr404('announcements', id, 'Announcement'), ...pick(body, ['title', 'body']) });
  }],
  ['DELETE', /^\/api\/hr\/announcements\/([\w-]+)$/, ({ user, params: [id] }) => {
    requireHr(user);
    return removeFrom('announcements', id, 'Announcement');
  }],
  ['GET', /^\/api\/hr\/document-types$/, ({ user }) => {
    requireHr(user);
    return [...db.documentTypes].sort((first, second) => first.sortOrder - second.sortOrder || first.name.localeCompare(second.name));
  }],
  ['POST', /^\/api\/hr\/document-types$/, ({ user, body }) => {
    requireHr(user);
    const rules = validDocumentType(body);
    const code = rules.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (db.documentTypes.some((type) => type.code === code)) {
      throw new HttpError(409, "There's already a document called that.");
    }
    checkDocumentName(rules.name, code);
    const type = { code, ...rules, sortOrder: Math.max(0, ...db.documentTypes.map(({ sortOrder }) => sortOrder)) + 1 };
    db.documentTypes = [...db.documentTypes, type];
    return type;
  }],
  ['PUT', /^\/api\/hr\/document-types\/([\w-]+)$/, ({ user, params: [code], body }) => {
    requireHr(user);
    const rules = validDocumentType(body);
    checkDocumentName(rules.name, code);
    const type = { ...activeDocumentType(code), ...rules };
    db.documentTypes = db.documentTypes.map((entry) => (entry.code === code ? type : entry));
    return type;
  }],
  // Deleted if nobody ever uploaded one, otherwise retired with the copies kept.
  ['DELETE', /^\/api\/hr\/document-types\/([\w-]+)$/, ({ user, params: [code] }) => {
    requireHr(user);
    activeDocumentType(code);
    db.documentTypes = db.documents.some(({ type }) => type === code)
      ? db.documentTypes.map((entry) => (entry.code === code ? { ...entry, retiredOn: today() } : entry))
      : db.documentTypes.filter((entry) => entry.code !== code);
    return undefined;
  }],
  ['GET', /^\/api\/hr\/documents$/, ({ user }) => {
    requireHr(user);
    return db.documents
      .filter(({ status, employeeId }) => status === 'pending' && employeeId !== user.id)
      .sort((first, second) => String(first.updatedOn).localeCompare(String(second.updatedOn)))
      .map((document) => documentView(db.documentTypes.find(({ code }) => code === document.type), document));
  }],
  // Everyone still to hand something in: missing, sent back or expired.
  ['GET', /^\/api\/hr\/documents\/to-collect$/, ({ user }) => {
    requireHr(user);
    return activeEmployees()
      .map((employee) => ({
        employeeId: employee.id, employeeName: employee.fullName,
        documents: documentEntries(employee).filter(({ status, type }) => ['missing', 'rejected', 'expired'].includes(status) && !db.documentTypes.find(({ code }) => code === type)?.retiredOn),
      }))
      .filter(({ documents }) => documents.length)
      .sort((first, second) => first.employeeName.localeCompare(second.employeeName));
  }],
  // HR asks one person for a type that isn't for everyone, or stops asking.
  ['POST', /^\/api\/hr\/employees\/([\w-]+)\/document-types\/([\w-]+)$/, ({ user, params: [id, code] }) => {
    requireHr(user);
    const owner = someoneElseForDocuments(user, id);
    const type = activeDocumentType(code);
    if (type.isForEveryone || db.askedFor.some((entry) => entry.type === code && entry.employeeId === id)) {
      throw new HttpError(409, type.isForEveryone ? `Everyone is already asked for ${type.name.toLowerCase()}.` : `They're already asked for ${type.name.toLowerCase()}.`);
    }
    db.askedFor = [...db.askedFor, { type: code, employeeId: owner.id }];
    if (type.uploadedBy === 'employee') {
      notify(owner.id, 'record', `HR asked for your ${type.name.toLowerCase()}. Upload it from Documents.`);
    }
    return undefined;
  }],
  ['DELETE', /^\/api\/hr\/employees\/([\w-]+)\/document-types\/([\w-]+)$/, ({ user, params: [id, code] }) => {
    requireHr(user);
    someoneElseForDocuments(user, id);
    if (!db.askedFor.some((entry) => entry.type === code && entry.employeeId === id)) {
      throw new HttpError(404, "They aren't asked for that document.");
    }
    db.askedFor = db.askedFor.filter((entry) => !(entry.type === code && entry.employeeId === id));
    return undefined;
  }],
  ['GET', /^\/api\/hr\/employees\/([\w-]+)\/documents$/, ({ user, params: [id] }) => {
    requireHr(user);
    return documentEntries(findOr404('employees', id, 'Employee'));
  }],
  ['PUT', /^\/api\/hr\/employees\/([\w-]+)\/documents\/([\w-]+)\/file$/, ({ user, params: [id, code], query, body }) => {
    requireHr(user);
    return uploadDocument({ by: user, owner: someoneElseForDocuments(user, id), code, file: body, issuedOn: query.get('issuedOn'), expiresOn: query.get('expiresOn') });
  }, { upload: CERTIFICATE_UPLOAD }],
  ['GET', /^\/api\/hr\/employees\/([\w-]+)\/documents\/([\w-]+)\/files\/([\w-]+)$/, ({ user, params: [id, code, fileId], res }) => {
    requireHr(user);
    return sendDocument(res, findOr404('employees', id, 'Employee'), code, fileId);
  }],
  ['DELETE', /^\/api\/hr\/employees\/([\w-]+)\/documents\/([\w-]+)\/files\/([\w-]+)$/, ({ user, params: [id, code, fileId] }) => {
    requireHr(user);
    return removeDocumentFile({ by: user, owner: someoneElseForDocuments(user, id), code, fileId });
  }],
  // Sending one back needs a reason, so they know what to fix.
  ['POST', /^\/api\/hr\/employees\/([\w-]+)\/documents\/([\w-]+)\/decision$/, ({ user, params: [id, code], body }) => {
    requireHr(user);
    if (id === user.id) {
      throw new HttpError(403, 'Another HR person handles your own documents.');
    }
    const document = heldDocument(id, code);
    if (document.status !== 'pending' || !['verified', 'rejected'].includes(body.decision)) {
      throw new HttpError(409, 'This document has already been checked.');
    }
    const note = String(body.note ?? '').trim();
    if (body.decision === 'rejected' && !note) {
      throw new HttpError(400, "Say what's wrong, so they can send the right one.");
    }
    const decided = { ...document, status: body.decision, ...(note && { decisionNote: note }) };
    db.documents = db.documents.map((entry) => (entry === document ? decided : entry));
    const type = db.documentTypes.find((entry) => entry.code === code);
    const name = type.name.toLowerCase();
    notify(id, 'record', body.decision === 'verified' ? `HR verified your ${name}.` : `HR sent back your ${name}: ${sentence(note)} Upload it again from Documents.`);
    return documentView(type, decided);
  }],
  ['GET', /^\/api\/hr\/employees\/([\w-]+)\/record$/, ({ user, params: [id] }) => {
    requireHr(user);
    findOr404('employees', id, 'Employee');
    return recordOf(id, true);
  }],
  ['PUT', /^\/api\/hr\/employees\/([\w-]+)\/insurance$/, ({ user, params: [id], body }) => {
    const policy = { provider: String(body.provider ?? '').trim(), policyNumber: String(body.policyNumber ?? '').trim(), expiresOn: body.expiresOn };
    if (!policy.provider || !policy.policyNumber || !DATE.test(String(policy.expiresOn))) {
      throw new HttpError(400, 'Give the provider, policy number and expiry');
    }
    db.records.insurance = { ...db.records.insurance, [someoneElse(user, id)]: policy };
    notify(id, 'record', `HR updated your medical insurance. It runs until ${sayDateFromToday(policy.expiresOn)}.`);
    return policy;
  }],
  ['DELETE', /^\/api\/hr\/employees\/([\w-]+)\/insurance$/, ({ user, params: [id] }) => {
    const { [someoneElse(user, id)]: _removed, ...rest } = db.records.insurance;
    db.records.insurance = rest;
    return undefined;
  }],
  ['POST', /^\/api\/hr\/employees\/([\w-]+)\/education$/, ({ user, params: [id], body }) => {
    const year = Number(body.completedYear);
    if (!String(body.qualification ?? '').trim() || !String(body.institution ?? '').trim() || !Number.isInteger(year) || year > Number(today().slice(0, 4))) {
      throw new HttpError(400, 'Give the qualification, where and a year that has happened');
    }
    const entry = { id: `ED-${randomUUID().slice(0, 6)}`, employeeId: someoneElse(user, id), qualification: body.qualification.trim(), institution: body.institution.trim(), completedYear: year };
    db.records.education = [...db.records.education, entry];
    return entry;
  }],
  ['DELETE', /^\/api\/hr\/employees\/([\w-]+)\/education\/([\w-]+)$/, ({ user, params: [id, entryId] }) => {
    someoneElse(user, id);
    db.records.education = db.records.education.filter((entry) => entry.id !== entryId);
    return undefined;
  }],
  ['POST', /^\/api\/hr\/employees\/([\w-]+)\/experience$/, ({ user, params: [id], body }) => {
    if (!String(body.employer ?? '').trim() || !String(body.role ?? '').trim() || !DATE.test(String(body.from)) || (body.to && body.to < body.from)) {
      throw new HttpError(400, 'Give the employer, role and dates in order');
    }
    const entry = { id: `EX-${randomUUID().slice(0, 6)}`, employeeId: someoneElse(user, id), employer: body.employer.trim(), role: body.role.trim(), from: body.from, ...(body.to && { to: body.to }) };
    db.records.experience = [...db.records.experience, entry];
    return entry;
  }],
  ['DELETE', /^\/api\/hr\/employees\/([\w-]+)\/experience\/([\w-]+)$/, ({ user, params: [id, entryId] }) => {
    someoneElse(user, id);
    db.records.experience = db.records.experience.filter((entry) => entry.id !== entryId);
    return undefined;
  }],
  ['GET', /^\/api\/hr\/bank-accounts$/, ({ user }) => {
    requireHr(user);
    return Object.entries(db.records.bankAccounts)
      .filter(([, account]) => account.status === 'pending')
      .sort(([, first], [, second]) => first.submittedOn.localeCompare(second.submittedOn))
      .map(([employeeId, account]) => bankView(employeeId, account, true));
  }],
  // Sending them back needs a reason, so the person knows what to fix.
  ['POST', /^\/api\/hr\/employees\/([\w-]+)\/bank-account\/decision$/, ({ user, params: [id], body }) => {
    const account = db.records.bankAccounts[someoneElse(user, id)];
    if (!account) {
      throw new HttpError(404, 'No bank details to check.');
    }
    if (account.status !== 'pending' || !['verified', 'rejected'].includes(body.decision)) {
      throw new HttpError(409, 'These bank details have already been checked.');
    }
    const note = String(body.note ?? '').trim();
    if (body.decision === 'rejected' && !note) {
      throw new HttpError(400, "Say what's wrong, so they can fix it.");
    }
    const decided = { ...account, status: body.decision, ...(note && { decisionNote: note }) };
    db.records.bankAccounts = { ...db.records.bankAccounts, [id]: decided };
    notify(id, 'record', body.decision === 'verified'
      ? 'HR verified your bank details. Your pay goes to this account.'
      : `HR sent back your bank details: ${sentence(note)} Enter them again from your profile.`);
    return bankView(id, decided, true);
  }],
  ['GET', /^\/api\/hr\/quotas$/, ({ user }) => {
    requireHr(user);
    return [...db.records.quotas].sort((first, second) => first.jobCategory.localeCompare(second.jobCategory)).map(quotaView);
  }],
  ['POST', /^\/api\/hr\/quotas$/, ({ user, body }) => {
    requireHr(user);
    const quota = { id: `QA-${randomUUID().slice(0, 6)}`, ...validQuota(body) };
    db.records.quotas = [...db.records.quotas, quota];
    return quotaView(quota);
  }],
  ['PUT', /^\/api\/hr\/quotas\/([\w-]+)$/, ({ user, params: [id], body }) => {
    requireHr(user);
    if (!db.records.quotas.some((quota) => quota.id === id)) {
      throw new HttpError(404, 'Quota not found');
    }
    const quota = { id, ...validQuota(body) };
    db.records.quotas = db.records.quotas.map((entry) => (entry.id === id ? quota : entry));
    return quotaView(quota);
  }],
  ['DELETE', /^\/api\/hr\/quotas\/([\w-]+)$/, ({ user, params: [id] }) => {
    requireHr(user);
    db.records.quotas = db.records.quotas.filter((quota) => quota.id !== id);
    return undefined;
  }],
  // The dashboard's facts, for HR and super admins. The pages count and group them; the mock only gathers them.
  ['GET', /^\/api\/performance$/, ({ user }) => {
    const cycle = openCycle();
    return {
      ...(cycle && { cycle, form: formView(cycle.id, user.id) }),
      goals: cycle ? goalsOf(cycle.id, user.id) : [],
      appraisals: db.performance.appraisals.filter(({ employeeId }) => employeeId === user.id).sort((first, second) => second.appraisedOn.localeCompare(first.appraisedOn)).map(ownView),
      probationReviews: db.performance.probationReviews.filter(({ employeeId }) => employeeId === user.id).map(reviewView),
    };
  }],
  ['POST', /^\/api\/performance\/appraisals\/([\w-]+)\/accept$/, ({ user, params: [id] }) => {
    const appraisal = db.performance.appraisals.find((entry) => entry.id === id && entry.employeeId === user.id);
    if (!appraisal) {
      throw new HttpError(404, 'Appraisal not found');
    }
    const accepted = { ...appraisal, acceptedOn: appraisal.acceptedOn ?? today() };
    db.performance.appraisals = db.performance.appraisals.map((entry) => (entry.id === id ? accepted : entry));
    return ownView(accepted);
  }],
  // Someone writes their own goals while they're a draft or sent back. Saving replaces them.
  ['PUT', /^\/api\/performance\/goals$/, ({ user, body }) => {
    const { cycle, form } = requireOwnForm(user);
    if (!['draft', 'rejected'].includes(form.goalsStatus)) {
      throw new HttpError(409, 'Your goals are with your HOD or HR, or already approved.');
    }
    const plans = Array.isArray(body.goals) ? body.goals : [];
    if (plans.length === 0 || plans.some(({ title, measure, weight }) => !String(title ?? '').trim() || !String(measure ?? '').trim() || !(weight >= 1 && weight <= 100))) {
      throw new HttpError(400, 'Give each goal a title, a measure and a weight');
    }
    if (plans.reduce((total, { weight }) => total + weight, 0) !== 100) {
      throw new HttpError(400, 'Goal weights need to add up to 100%.');
    }
    db.performance.goals = [
      ...db.performance.goals.filter((goal) => !(goal.cycleId === cycle.id && goal.employeeId === user.id)),
      ...plans.map(({ title, measure, weight }) => ({ id: `GL-${randomUUID().slice(0, 6)}`, cycleId: cycle.id, employeeId: user.id, title: title.trim(), measure: measure.trim(), weight })),
    ];
    saveForm(cycle.id, user.id, {});
    return goalsOf(cycle.id, user.id);
  }],
  ['POST', /^\/api\/performance\/goals\/submit$/, ({ user }) => {
    const { cycle, form } = requireOwnForm(user);
    if (!['draft', 'rejected'].includes(form.goalsStatus)) {
      throw new HttpError(409, 'Your goals are with your HOD or HR, or already approved.');
    }
    if (goalsOf(cycle.id, user.id).length === 0) {
      throw new HttpError(400, 'Write at least one goal first.');
    }
    saveForm(cycle.id, user.id, { goalsStatus: 'submitted', goalsSubmittedOn: today(), hodApprovedBy: undefined, hodApprovedOn: undefined, goalsDecidedBy: undefined, goalsDecidedOn: undefined, goalsNote: undefined });
    notify(user.managerId, 'performance', `${user.fullName} sent their goals for ${cycle.name}. Approve them or send them back from Performance.`);
    return formView(cycle.id, user.id);
  }],
  ['PUT', /^\/api\/performance\/self-review$/, ({ user, body }) => {
    const { cycle } = requireOwnForm(user);
    refuseIfAppraised(cycle, user.id);
    const text = (value) => String(value ?? '').trim() || undefined;
    saveForm(cycle.id, user.id, {
      accomplishments: text(body.accomplishments), strengths: text(body.strengths), learning: text(body.learning), certifications: text(body.certifications), selfReviewedOn: today(),
    });
    return formView(cycle.id, user.id);
  }],
  ['GET', /^\/api\/team\/performance$/, ({ user }) => {
    requireManager(user);
    const cycle = openCycle();
    return {
      ...(cycle && { cycle }),
      people: reportsOf(user).map(({ id, fullName, designation, probationEndsOn }) => {
        const appraisal = cycle && db.performance.appraisals.find((entry) => entry.cycleId === cycle.id && entry.employeeId === id);
        return {
          employeeId: id, fullName, designation, ...(probationEndsOn && { probationEndsOn }), ...(cycle && { form: formView(cycle.id, id) }),
          goals: cycle ? goalsOf(cycle.id, id) : [], ...(appraisal && { appraisal: appraisalView(appraisal) }),
        };
      }),
    };
  }],
  // The HOD's step: approving passes the goals to HR, unless the HOD is HR.
  ['POST', /^\/api\/team\/performance\/([\w-]+)\/goals\/decision$/, ({ user, params: [id], body }) => {
    const person = reportOf(user, id);
    const cycle = requireOpenCycle();
    if (formOf(cycle.id, person.id)?.goalsStatus !== 'submitted') {
      throw new HttpError(409, "Their goals aren't waiting for you.");
    }
    if (body.decision !== 'approved' || user.roles.includes('HR')) {
      return finishGoals(user, cycle, person.id, body);
    }
    saveForm(cycle.id, person.id, { goalsStatus: 'hod-approved', hodApprovedBy: user.id, hodApprovedOn: today() });
    notify(person.id, 'performance', `${user.fullName} approved your goals for ${cycle.name}. They now wait for HR.`);
    activeEmployees().filter((employee) => employee.roles.includes('HR') && employee.id !== person.id)
      .forEach((hr) => notify(hr.id, 'performance', `${user.fullName} approved ${person.fullName}'s goals for ${cycle.name}. Approve them from Performance.`));
    return undefined;
  }],
  ['POST', /^\/api\/team\/performance\/([\w-]+)\/appraisal$/, ({ user, params: [id], body }) => {
    const person = reportOf(user, id);
    const cycle = requireOpenCycle();
    refuseIfAppraised(cycle, person.id);
    if (formOf(cycle.id, person.id)?.goalsStatus !== 'approved') {
      throw new HttpError(409, 'Their goals need approving by you and HR first.');
    }
    const given = new Map((body.goals ?? []).map((goal) => [goal.goalId, goal]));
    const theirs = db.performance.goals.filter((goal) => goal.cycleId === cycle.id && goal.employeeId === person.id);
    if (given.size !== theirs.length || theirs.some(({ id: goalId }) => !given.has(goalId))) {
      throw new HttpError(400, 'Rate each of their goals.');
    }
    if (!(body.rating >= 1 && body.rating <= 5) || !String(body.comments ?? '').trim()) {
      throw new HttpError(400, 'Give a rating from 1 to 5 and your comments');
    }
    db.performance.goals = db.performance.goals.map((goal) =>
      given.has(goal.id) ? { ...goal, rating: given.get(goal.id).rating, ...(String(given.get(goal.id).comment ?? '').trim() && { comment: given.get(goal.id).comment.trim() }) } : goal,
    );
    const appraisal = {
      id: `AP-${randomUUID().slice(0, 6)}`, cycleId: cycle.id, employeeId: person.id, rating: body.rating, comments: body.comments.trim(),
      recommendsPromotion: Boolean(body.recommendsPromotion), ...(body.incrementPercent && { incrementPercent: Number(body.incrementPercent) }), appraisedBy: user.id, appraisedOn: today(),
      ...(String(body.selfReviewComment ?? '').trim() && { selfReviewComment: body.selfReviewComment.trim() }),
    };
    db.performance.appraisals = [...db.performance.appraisals, appraisal];
    notify(person.id, 'performance', `${user.fullName} finished your ${cycle.name}. Read it on Performance and accept your rating.`);
    return appraisalView(appraisal);
  }],
  ['POST', /^\/api\/team\/performance\/([\w-]+)\/probation-review$/, ({ user, params: [id], body }) => {
    const person = reportOf(user, id);
    if (!person.probationEndsOn) {
      throw new HttpError(409, "They aren't on probation.");
    }
    if (!['confirmed', 'extended', 'not-confirmed'].includes(body.outcome) || !String(body.comments ?? '').trim()) {
      throw new HttpError(400, 'Pick an outcome and add your comments');
    }
    const isExtended = body.outcome === 'extended';
    if (isExtended && !(DATE.test(String(body.extendedTo)) && body.extendedTo > person.probationEndsOn)) {
      throw new HttpError(400, `Pick a new end date after ${sayDateFromToday(person.probationEndsOn)}.`);
    }
    const review = {
      id: `PR-${randomUUID().slice(0, 6)}`, employeeId: person.id, probationEnded: person.probationEndsOn, outcome: body.outcome,
      ...(isExtended && { extendedTo: body.extendedTo }), comments: body.comments.trim(), reviewedBy: user.id, reviewedOn: today(),
    };
    db.performance.probationReviews = [review, ...db.performance.probationReviews];
    const outcome = { confirmed: 'confirmed in their role', extended: `on probation until ${sayDateFromToday(body.extendedTo)}`, 'not-confirmed': 'not confirmed in their role' }[body.outcome];
    if (body.outcome !== 'not-confirmed') {
      db.employees = db.employees.map((employee) => {
        if (employee.id !== person.id) {
          return employee;
        }
        const { probationEndsOn: _ended, ...rest } = employee;
        return isExtended ? { ...rest, probationEndsOn: body.extendedTo } : rest;
      });
    }
    notify(person.id, 'performance', `${user.fullName} reviewed your probation: you're ${outcome.replace('their', 'your')}.`);
    activeEmployees()
      .filter((employee) => employee.roles.includes('HR') && employee.id !== person.id)
      .forEach((hr) => notify(hr.id, 'performance', `${user.fullName} reviewed ${person.fullName}'s probation: ${outcome}.`));
    return reviewView(review);
  }],
  ['GET', /^\/api\/hr\/performance$/, ({ user }) => {
    requireHr(user);
    const cycle = latestCycle();
    return {
      cycles: [...db.performance.cycles].sort((first, second) => second.openedOn.localeCompare(first.openedOn)),
      people: cycle
        ? activeEmployees().filter(({ managerId }) => managerId).map(({ id, fullName, department, managerId }) => {
          const appraisal = db.performance.appraisals.find((entry) => entry.cycleId === cycle.id && entry.employeeId === id);
          return {
            employeeId: id, fullName, department, managerName: nameOf(managerId), form: formView(cycle.id, id), goals: goalsOf(cycle.id, id), ...(appraisal && { appraisal: appraisalView(appraisal) }),
          };
        })
        : [],
      probationReviews: db.performance.probationReviews.map(reviewView),
    };
  }],
  // HR's step on goals the HOD approved, never their own.
  ['POST', /^\/api\/hr\/performance\/([\w-]+)\/goals\/decision$/, ({ user, params: [id], body }) => {
    requireHr(user);
    if (id === user.id) {
      throw new HttpError(403, 'Your own goals go to another HR person.');
    }
    const cycle = requireOpenCycle();
    if (formOf(cycle.id, id)?.goalsStatus !== 'hod-approved') {
      throw new HttpError(409, "Their goals aren't waiting for HR.");
    }
    return finishGoals(user, cycle, id, body);
  }],
  ['POST', /^\/api\/hr\/appraisal-cycles$/, ({ user, body }) => {
    requireHr(user);
    if (openCycle()) {
      throw new HttpError(409, 'A cycle is already open. Close it before opening another.');
    }
    if (!String(body.name ?? '').trim() || !DATE.test(String(body.dueOn)) || body.dueOn <= today()) {
      throw new HttpError(400, 'Pick a due date after today.');
    }
    const cycle = { id: `AY-${randomUUID().slice(0, 6)}`, name: body.name.trim(), dueOn: body.dueOn, openedOn: today() };
    db.performance.cycles = [...db.performance.cycles, cycle];
    const due = `${cycle.name}, due ${sayDateFromToday(cycle.dueOn)}.`;
    activeEmployees().forEach((person) => {
      if (person.managerId) {
        notify(person.id, 'performance', `HR opened ${due} Write your goals and KPIs on Performance.`);
      }
      if (reportsOf(person).length > 0) {
        notify(person.id, 'performance', `HR opened ${due} Approve your team's goals, then appraise them.`);
      }
    });
    return cycle;
  }],
  ['POST', /^\/api\/hr\/appraisal-cycles\/([\w-]+)\/close$/, ({ user, params: [id] }) => {
    requireHr(user);
    const cycle = db.performance.cycles.find((entry) => entry.id === id && !entry.closedOn);
    if (!cycle) {
      throw new HttpError(404, 'No open cycle with that id');
    }
    const closed = { ...cycle, closedOn: today() };
    db.performance.cycles = db.performance.cycles.map((entry) => (entry.id === id ? closed : entry));
    return closed;
  }],
  ['GET', /^\/api\/insights$/, ({ user }) => {
    requireInsights(user);
    const since = Number(today().slice(0, 4)) - 1;
    const insuranceOf = db.records.insurance;
    return {
      today: today(),
      people: [...db.employees].sort((first, second) => first.fullName.localeCompare(second.fullName)).map((employee) => {
        const visa = db.visas.find(({ employeeId }) => employeeId === employee.id);
        const isActive = !employee.lastDay || employee.lastDay >= today();
        return {
          ...pick(employee, ['id', 'fullName', 'department', 'designation', 'nationality', 'gender', 'dateOfBirth', 'joinedOn', 'lastDay', 'employmentType', 'jobCategory', 'managerId', 'probationEndsOn', 'contractEndsOn']),
          ...(isActive && { today: db.attendance.find((record) => record.employeeId === employee.id && record.date === today()) }),
          ...(visa && pick(visa, ['visaExpiry', 'passportExpiry', 'employmentApprovalExpiry', 'medicalDueOn'])),
          ...(insuranceOf[employee.id] && { insuranceExpiry: insuranceOf[employee.id].expiresOn }),
        };
      }),
      leave: db.leaveRequests.filter(({ from }) => Number(from.slice(0, 4)) >= since).map((request) => pick(request, ['employeeId', 'type', 'from', 'to', 'days', 'status', 'appliedOn'])),
      balances: activeEmployees().flatMap(({ id }) => balancesOf(id).map((balance) => ({ employeeId: id, ...pick(balance, ['type', 'entitled', 'taken', 'pending']) }))),
      quotas: [...db.records.quotas].sort((first, second) => first.jobCategory.localeCompare(second.jobCategory)).map(quotaView),
      ...(latestCycle() && { cycle: latestCycle() }),
      appraisals: db.performance.appraisals
        .filter(({ cycleId }) => cycleId === latestCycle()?.id)
        .map(({ employeeId, rating, recommendsPromotion, incrementPercent }) => ({ employeeId, rating, recommendsPromotion, ...(incrementPercent && { incrementPercent }) })),
    };
  }],
  ['GET', /^\/api\/insights\/attendance$/, ({ user, query }) => {
    requireInsights(user);
    const ids = new Set(activeEmployees().map(({ id }) => id));
    return db.attendance.filter((record) => ids.has(record.employeeId)).filter(inMonth(query.get('month'))).map(withName);
  }],
  ['GET', /^\/api\/hr\/schedules$/, ({ user }) => {
    requireHr(user);
    return [...db.schedules].sort((first, second) => second.effectiveFrom.localeCompare(first.effectiveFrom)).map((version) => ({ ...version, setByName: nameOf(version.setBy) }));
  }],
  ['POST', /^\/api\/hr\/schedules$/, ({ user, body }) => {
    requireHr(user);
    const version = { id: `WS-${randomUUID().slice(0, 6)}`, ...validSchedule(body), reason: requireReason(body), setBy: user.id, setOn: today() };
    if (db.schedules.some(({ effectiveFrom }) => effectiveFrom === version.effectiveFrom)) {
      throw new HttpError(409, 'A schedule already starts on that date');
    }
    db.schedules = [...db.schedules, version];
    notifyEveryone('schedule', `From ${sayDate(version.effectiveFrom)}, the working day is ${sayTime(version.shiftStart)} to ${sayTime(version.shiftEnd)}, late after ${version.graceMinutes} minutes. ${sentence(version.reason)}`);
    return { ...version, setByName: user.fullName };
  }],
  ['DELETE', /^\/api\/hr\/schedules\/([\w-]+)$/, ({ user, params: [id] }) => {
    requireHr(user);
    const version = findOr404('schedules', id, 'Schedule');
    if (version.effectiveFrom <= today()) {
      throw new HttpError(409, 'A schedule already in force can only be replaced, not removed');
    }
    notifyEveryone('schedule', `The change to working hours planned for ${sayDate(version.effectiveFrom)} is off. Your hours stay as they are.`);
    return removeFrom('schedules', id, 'Schedule');
  }],
  ['GET', /^\/api\/(team|company)\/([\w-]+)$/, ({ user, params: [scope, id] }) => {
    const employee = peopleIn(user, scope).find((entry) => entry.id === id);
    if (!employee) {
      throw new HttpError(404, scope === 'company' ? 'Employee not found' : 'Not one of your reports');
    }
    return { ...profileOf(withRoles(employee)), leaveBalances: balancesOf(id) };
  }],
];

const parseCookies = (header = '') =>
  Object.fromEntries(header.split(';').filter(Boolean).map((pair) => pair.trim().split('=').map(decodeURIComponent)));

const readBody = async (req) => {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw new HttpError(413, 'Body too large');
    }
    chunks.push(chunk);
  }
  if (chunks.length === 0) {
    return {};
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'Body must be JSON');
  }
};

const send = (res, status, payload) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(payload === undefined ? undefined : JSON.stringify(payload));
};

// Answers one request. The dev server below uses it, and so does the Netlify demo's function.
export const handle = async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const cookies = parseCookies(req.headers.cookie);
    const route = routes.find(([method, pattern]) => method === req.method && pattern.test(url.pathname));
    if (!route) {
      throw new HttpError(404, 'No such endpoint');
    }
    const [method, pattern, handler, options = {}] = route;

    // Mirrors Spring Security's cookie based CSRF protection.
    if (!cookies[XSRF_COOKIE]) {
      res.appendHeader('Set-Cookie', `${XSRF_COOKIE}=${randomUUID()}; SameSite=Strict; Path=/`);
    }
    if (method !== 'GET' && (!cookies[XSRF_COOKIE] || req.headers['x-xsrf-token'] !== cookies[XSRF_COOKIE])) {
      throw new HttpError(403, 'Missing or invalid XSRF token');
    }

    const token = cookies[SESSION_COOKIE];
    const signedIn = sessions.get(token) ?? (SESSIONS_SURVIVE_RESTARTS ? token?.split('.')[0] : undefined);
    const found = activeEmployees().find(({ id }) => id === signedIn);
    const user = found && withRoles(found);
    if (!user && !options.isPublic) {
      throw new HttpError(401, 'Please sign in');
    }

    const body = method === 'GET' ? {} : options.upload ? await readUpload(req, options.upload) : await readBody(req);
    const params = url.pathname.match(pattern).slice(1);
    const result = await handler({ user, body, params, query: url.searchParams, token, res });
    if (result !== SENT) {
      send(res, result === undefined ? 204 : 200, result);
    }
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    if (status === 500) {
      console.error(error);
    }
    send(res, status, { message: status === 500 ? 'Something went wrong in the mock server' : error.message });
  }
};

// Started directly (npm run mock, the e2e runs), it listens. Imported by the Netlify function, it doesn't.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  createServer(handle).listen(PORT, () => console.log(`Mock API on http://localhost:${PORT}`));
}
