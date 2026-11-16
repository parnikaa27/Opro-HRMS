import { AttendanceStatus } from '../../models/attendance';
import { Visa } from '../../models/employee';
import { employee } from '../../../testing/fixtures';
import { HrEmployee } from './hr-api';

const visa = (overrides: Partial<Visa> = {}): Visa => ({
  workPermitNumber: 'WP',
  visaNumber: 'MV-EV-1',
  passportLast4: '1234',
  visaIssuedOn: '2025-01-01',
  visaExpiry: '2027-06-01',
  passportExpiry: '2030-01-01',
  ...overrides,
});

const today = (status: AttendanceStatus) => ({ employeeId: '', date: '2026-11-12', status, punches: [], workedMinutes: 0});

export const PEOPLE: HrEmployee[] = [
  { ...employee({ visa: visa({ visaExpiry: '2026-12-20' }) }), today: today('present') },
  { ...employee({ id: 'OPR-0021', fullName: 'Rohit Verma', nationality: 'Indian', visa: visa({ visaExpiry: '2026-11-02' }) }), today: today('absent') },
  { ...employee({ id: 'OPR-0015', fullName: 'Priya Nair', nationality: 'Indian' }), today: today('late') },
  { ...employee({ id: 'OPR-0001', fullName: 'Rajesh Sharma', nationality: 'Maldivian' }), today: today('on-leave') },
];
