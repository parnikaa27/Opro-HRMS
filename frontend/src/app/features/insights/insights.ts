import { EXPIRY_WARNING_DAYS } from '../../core/config';
import { AttendanceStatus } from '../../models/attendance';
import { BalanceFact, LeaveFact, PersonFact } from '../../models/insights';
import { Quota } from '../../models/record';
import { addDays, addMonths, daysUntil, monthDayOf, monthNumberOf, monthOf, yearOf } from '../../shared/utils/date-time';

const PERCENT = 100;
const NATIONAL = 'Maldivian';
// Age bands of ten years: under 25, 25 to 34 and so on, up to 55 and over.
const FIRST_BAND_STARTS = 25;
const LAST_BAND_STARTS = 55;
const BAND_YEARS = 10;
const HALVES = 2;
const IN_TODAY: readonly AttendanceStatus[] = ['present', 'late', 'half-day', 'incomplete'];
const PROBATION_WINDOW_DAYS = 30;
const TREND_MONTHS = 6;

export interface Share {
  label: string;
  count: number;
  percent: number;
}

export const percentOf = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * PERCENT) : 0);

// Groups people by a label and counts them, biggest first.
export const shares = <T>(items: readonly T[], labelOf: (item: T) => string): Share[] => {
  const counts = items.reduce((map, item) => map.set(labelOf(item), (map.get(labelOf(item)) ?? 0) + 1), new Map<string, number>());
  return [...counts]
    .map(([label, count]) => ({ label, count, percent: percentOf(count, items.length) }))
    .sort((first, second) => second.count - first.count || first.label.localeCompare(second.label));
};

export const isActive = ({ lastDay }: PersonFact, today: string) => !lastDay || lastDay >= today;
export const isExpatriate = ({ nationality }: PersonFact) => nationality !== NATIONAL;

// Whole years from a date to today.
export const yearsSince = (date: string, today: string) => {
  const years = yearOf(today) - yearOf(date);
  return monthDayOf(today) < monthDayOf(date) ? years - 1 : years;
};

export const ageBand = (dateOfBirth: string | undefined, today: string) => {
  if (!dateOfBirth) {
    return 'Not recorded';
  }
  const age = yearsSince(dateOfBirth, today);
  if (age < FIRST_BAND_STARTS) {
    return `Under ${FIRST_BAND_STARTS}`;
  }
  const start = Math.min(LAST_BAND_STARTS, FIRST_BAND_STARTS + Math.floor((age - FIRST_BAND_STARTS) / BAND_YEARS) * BAND_YEARS);
  return start === LAST_BAND_STARTS ? `${LAST_BAND_STARTS} and over` : `${start} to ${start + BAND_YEARS - 1}`;
};

export const genderLabel = ({ gender }: PersonFact) => (gender === 'female' ? 'Female' : gender === 'male' ? 'Male' : 'Not recorded');

// Headcount, joiners, leavers and turnover for the leave year so far.
export const workforce = (people: readonly PersonFact[], today: string) => {
  const yearStart = `${yearOf(today)}-01-01`;
  const active = people.filter((person) => isActive(person, today));
  const atStart = people.filter(({ joinedOn, lastDay }) => joinedOn < yearStart && (!lastDay || lastDay >= yearStart));
  const joiners = people.filter(({ joinedOn }) => joinedOn >= yearStart && joinedOn <= today);
  const leavers = people.filter(({ lastDay }) => lastDay !== undefined && lastDay >= yearStart && lastDay < today);
  const averageHeadcount = (atStart.length + active.length) / HALVES;
  const stayed = atStart.filter((person) => isActive(person, today)).length;
  return {
    active,
    total: active.length,
    joiners,
    leavers,
    growthPercent: percentOf(active.length - atStart.length, atStart.length),
    attritionPercent: averageHeadcount > 0 ? Math.round((leavers.length / averageHeadcount) * PERCENT) : 0,
    retentionPercent: percentOf(stayed, atStart.length),
    expatriates: active.filter(isExpatriate).length,
    locals: active.filter((person) => !isExpatriate(person)).length,
  };
};

