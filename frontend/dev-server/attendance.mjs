// Builds believable attendance for the last few weeks, relative to today, so the demo never goes stale.
// Same employee and date always give the same result.

const DAYS_OF_HISTORY = 62;
const WEEKEND = new Set([5, 6]); // Friday, Saturday

// FNV-1a plus a murmur style finaliser, so seeds that differ only in the last characters still spread evenly.
const mix = (hash, shift, multiplier) => Math.imul(hash ^ (hash >>> shift), multiplier);
const seeded = (seed) => {
  const fnv = [...seed].reduce((hash, char) => Math.imul(hash ^ char.charCodeAt(0), 16777619), 2166136261);
  const mixed = mix(mix(fnv, 16, 0x85ebca6b), 13, 0xc2b2ae35);
  return ((mixed ^ (mixed >>> 16)) >>> 0) / 2 ** 32;
};

const between = (seed, min, max) => min + Math.floor(seeded(seed) * (max - min));

const pad = (value) => String(value).padStart(2, '0');
export const toMinutes = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
export const toTime = (minutes) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

// The schedule version in force on a date: the latest one that started on or before it.
export const rulesOn = (schedules, date) =>
  [...schedules].sort((first, second) => second.effectiveFrom.localeCompare(first.effectiveFrom)).find(({ effectiveFrom }) => effectiveFrom <= date);
const toIso = (date, minutes) => `${date}T${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}:00+05:00`;

const addDays = (date, offset) => {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + offset);
  return day.toISOString().slice(0, 10);
};

// MOCK_NOW pins the mock's clock (an ISO time) so previews and tests can show a working day.
export const clockNow = () => (process.env.MOCK_NOW ? new Date(process.env.MOCK_NOW) : new Date());

export const maldivesNow = () => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Indian/Maldives', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(clockNow()).map(({ type, value }) => [type, value]),
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
};

const workedMinutes = (punchMinutes) =>
  punchMinutes.reduce((total, minute, index) => (index % 2 === 1 ? total + minute - punchMinutes[index - 1] : total), 0);

const workday = (employeeId, date, isToday, nowMinutes, rules) => {
  const SHIFT_START = toMinutes(rules.shiftStart);
  const SHIFT_END = toMinutes(rules.shiftEnd);
  const seed = `${employeeId}${date}`;
  const roll = seeded(seed);
  if (roll < 0.04 && !isToday) {
    return { status: 'absent', punchMinutes: [] };
  }
  const isLate = roll >= 0.08 && roll < 0.2;
  const isHalfDay = roll >= 0.2 && roll < 0.24;
  const firstIn = isLate ? between(`${seed}in`, SHIFT_START + rules.graceMinutes + 1, SHIFT_START + 50) : between(`${seed}in`, SHIFT_START - 20, SHIFT_START + 14);
  const lastOut = isHalfDay ? between(`${seed}out`, 12 * 60 + 20, 12 * 60 + 50) : between(`${seed}out`, SHIFT_END, SHIFT_END + 50);
  const hasLunchPunches = !isHalfDay && seeded(`${seed}lunch`) < 0.5;
  const lunch = hasLunchPunches ? [between(`${seed}lo`, 12 * 60 + 30, 12 * 60 + 55), between(`${seed}li`, 13 * 60 + 15, 13 * 60 + 40)] : [];
  const missedOut = roll >= 0.04 && roll < 0.08 && !isToday;
  const allPunches = [firstIn, ...lunch, ...(missedOut ? [] : [lastOut])];
  const punchMinutes = isToday ? allPunches.filter((minute) => minute <= nowMinutes) : allPunches;

  if (punchMinutes.length === 0) {
    return { status: 'not-in-yet', punchMinutes };
  }
  if (missedOut) {
    return { status: 'incomplete', punchMinutes };
  }
  return { status: isLate ? 'late' : isHalfDay ? 'half-day' : 'present', punchMinutes };
};

const toRecord = ({ employeeId, date, status, punchMinutes, device, rules }) => {
  const isComplete = punchMinutes.length % 2 === 0 && punchMinutes.length > 0;
  const lastOut = isComplete ? punchMinutes.at(-1) : undefined;
  const shiftLength = toMinutes(rules.shiftEnd) - toMinutes(rules.shiftStart);
  return {
    employeeId,
    date,
    status,
    punches: punchMinutes.map((minute, index) => ({ at: toIso(date, minute), direction: index % 2 === 0 ? 'in' : 'out', device })),
    ...(punchMinutes.length > 0 && { firstIn: toIso(date, punchMinutes[0]), expectedOut: toIso(date, punchMinutes[0] + shiftLength), scheduledMinutes: shiftLength }),
    ...(lastOut !== undefined && { lastOut: toIso(date, lastOut) }),
    workedMinutes: isComplete ? workedMinutes(punchMinutes) : 0,
    overtimeMinutes: lastOut !== undefined ? Math.max(0, lastOut - toMinutes(rules.shiftEnd)) : 0,
  };
};

// What the backend does after HR edits punches: pair them again and work the day out from scratch.
const statusFor = (punchMinutes, rules, isToday) => {
  if (punchMinutes.length === 0) {
    return isToday ? 'not-in-yet' : 'absent';
  }
  const isLate = punchMinutes[0] > toMinutes(rules.shiftStart) + rules.graceMinutes;
  if (punchMinutes.length % 2 === 1) {
    return isToday ? (isLate ? 'late' : 'present') : 'incomplete';
  }
  return workedMinutes(punchMinutes) < rules.halfDayMinutes ? 'half-day' : isLate ? 'late' : 'present';
};

export const rebuildDay = ({ record, punchMinutes, schedules }) => {
  const rules = rulesOn(schedules, record.date);
  const sorted = [...punchMinutes].sort((first, second) => first - second);
  const isToday = record.date === maldivesNow().date;
  return {
    ...toRecord({ employeeId: record.employeeId, date: record.date, status: statusFor(sorted, rules, isToday), punchMinutes: sorted, device: record.punches[0]?.device ?? 'Front desk', rules }),
    isEditedByHr: true,
  };
};

export const buildAttendance = ({ employees, holidays, leaveRequests, schedules }) => {
  const now = maldivesNow();
  const holidayDates = new Set(holidays.map(({ date }) => date));
  const isOnLeave = (employeeId, date) =>
    leaveRequests.some((leave) => leave.employeeId === employeeId && leave.status === 'approved' && leave.from <= date && leave.to >= date);

  const dates = Array.from({ length: DAYS_OF_HISTORY }, (_, index) => addDays(now.date, index - DAYS_OF_HISTORY + 1));

  return employees.flatMap(({ id: employeeId, workLocation }) =>
    dates.map((date) => {
      const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
      const offDay = WEEKEND.has(weekday) ? 'weekend' : holidayDates.has(date) ? 'holiday' : isOnLeave(employeeId, date) ? 'on-leave' : undefined;
      const rules = rulesOn(schedules, date);
      const day = offDay ? { status: offDay, punchMinutes: [] } : workday(employeeId, date, date === now.date, now.minutes, rules);
      return toRecord({ employeeId, date, device: workLocation === 'Hulhumalé site' ? 'Site gate' : 'Front desk', rules, ...day });
    }),
  );
};
