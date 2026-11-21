// The reports the server builds, and how the workforce mix can be grouped. Spring's Reports names the same kinds.
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