// Where everyone is today, from the attendance the server worked out.
export const presence = (active: readonly PersonFact[]) => {
  const status = (person: PersonFact) => person.today?.status;
  const isIn = (person: PersonFact) => IN_TODAY.includes(status(person) ?? 'absent') && (person.today?.punches.length ?? 0) > 0;
  return {
    present: active.filter(isIn).length,
    late: active.filter((person) => status(person) === 'late').length,
    absent: active.filter((person) => status(person) === 'absent').length,
    onLeave: active.filter((person) => status(person) === 'on-leave').length,
    fromHome: active.filter((person) => isIn(person) && person.today?.workMode === 'home').length,
    atResort: active.filter((person) => isIn(person) && person.today?.workMode === 'resort').length,
  };
};

// Leave waiting, annual leave used so far this year, and sick days by month for the last six months.
export const leaveSummary = (leave: readonly LeaveFact[], balances: readonly BalanceFact[], today: string) => {
  const annual = balances.filter(({ type }) => type === 'annual');
  const entitled = annual.reduce((sum, { entitled }) => sum + entitled, 0);
  const taken = annual.reduce((sum, { taken }) => sum + taken, 0);
  const months = Array.from({ length: TREND_MONTHS }, (_, index) => addMonths(monthOf(today), index - TREND_MONTHS + 1));
  const sick = leave.filter(({ type, status }) => type === 'sick' && status === 'approved');
  return {
    pending: leave.filter(({ status }) => status === 'pending').length,
    annualUsedPercent: percentOf(taken, entitled),
    sickByMonth: months.map((month) => ({ month, days: sick.filter(({ from }) => monthOf(from) === month).reduce((sum, { days }) => sum + days, 0) })),
  };
};

export type PaperKind = 'visa' | 'passport' | 'approval' | 'medical' | 'insurance';

export const PAPERS: readonly { kind: PaperKind; label: string; dateOf: (person: PersonFact) => string | undefined }[] = [
  { kind: 'visa', label: 'Visa', dateOf: ({ visaExpiry }) => visaExpiry },
  { kind: 'passport', label: 'Passport', dateOf: ({ passportExpiry }) => passportExpiry },
  { kind: 'approval', label: 'Employment approval', dateOf: ({ employmentApprovalExpiry }) => employmentApprovalExpiry },
  { kind: 'medical', label: 'Work permit medical', dateOf: ({ medicalDueOn }) => medicalDueOn },
  { kind: 'insurance', label: 'Medical insurance', dateOf: ({ insuranceExpiry }) => insuranceExpiry },
];

// For each kind of paper, how many have run out and how many run out within 60 days.
export const compliance = (active: readonly PersonFact[], quotas: readonly Quota[], today: string) => ({
  papers: PAPERS.map(({ kind, label, dateOf }) => {
    const left = active.flatMap((person) => {
      const date = dateOf(person);
      return date ? [daysUntil(date, today)] : [];
    });
    return { kind, label, expired: left.filter((days) => days < 0).length, expiring: left.filter((days) => days >= 0 && days <= EXPIRY_WARNING_DAYS).length };
  }),
  quotaUsed: quotas.reduce((sum, { used }) => sum + used, 0),
  quotaSlots: quotas.reduce((sum, { slots }) => sum + slots, 0),
  quotasFull: quotas.filter(({ used, slots }) => used >= slots).map(({ jobCategory }) => jobCategory),
  missingVisa: active.filter((person) => isExpatriate(person) && !person.visaExpiry).length,
});

// This month's birthdays and work anniversaries, probation ending within 30 days, contracts within 60.
export const peopleEvents = (active: readonly PersonFact[], today: string) => {
  const month = monthNumberOf(today);
  const within = (date: string | undefined, days: number) => date !== undefined && date >= today && date <= addDays(today, days);
  return {
    birthdays: active
      .filter(({ dateOfBirth }) => dateOfBirth !== undefined && monthNumberOf(dateOfBirth) === month)
      .sort((first, second) => monthDayOf(first.dateOfBirth ?? '').localeCompare(monthDayOf(second.dateOfBirth ?? ''))),
    anniversaries: active
      .filter(({ joinedOn }) => monthNumberOf(joinedOn) === month && yearOf(joinedOn) < yearOf(today))
      .sort((first, second) => monthDayOf(first.joinedOn).localeCompare(monthDayOf(second.joinedOn))),
    probation: active.filter(({ probationEndsOn }) => within(probationEndsOn, PROBATION_WINDOW_DAYS)),
    contracts: active.filter(({ contractEndsOn }) => within(contractEndsOn, EXPIRY_WARNING_DAYS)),
  };
};
