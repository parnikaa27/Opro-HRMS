import { Insights } from '../../models/insights';
import { buildReport, ReportOptions } from './reports';

const FACTS: Insights = {
  today: '2026-11-12',
  people: [
    { id: 'B', fullName: 'Priya Nair', department: 'Operations', designation: 'Officer', nationality: 'Indian', gender: 'female', dateOfBirth: '1992-11-20', joinedOn: '2022-08-14', employmentType: 'Permanent', visaExpiry: '2027-08-14', passportExpiry: '2031-06-30' },
    { id: 'A', fullName: 'Karan Mehta', department: 'Operations', designation: 'Lead', nationality: 'Maldivian', gender: 'male', joinedOn: '2026-02-01', employmentType: 'Contract' },
    { id: 'C', fullName: 'Rohit Verma', department: 'Logistics', designation: 'Coordinator', nationality: 'Indian', joinedOn: '2020-11-02', lastDay: '2026-06-30', employmentType: 'Permanent' },
    { id: 'D', fullName: 'Arjun Reddy', department: 'Operations', designation: 'Engineer', nationality: 'Indian', joinedOn: '2023-12-20', employmentType: 'Contract', visaExpiry: '2026-11-02' },
  ],
  leave: [
    { employeeId: 'B', type: 'annual', from: '2026-12-20', to: '2026-12-24', days: 3, status: 'pending', appliedOn: '2026-11-10' },
    { employeeId: 'A', type: 'sick', from: '2025-05-01', to: '2025-05-01', days: 1, status: 'approved', appliedOn: '2025-05-01' },
  ],
  balances: [{ employeeId: 'B', type: 'annual', entitled: 30, taken: 12, pending: 3 }],
  quotas: [],
};
const OPTIONS: ReportOptions = {
  year: 2026,
  month: '2026-11',
  mixBy: 'department',
  attendance: [
    { employeeId: 'B', date: '2026-11-10', status: 'late', punches: [{ at: '2026-11-10T09:30:00+05:00', direction: 'in' }], workedMinutes: 450 },
    { employeeId: 'B', date: '2026-11-11', status: 'absent', punches: [], workedMinutes: 0 },
    { employeeId: 'B', date: '2026-11-20', status: 'present', punches: [], workedMinutes: 0 },
  ],
  typeName: (code) => ({ annual: 'Annual leave', sick: 'Sick leave' })[code] ?? code,
};

describe('buildReport', () => {
  it('lists headcount by name, leaving out people who have left', () => {
    const report = buildReport('headcount', FACTS, OPTIONS);

    expect(report.fileName).toBe('headcount-2026-11-12');
    expect(report.rows.map((row) => row[0])).toEqual(['Arjun Reddy', 'Karan Mehta', 'Priya Nair']);
    expect(report.rows[2]).toEqual(['Priya Nair', 'B', 'Operations', 'Officer', 'Indian', 'Female', 33, 'Permanent', '2022-08-14']);
  });

  it('puts the year’s joiners and leavers in date order', () => {
    expect(buildReport('movement', FACTS, OPTIONS).rows).toEqual([
      ['Karan Mehta', 'Operations', 'Joined', '2026-02-01'],
      ['Rohit Verma', 'Logistics', 'Left', '2026-06-30'],
    ]);
  });

  it('groups the workforce by the chosen dimension', () => {
    expect(buildReport('mix', FACTS, OPTIONS).rows).toEqual([['Operations', 3, '100%']]);
    expect(buildReport('mix', FACTS, { ...OPTIONS, mixBy: 'gender' }).columns[0]).toBe('Gender');
  });

  it('shows balances with what’s left, and the year’s leave with type names', () => {
    expect(buildReport('balances', FACTS, OPTIONS).rows).toEqual([['Priya Nair', 'Annual leave', 30, 12, 3, 15]]);
    expect(buildReport('leave', FACTS, OPTIONS).rows).toEqual([['Priya Nair', 'Annual leave', '2026-12-20', '2026-12-24', 3, 'pending']]);
    expect(buildReport('leave', FACTS, { ...OPTIONS, year: 2025 }).rows).toEqual([['Karan Mehta', 'Sick leave', '2025-05-01', '2025-05-01', 1, 'approved']]);
  });

  it('sums each person’s month of attendance up to today', () => {
    const priya = buildReport('attendance', FACTS, OPTIONS).rows.find((row) => row[0] === 'Priya Nair');

    expect(priya).toEqual(['Priya Nair', 1, 2, 1, 1, '07h 30m', '0%']);
  });

  it('lists expatriates’ papers, soonest first', () => {
    const report = buildReport('papers', FACTS, OPTIONS);

    expect(report.columns).toEqual(['Name', 'Visa', 'Passport', 'Employment approval', 'Work permit medical', 'Medical insurance', 'Soonest, days']);
    expect(report.rows).toEqual([
      ['Arjun Reddy', '2026-11-02', 'None', 'None', 'None', 'None', -10],
      ['Priya Nair', '2027-08-14', '2031-06-30', 'None', 'None', 'None', 275],
    ]);
  });
});
