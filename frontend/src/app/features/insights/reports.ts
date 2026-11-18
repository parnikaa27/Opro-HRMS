import { AttendanceDay } from '../../models/attendance';
import { Insights, PersonFact } from '../../models/insights';
import { daysUntil, formatHours, yearOf } from '../../shared/utils/date-time';
import { ReportTable } from '../../shared/utils/export';
import { summarise } from '../attendance/attendance-summary';
import { ageBand, genderLabel, isActive, isExpatriate, PAPERS, shares, yearsSince } from './insights';

export type ReportKind = 'headcount' | 'movement' | 'mix' | 'balances' | 'leave' | 'attendance' | 'papers';
export type MixBy = 'department' | 'nationality' | 'gender' | 'age' | 'employmentType';

export const REPORTS: readonly { kind: ReportKind; label: string; about: string }[] = [
  { kind: 'headcount', label: 'Headcount', about: 'Everyone at Opro today, with their department, nationality, gender, age and employment.' },
  { kind: 'movement', label: 'Joiners and leavers', about: 'Who joined and who left in a year: the basis for attrition and turnover.' },
  { kind: 'mix', label: 'Workforce mix', about: 'Headcount by department, nationality, gender, age or employment type.' },
  { kind: 'balances', label: 'Leave balances', about: 'Each person’s days this year by leave type: entitled, taken, waiting and left.' },
  { kind: 'leave', label: 'Leave taken', about: 'Every leave request in a year with its dates, days and status.' },
  { kind: 'attendance', label: 'Attendance', about: 'One row per person for a month: days present, late arrivals, missed days and hours.' },
  { kind: 'papers', label: 'Visa and permit expiry', about: 'Every expatriate’s visa, passport, employment approval, medical and insurance dates, soonest first.' },
];

export const MIX_BY: readonly { value: MixBy; label: string }[] = [
  { value: 'department', label: 'Department' },
  { value: 'nationality', label: 'Nationality' },
  { value: 'gender', label: 'Gender' },
  { value: 'age', label: 'Age' },
  { value: 'employmentType', label: 'Employment type' },
];

export interface ReportOptions {
  year: number;
  month: string;
  mixBy: MixBy;
  attendance: readonly AttendanceDay[];
  typeName: (code: string) => string;
}

const NO_DATE = '';
const MOVEMENT_DATE = 3;

const nameOf = (people: readonly PersonFact[]) => {
  const names = new Map(people.map(({ id, fullName }) => [id, fullName]));
  return (id: string) => names.get(id) ?? id;
};

const mixLabel = (by: MixBy, today: string) => (person: PersonFact) =>
  ({
    department: person.department,
    nationality: person.nationality,
    gender: genderLabel(person),
    age: ageBand(person.dateOfBirth, today),
    employmentType: person.employmentType,
  })[by];

const sortByName = <T extends readonly (string | number)[]>(rows: T[]) => rows.sort((first, second) => String(first[0]).localeCompare(String(second[0])));

// Builds one report as plain rows, the same for the table on screen and every export.
export const buildReport = (kind: ReportKind, { today, people, leave, balances }: Insights, options: ReportOptions): ReportTable => {
  const active = people.filter((person) => isActive(person, today));
  const name = nameOf(people);
  const year = String(options.year);
  switch (kind) {
    case 'headcount':
      return {
        title: 'Headcount',
        fileName: `headcount-${today}`,
        columns: ['Name', 'Employee ID', 'Department', 'Designation', 'Nationality', 'Gender', 'Age', 'Employment', 'Joined'],
        rows: sortByName(active.map((person) => [person.fullName, person.id, person.department, person.designation, person.nationality, genderLabel(person),
          person.dateOfBirth ? yearsSince(person.dateOfBirth, today) : NO_DATE, person.employmentType, person.joinedOn])),
      };
    case 'movement':
      return {
        title: `Joiners and leavers, ${year}`,
        fileName: `joiners-and-leavers-${year}`,
        columns: ['Name', 'Department', 'Change', 'Date'],
        rows: [
          ...people.filter(({ joinedOn }) => joinedOn.startsWith(year)).map((person) => [person.fullName, person.department, 'Joined', person.joinedOn]),
          ...people.filter(({ lastDay }) => lastDay?.startsWith(year)).map((person) => [person.fullName, person.department, 'Left', person.lastDay ?? NO_DATE]),
        ].sort((first, second) => String(first[MOVEMENT_DATE]).localeCompare(String(second[MOVEMENT_DATE]))),
      };
    case 'mix': {
      const label = MIX_BY.find(({ value }) => value === options.mixBy)?.label ?? '';
      return {
        title: `Workforce by ${label.toLowerCase()}`,
        fileName: `workforce-by-${options.mixBy}-${today}`,
        columns: [label, 'People', 'Share'],
        rows: shares(active, mixLabel(options.mixBy, today)).map(({ label: group, count, percent }) => [group, count, `${percent}%`]),
      };
    }
    case 'balances':
      return {
        title: `Leave balances, ${yearOf(today)}`,
        fileName: `leave-balances-${yearOf(today)}`,
        columns: ['Name', 'Leave type', 'Entitled', 'Taken', 'Waiting', 'Left'],
        rows: sortByName(balances.map(({ employeeId, type, entitled, taken, pending }) => [name(employeeId), options.typeName(type), entitled, taken, pending, entitled - taken - pending])),
      };
    case 'leave':
      return {
        title: `Leave taken, ${year}`,
        fileName: `leave-${year}`,
        columns: ['Name', 'Leave type', 'From', 'To', 'Days', 'Status'],
        rows: leave
          .filter(({ from }) => from.startsWith(year))
          .sort((first, second) => first.from.localeCompare(second.from))
          .map(({ employeeId, type, from, to, days, status }) => [name(employeeId), options.typeName(type), from, to, days, status]),
      };
    case 'attendance': {
      const days = options.attendance.filter(({ date }) => date <= today);
      return {
        title: `Attendance, ${options.month}`,
        fileName: `attendance-${options.month}`,
        columns: ['Name', 'Days present', 'Working days', 'Late', 'Missed', 'Hours', 'On time'],
        rows: sortByName(active.map((person) => {
          const own = days.filter(({ employeeId }) => employeeId === person.id);
          const summary = summarise(own);
          const missed = own.filter(({ status }) => status === 'absent' || status === 'incomplete').length;
          return [person.fullName, summary.present, summary.workingDays, summary.lateCount, missed, formatHours(summary.workedMinutes), `${summary.onTimePercent}%`];
        })),
      };
    }
    case 'papers': {
      const soonest = (person: PersonFact) => Math.min(...PAPERS.flatMap(({ dateOf }) => (dateOf(person) ? [daysUntil(dateOf(person) ?? '', today)] : [])));
      return {
        title: 'Visa and permit expiry',
        fileName: `visa-and-permit-expiry-${today}`,
        columns: ['Name', ...PAPERS.map(({ label }) => label), 'Soonest, days'],
        rows: active
          .filter(isExpatriate)
          .map((person) => ({ person, days: soonest(person) }))
          .sort((first, second) => first.days - second.days)
          .map(({ person, days }) => [person.fullName, ...PAPERS.map(({ dateOf }) => dateOf(person) ?? 'None'), Number.isFinite(days) ? days : 'No papers']),
      };
    }
  }
};
