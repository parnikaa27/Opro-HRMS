// Mock of the Spring API for frontend development. Node built ins only, state lives in memory until restart.
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { buildAttendance, maldivesNow } from './attendance.mjs';

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
  holidays: load('holidays'),
  corrections: load('corrections'),
  announcements: load('announcements'),
  notifications: load('notifications'),
};
db.attendance = buildAttendance(db);

const sessions = new Map();

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const today = () => maldivesNow().date;
const nameOf = (employeeId) => db.employees.find(({ id }) => id === employeeId)?.fullName;
const withName = (item) => ({ ...item, employeeName: nameOf(item.employeeId) });
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

const decide = (collection, user, id, { decision, note }) => {
  const reportIds = requireManager(user);
  const item = db[collection].find((entry) => entry.id === id && reportIds.has(entry.employeeId));
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
  ['POST', /^\/api\/profile\/change-requests$/, () => ({ status: 'received' })],

  ['GET', /^\/api\/attendance$/, ({ user, query }) => db.attendance.filter((record) => record.employeeId === user.id).filter(inMonth(query.get('month')))],
  ['GET', /^\/api\/attendance\/corrections$/, ({ user }) => db.corrections.filter(({ employeeId }) => employeeId === user.id)],
  ['POST', /^\/api\/attendance\/corrections$/, ({ user, body }) => {
    const correction = { id: `AC-${randomUUID().slice(0, 6)}`, employeeId: user.id, date: body.date, kind: body.kind, requestedTime: body.requestedTime, reason: body.reason, status: 'pending', raisedOn: today() };
    db.corrections = [correction, ...db.corrections];
    return correction;
  }],

  ['GET', /^\/api\/leave\/types$/, () => db.leaveTypes],
  ['GET', /^\/api\/leave\/balances$/, ({ user }) => db.leaveBalances[user.id] ?? []],
  ['GET', /^\/api\/leave\/requests$/, ({ user }) => db.leaveRequests.filter(({ employeeId }) => employeeId === user.id)],
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
    send(res, result === undefined ? 204 : 200, result);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    if (status === 500) {
      console.error(error);
    }
    send(res, status, { message: status === 500 ? 'Something went wrong in the mock server' : error.message });
  }
}).listen(PORT, () => console.log(`Mock API on http://localhost:${PORT}`));
