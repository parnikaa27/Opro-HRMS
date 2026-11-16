import { AttendanceDay } from '../../models/attendance';
import { statusToday } from './attendance-status';

const day = (overrides: Partial<AttendanceDay>): AttendanceDay => ({
  employeeId: 'E', date: '2026-11-12', status: 'present', punches: [], workedMinutes: 0, ...overrides,
});

describe('statusToday', () => {
  it('adds "from home" for someone working from home, but not once the day is declined', () => {
    expect(statusToday(day({ status: 'late', workMode: 'home', homeStatus: 'pending' }))).toEqual({ label: 'Late · from home', tone: 'late' });
    expect(statusToday(day({ status: 'absent', workMode: 'home', homeStatus: 'rejected' }))).toEqual({ label: 'Absent', tone: 'danger' });
    expect(statusToday(day({ workMode: 'office' }))).toEqual({ label: 'Present', tone: 'ok' });
    expect(statusToday(undefined)).toEqual({ label: 'Not in yet', tone: 'neutral' });
  });
});
