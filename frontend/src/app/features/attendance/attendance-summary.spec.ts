import { AttendanceDay } from '../../models/attendance';
import { summarise } from './attendance-summary';

const day = (status: AttendanceDay['status'], workedMinutes = 0): AttendanceDay => ({
  employeeId: 'E', date: '2026-11-01', status, punches: workedMinutes ? [{ at: '2026-11-01T09:00:00+05:00', direction: 'in' }] : [], workedMinutes,
});

describe('summarise', () => {
  it('counts attendance against working days, and leaves days off out', () => {
    expect(summarise([day('present', 480), day('late', 420), day('absent'), day('weekend'), day('holiday'), day('on-leave')])).toEqual({
      workingDays: 3,
      present: 2,
      attendancePercent: 67,
      workedMinutes: 900,
      averageMinutes: 450,
      onTimePercent: 50,
      lateCount: 1,
    });
  });

  it('gives zeros rather than dividing by nothing', () => {
    expect(summarise([day('weekend')])).toMatchObject({ workingDays: 0, attendancePercent: 0, averageMinutes: 0, onTimePercent: 0 });
  });
});
