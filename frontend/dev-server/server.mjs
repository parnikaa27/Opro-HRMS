// Mock of the Spring API for frontend development. Node built ins only, state lives in memory until restart.
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { buildAttendance, clockNow, decideHomeDay, maldivesNow, punchNow, rebuildDay, toMinutes } from './attendance.mjs';

const PORT = Number(process.env.MOCK_PORT ?? 4300);
const MAX_BODY_BYTES = 10_000;
const SESSION_COOKIE = 'opro_session';
const XSRF_COOKIE = 'XSRF-TOKEN';

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
  punchEdits: load('punch-edits'),
  // Uploaded files live in memory like everything else, keyed by employee or request.
  photos: new Map(),
  certificates: new Map(),
};
db.attendance = buildAttendance(db);
// The approvals that go with the generated days worked from home.
db.homeDays = db.attendance
  .filter(({ workMode }) => workMode === 'home')
  .map(({ employeeId, date, homeStatus }) => ({ id: `HW-${employeeId}-${date}`, employeeId, date, status: homeStatus }));

const longDate = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const sessions = new Map();
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

const documentsOf = (user) => {
  const visa = db.visas.find(({ employeeId }) => employeeId === user.id);
  return [
    { id: 'contract', name: 'Employment contract', updatedOn: user.joinedOn, status: 'verified' },
    ...(visa ? [{ id: 'visa', name: 'Visa copy', expiresOn: visa.visaExpiry, status: 'verified' }] : []),
    user.nationality === 'Maldivian'
      ? { id: 'national-id', name: 'National ID', status: 'verified' }
      : { id: 'passport', name: 'Passport copy', expiresOn: visa?.passportExpiry, status: 'verified' },
    { id: 'insurance', name: 'Health insurance', updatedOn: '2026-02-05', status: 'pending' },
  ];
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const today = () => maldivesNow().date;
const nameOf = (employeeId) => db.employees.find(({ id }) => id === employeeId)?.fullName;
const withName = (item) => ({ ...item, employeeName: nameOf(item.employeeId), ...(item.decidedBy && { decidedByName: nameOf(item.decidedBy) }) });
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

const managerScope = (user) => {
  const reportIds = requireManager(user);
  return (entry) => reportIds.has(entry.employeeId);
};

const hrScope = (user) => {
  requireHr(user);
  return () => true;
};

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
  const times = ['shiftStart', 'shiftEnd', 'ramadanStart', 'ramadanEnd'];
  if (!times.every((key) => TIME.test(String(body[key] ?? '')))) {
    throw new HttpError(400, 'Times must look like 09:00');
  }
  const shiftLength = toMinutes(body.shiftEnd) - toMinutes(body.shiftStart);
  const grace = Number(body.graceMinutes);
  const halfDay = Number(body.halfDayMinutes);
  if (shiftLength <= 0 || toMinutes(body.ramadanEnd) <= toMinutes(body.ramadanStart)) {
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
const validEmployee = (body, id) => {
  const text = (value) => String(value ?? '').trim();
  const fields = ['fullName', 'designation', 'department', 'email', 'phone', 'nationality', 'workLocation', 'employmentType'];
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
  return { ...details, joinedOn: body.joinedOn, bloodGroup: body.bloodGroup, emergencyContact: contact, ...(body.managerId && { managerId: String(body.managerId) }) };
};

// A manager has to be someone active, and never the person or anyone below them.
const checkManager = (employee, managerId) => {
  if (!managerId) {
    return;
  }
  const below = (id) => db.employees.filter((entry) => entry.managerId === id).flatMap((entry) => [entry.id, ...below(entry.id)]);
  const manager = activeEmployees().find(({ id }) => id === managerId);
  if (!manager || managerId === employee.id || below(employee.id).includes(managerId)) {
    throw new HttpError(400, 'Pick a manager who is active and not one of their reports');
  }
};

const punchMinutesOf = (record) => record.punches.map(({ at }) => toMinutes(at.slice(11, 16)));
const withByName = (item) => ({ ...item, byName: nameOf(item.by) });

// Device punches are never overwritten: a missing one is added or a wrong one voided, the day is worked out again,
// and the change is logged with who, when and why.
const editPunch = ({ employeeId, date, action, time, reason, by }) => {
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
  const change = { id: `PE-${randomUUID().slice(0, 6)}`, employeeId, date, action, time, reason, by, on: today() };
  db.punchEdits = [change, ...db.punchEdits];
  return change;
};

const decisionText = (collection, { status, decisionNote, ...item }) => {
  const outcome = status === 'approved' ? 'was approved.' : `was declined: ${sentence(decisionNote ?? 'no reason given')}`;
  return collection === 'corrections'
    ? `Your punch fix for ${sayDate(item.date)} ${outcome}${status === 'approved' ? ` The ${sayTime(item.requestedTime)} punch is now on your record.` : ''}`
    : `Your ${typeName(item.type)} for ${sayDates(item)} ${outcome}`;
};

// An approved fix goes through the same path as one HR makes. If the punch is already there, or the day is older
// than the mock's history, there is nothing left to change.
const applyFix = (correction, user) => {
  try {
    editPunch({ employeeId: correction.employeeId, date: correction.date, action: 'add', time: correction.requestedTime, reason: `Punch fix approved: ${correction.reason}`, by: user.id });
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

const decide = (collection, user, id, { decision, note }, inScope = managerScope(user)) => {
  const item = db[collection].find((entry) => entry.id === id && inScope(entry));
  if (!item) {
    throw new HttpError(404, 'Request not found');
  }
  if (item.status !== 'pending' || !['approved', 'rejected'].includes(decision)) {
    throw new HttpError(409, 'This request has already been decided');
  }
  if (collection === 'corrections' && decision === 'approved') {
    applyFix(item, user);
  }
  const decided = { ...item, status: decision, decidedBy: user.id, decidedOn: today(), ...(note && { decisionNote: String(note) }) };
  db[collection] = db[collection].map((entry) => (entry.id === id ? decided : entry));
  if (collection === 'homeDays') {
    db.attendance = db.attendance.map((entry) => (entry.employeeId === item.employeeId && entry.date === item.date ? decideHomeDay(entry, decision) : entry));
    notify(item.employeeId, 'home', homeDecisionText(user, decided));
    return withName(decided);
  }
  notify(item.employeeId, collection === 'corrections' ? 'correction' : 'leave', decisionText(collection, decided));
  return withName(decided);
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
    const token = randomUUID();
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
    if (!record || !['office', 'home'].includes(body.mode)) {
      throw new HttpError(400, 'Pick office or home');
    }
    if (body.mode === 'office' && [body.latitude, body.longitude, body.accuracy].some((value) => typeof value !== 'number')) {
      throw new HttpError(400, "Allow location so we can see you're at the office.");
    }
    const workMode = record.workMode ?? body.mode;
    if (record.punches.length > 0 && workMode !== body.mode) {
      throw new HttpError(409, `You started today ${workMode === 'home' ? 'working from home' : 'at the office'}. Punch ${record.punches.length % 2 ? 'out' : 'in'} the same way.`);
    }
    const isFirstFromHome = body.mode === 'home' && !db.homeDays.some((entry) => entry.employeeId === user.id && entry.date === today());
    if (isFirstFromHome) {
      db.homeDays = [{ id: `HW-${user.id}-${today()}`, employeeId: user.id, date: today(), status: 'pending' }, ...db.homeDays];
      if (user.managerId) {
        notify(user.managerId, 'approval', `${user.fullName} is working from home today. Approve it from Leave requests.`);
      }
    }
    const place = body.mode === 'home' ? 'Home' : user.workLocation;
    const homeStatus = body.mode === 'home' ? (record.homeStatus ?? 'pending') : undefined;
    const punched = punchNow({ record, workMode, place, homeStatus, schedules: db.schedules });
    db.attendance = db.attendance.map((entry) => (entry === record ? punched : entry));
    return punched;
  }],
  ['GET', /^\/api\/attendance\/corrections$/, ({ user }) => db.corrections.filter(({ employeeId }) => employeeId === user.id).map(withName)],
  ['POST', /^\/api\/attendance\/corrections$/, ({ user, body }) => {
    if (!DATE.test(String(body.date)) || body.date > today() || !TIME.test(String(body.requestedTime)) || !['missed-in', 'missed-out'].includes(body.kind)) {
      throw new HttpError(400, 'Say which day, which punch and what time');
    }
    const correction = { id: `AC-${randomUUID().slice(0, 6)}`, employeeId: user.id, date: body.date, kind: body.kind, requestedTime: body.requestedTime, reason: body.reason, status: 'pending', raisedOn: today() };
    db.corrections = [correction, ...db.corrections];
    return correction;
  }],

  ['GET', /^\/api\/leave\/types$/, () => db.leaveTypes],
  ['GET', /^\/api\/leave\/balances$/, ({ user }) => db.leaveBalances[user.id] ?? []],
  ['GET', /^\/api\/leave\/requests$/, ({ user }) => db.leaveRequests.filter(({ employeeId }) => employeeId === user.id).map(withName)],
  ['POST', /^\/api\/leave\/requests$/, ({ user, body }) => {
    // The real backend counts days itself. The mock trusts the client to keep things simple.
    const request = { id: `LR-${randomUUID().slice(0, 6)}`, employeeId: user.id, type: body.type, from: body.from, to: body.to, ...(body.halfDay && { halfDay: body.halfDay }), days: body.days, reason: body.reason, status: 'pending', appliedOn: today() };
    db.leaveRequests = [request, ...db.leaveRequests];
    return request;
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
  ['GET', /^\/api\/documents$/, ({ user }) => documentsOf(user)],
  ['GET', /^\/api\/documents\/([\w-]+)\/file$/, ({ user, params: [id], res }) => {
    const document = documentsOf(user).find((entry) => entry.id === id);
    if (!document) {
      throw new HttpError(404, 'Document not found');
    }
    // A one page sample PDF, named the way Spring names real documents.
    res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${document.name}.pdf"` });
    res.end(samplePdf(`${document.name} for ${user.fullName}`));
    return SENT;
  }],
  ['GET', /^\/api\/notifications$/, ({ user }) => db.notifications.filter(({ employeeId }) => employeeId === user.id)],
  ['POST', /^\/api\/notifications\/read$/, ({ user }) => {
    db.notifications = db.notifications.map((entry) => (entry.employeeId === user.id ? { ...entry, isRead: true } : entry));
    return undefined;
  }],

  ['GET', /^\/api\/team$/, ({ user }) => {
    requireManager(user);
    return reportsOf(user).map((employee) => ({
      ...profileOf(employee),
      today: db.attendance.find((record) => record.employeeId === employee.id && record.date === today()),
    }));
  }],
  ['GET', /^\/api\/team\/attendance$/, ({ user, query }) => {
    const reportIds = requireManager(user);
    return db.attendance.filter((record) => reportIds.has(record.employeeId)).filter(inMonth(query.get('month'))).map(withName);
  }],
  ['GET', /^\/api\/team\/leave-requests$/, ({ user, query }) => {
    const reportIds = requireManager(user);
    return db.leaveRequests.filter((entry) => reportIds.has(entry.employeeId)).filter(byStatus(query.get('status'))).map(withName);
  }],
  ['POST', /^\/api\/team\/leave-requests\/([\w-]+)\/decision$/, ({ user, params: [id], body }) => decide('leaveRequests', user, id, body)],
  ['GET', /^\/api\/team\/corrections$/, ({ user, query }) => {
    const reportIds = requireManager(user);
    return db.corrections.filter((entry) => reportIds.has(entry.employeeId)).filter(byStatus(query.get('status'))).map(withName);
  }],
  ['POST', /^\/api\/team\/corrections\/([\w-]+)\/decision$/, ({ user, params: [id], body }) => decide('corrections', user, id, body)],
  ['GET', /^\/api\/team\/home-days$/, ({ user, query }) => {
    const reportIds = requireManager(user);
    return db.homeDays.filter((entry) => reportIds.has(entry.employeeId)).filter(byStatus(query.get('status'))).map(withName);
  }],
  ['POST', /^\/api\/team\/home-days\/([\w-]+)\/decision$/, ({ user, params: [id], body }) => decide('homeDays', user, id, body)],
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
      leaveBalances: db.leaveBalances[id] ?? [],
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
    const visa = { employeeId: id, ...pick(body, ['workPermitNumber', 'visaNumber', 'visaIssuedOn', 'visaExpiry', 'passportExpiry']), passportLast4: String(body.passportLast4 ?? '').slice(-4) };
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
  ['POST', /^\/api\/hr\/leave-requests$/, ({ user, body }) => {
    requireHr(user);
    findOr404('employees', body.employeeId, 'Employee');
    // Recorded by HR on someone's behalf, so it starts approved.
    const request = {
      id: `LR-${randomUUID().slice(0, 6)}`, employeeId: body.employeeId, type: body.type, from: body.from, to: body.to, ...(body.halfDay && { halfDay: body.halfDay }),
      days: body.days, reason: body.reason, status: 'approved', appliedOn: today(), decidedBy: user.id, decidedOn: today(), recordedByHr: true,
    };
    db.leaveRequests = [request, ...db.leaveRequests];
    notify(request.employeeId, 'leave', `HR recorded ${sayDays(request.days)} of ${typeName(request.type)} for you, ${sayDates(request)}. ${sentence(String(request.reason))}`);
    return withName(request);
  }],
  ['POST', /^\/api\/hr\/leave-requests\/([\w-]+)\/decision$/, ({ user, params: [id], body }) => decide('leaveRequests', user, id, body, hrScope(user))],
  ['GET', /^\/api\/hr\/corrections$/, ({ user, query }) => {
    requireHr(user);
    return db.corrections.filter(byStatus(query.get('status'))).map(withName);
  }],
  ['POST', /^\/api\/hr\/corrections\/([\w-]+)\/decision$/, ({ user, params: [id], body }) => decide('corrections', user, id, body, hrScope(user))],
  ['GET', /^\/api\/hr\/home-days$/, ({ user, query }) => {
    requireHr(user);
    return db.homeDays.filter(byStatus(query.get('status'))).map(withName);
  }],
  ['POST', /^\/api\/hr\/home-days\/([\w-]+)\/decision$/, ({ user, params: [id], body }) => decide('homeDays', user, id, body, hrScope(user))],
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
  ['PUT', /^\/api\/hr\/leave-types\/([\w-]+)$/, ({ user, params: [code], body }) => {
    requireHr(user);
    const type = db.leaveTypes.find((entry) => entry.code === code);
    if (!type) {
      throw new HttpError(404, 'Leave type not found');
    }
    const updated = { ...type, ...pick(body, ['name', 'allowsHalfDay', 'defaultEntitlement', 'documentRequiredAfterDays']) };
    db.leaveTypes = db.leaveTypes.map((entry) => (entry.code === code ? updated : entry));
    return updated;
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
  ['GET', /^\/api\/hr\/punch-edits$/, ({ user, query }) => {
    requireHr(user);
    const employeeId = query.get('employeeId');
    return db.punchEdits.filter((edit) => !employeeId || edit.employeeId === employeeId).filter(inMonth(query.get('month'))).map(withByName);
  }],
  ['POST', /^\/api\/hr\/punch-edits$/, ({ user, body }) => {
    requireHr(user);
    const change = editPunch({ employeeId: body.employeeId, date: body.date, action: body.action, time: String(body.time ?? ''), reason: requireReason(body), by: user.id });
    notify(change.employeeId, 'record', `HR ${change.action === 'add' ? 'added' : 'removed'} a punch at ${sayTime(change.time)} on ${sayDate(change.date)}. ${sentence(change.reason)}`);
    return withByName(change);
  }],
  ['GET', /^\/api\/team\/([\w-]+)$/, ({ user, params: [id] }) => {
    const employee = reportsOf(user).find((report) => report.id === id);
    if (!employee) {
      throw new HttpError(404, 'Not one of your reports');
    }
    return { ...profileOf(employee), leaveBalances: db.leaveBalances[id] ?? [] };
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

createServer(async (req, res) => {
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
    const found = activeEmployees().find(({ id }) => id === sessions.get(token));
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
}).listen(PORT, () => console.log(`Mock API on http://localhost:${PORT}`));
