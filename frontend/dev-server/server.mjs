// Mock of the Spring API for frontend development. Node built ins only, state lives in memory until restart.
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { buildAttendance, clockNow, maldivesNow } from './attendance.mjs';

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
};
db.attendance = buildAttendance(db);

const longDate = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const sessions = new Map();
const SENT = Symbol('sent');
const MINUTE_MS = 60_000;

// Sync times are relative to now so the "synced 3 min ago" label always reads true.
const devices = () => [
  { id: 'OPR-MLE-01', name: 'Front desk', location: 'Malé office', isOnline: true, lastSyncAt: new Date(clockNow().getTime() - 3 * MINUTE_MS).toISOString() },
  { id: 'OPR-HMH-01', name: 'Site gate', location: 'Hulhumalé site', isOnline: true, lastSyncAt: new Date(clockNow().getTime() - 11 * MINUTE_MS).toISOString() },
];

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
const withVisa = (employee) => ({ ...employee, visa: db.visas.find(({ employeeId }) => employeeId === employee.id) });
const reportsOf = (user) => db.employees.filter(({ managerId }) => managerId === user.id);

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
    ...db.employees.map(({ id }) => ({ id: `NT-${randomUUID().slice(0, 6)}`, employeeId: id, kind, text, createdOn: today(), isRead: false })),
    ...db.notifications,
  ];
};

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

const decide = (collection, user, id, { decision, note }, inScope = managerScope(user)) => {
  const item = db[collection].find((entry) => entry.id === id && inScope(entry));
  if (!item) {
    throw new HttpError(404, 'Request not found');
  }
  if (item.status !== 'pending' || !['approved', 'rejected'].includes(decision)) {
    throw new HttpError(409, 'This request has already been decided');
  }
  const decided = { ...item, status: decision, decidedBy: user.id, decidedOn: today(), ...(note && { decisionNote: String(note) }) };
  db[collection] = db[collection].map((entry) => (entry.id === id ? decided : entry));
  return withName(decided);
};

const routes = [
  ['GET', /^\/api\/session\/users$/, () => db.employees.map(({ id, fullName, designation, roles }) => ({ id, fullName, designation, roles })), { isPublic: true }],
  ['POST', /^\/api\/session\/login$/, ({ body, res }) => {
    if (!db.employees.some(({ id }) => id === body.employeeId)) {
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

  ['GET', /^\/api\/me$/, ({ user }) => withVisa(user)],
  ['POST', /^\/api\/profile\/change-requests$/, ({ user, body }) => {
    const request = { id: `CR-${randomUUID().slice(0, 6)}`, employeeId: user.id, field: String(body.field), details: String(body.details), status: 'open', raisedOn: today() };
    db.changeRequests = [request, ...db.changeRequests];
    return request;
  }],

  ['GET', /^\/api\/attendance$/, ({ user, query }) => db.attendance.filter((record) => record.employeeId === user.id).filter(inMonth(query.get('month')))],
  ['GET', /^\/api\/attendance\/corrections$/, ({ user }) => db.corrections.filter(({ employeeId }) => employeeId === user.id).map(withName)],
  ['POST', /^\/api\/attendance\/corrections$/, ({ user, body }) => {
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
  ['GET', /^\/api\/devices$/, () => devices()],
  ['GET', /^\/api\/documents$/, ({ user }) => documentsOf(user)],
  ['GET', /^\/api\/documents\/([\w-]+)\/file$/, ({ user, params: [id], res }) => {
    const document = documentsOf(user).find((entry) => entry.id === id);
    if (!document) {
      throw new HttpError(404, 'Document not found');
    }
    // A stand in file. Real documents come from storage once the backend exists.
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Disposition': `attachment; filename="${id}.txt"` });
    res.end(`${document.name} for ${user.fullName}\nThis is a sample file from the mock server.\n`);
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
      ...withVisa(employee),
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
  ['GET', /^\/api\/hr\/employees$/, ({ user }) => {
    requireHr(user);
    return db.employees.map((employee) => ({ ...withVisa(employee), today: db.attendance.find((record) => record.employeeId === employee.id && record.date === today()) }));
  }],
  ['GET', /^\/api\/hr\/employees\/([\w-]+)$/, ({ user, params: [id] }) => {
    requireHr(user);
    const employee = findOr404('employees', id, 'Employee');
    return {
      ...withVisa(employee),
      leaveBalances: db.leaveBalances[id] ?? [],
      adjustments: db.adjustments.filter(({ employeeId }) => employeeId === id).map((entry) => ({ ...entry, byName: nameOf(entry.by) })),
    };
  }],
  ['PUT', /^\/api\/hr\/employees\/([\w-]+)\/visa$/, ({ user, params: [id], body }) => {
    requireHr(user);
    findOr404('employees', id, 'Employee');
    // Only the last 4 passport digits are ever stored or sent.
    const visa = { employeeId: id, ...pick(body, ['workPermitNumber', 'visaNumber', 'visaIssuedOn', 'visaExpiry', 'passportExpiry']), passportLast4: String(body.passportLast4 ?? '').slice(-4) };
    db.visas = [...db.visas.filter(({ employeeId }) => employeeId !== id), visa];
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
    return withName(request);
  }],
  ['POST', /^\/api\/hr\/leave-requests\/([\w-]+)\/decision$/, ({ user, params: [id], body }) => decide('leaveRequests', user, id, body, hrScope(user))],
  ['GET', /^\/api\/hr\/corrections$/, ({ user, query }) => {
    requireHr(user);
    return db.corrections.filter(byStatus(query.get('status'))).map(withName);
  }],
  ['POST', /^\/api\/hr\/corrections\/([\w-]+)\/decision$/, ({ user, params: [id], body }) => decide('corrections', user, id, body, hrScope(user))],
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
      notifyEveryone('holiday', `${updated.name} is confirmed for ${longDate.format(new Date(`${updated.date}T00:00:00Z`))}`);
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
  ['GET', /^\/api\/team\/([\w-]+)$/, ({ user, params: [id] }) => {
    const employee = reportsOf(user).find((report) => report.id === id);
    if (!employee) {
      throw new HttpError(404, 'Not one of your reports');
    }
    return { ...withVisa(employee), leaveBalances: db.leaveBalances[id] ?? [] };
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
    const user = db.employees.find(({ id }) => id === sessions.get(token));
    if (!user && !options.isPublic) {
      throw new HttpError(401, 'Please sign in');
    }

    const body = method === 'GET' ? {} : await readBody(req);
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
