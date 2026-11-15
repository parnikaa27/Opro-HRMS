import { AttendanceDay } from '../../models/attendance';
import { NOW, TODAY } from '../../../testing/fixtures';
import { toAttendanceRow } from './attendance-rows';

const at = (time: string, date = TODAY) => `${date}T${time}:00+05:00`;
const day = (overrides: Partial<AttendanceDay>): AttendanceDay => ({
  employeeId: 'E', date: TODAY, status: 'present', punches: [], workedMinutes: 0, overtimeMinutes: 0, ...overrides,
});

describe('toAttendanceRow', () => {
  it('says where someone is while they are still punched in', () => {
    const office = toAttendanceRow(day({ workMode: 'office', punches: [{ at: at('08:55'), direction: 'in' }] }), TODAY, NOW);
    const home = toAttendanceRow(day({ workMode: 'home', homeStatus: 'pending', punches: [{ at: at('08:55'), direction: 'in' }] }), TODAY, NOW);

    expect(office.status.label).toBe('In office');
    expect(office.homeNote).toBeUndefined();
    expect(home.status.label).toBe('Working from home');
    expect(home.homeNote).toBe('From home, waiting for approval');
  });

  it('marks an approved home day in the log', () => {
    const row = toAttendanceRow(day({ date: '2026-11-10', workMode: 'home', homeStatus: 'approved', workedMinutes: 480, punches: [{ at: at('09:00', '2026-11-10'), direction: 'in' }, { at: at('17:00', '2026-11-10'), direction: 'out' }] }), TODAY, NOW);

    expect(row.hours).toBe('08h 00m');
    expect(row.homeNote).toBe('From home');
  });

  it('shows a declined home day as an absence with no hours, even while punched in', () => {
    const row = toAttendanceRow(day({ status: 'absent', workMode: 'home', homeStatus: 'rejected', punches: [{ at: at('08:55'), direction: 'in' }] }), TODAY, NOW);

    expect(row.status.label).toBe('Absent');
    expect(row.hours).toBe('00h 00m');
    expect(row.homeNote).toBe('From home, not approved');
  });
});
