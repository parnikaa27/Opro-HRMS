import { PersonFact } from '../../models/insights';
import { ageBand, compliance, isActive, leaveSummary, peopleEvents, performance, presence, shares, workforce, yearsSince } from './insights';

const TODAY = '2026-11-12';
const person = (overrides: Partial<PersonFact>): PersonFact => ({
  id: 'P', fullName: 'Person', department: 'Operations', designation: 'Officer', nationality: 'Indian', joinedOn: '2020-01-01', employmentType: 'Permanent', ...overrides,
});
const day = (status: 'present' | 'late' | 'absent' | 'on-leave', workMode?: 'home' | 'resort') => ({
  employeeId: 'P', date: TODAY, status, punches: status === 'present' || status === 'late' ? [{ at: `${TODAY}T09:00:00+05:00`, direction: 'in' as const }] : [], workedMinutes: 0, overtimeMinutes: 0, ...(workMode && { workMode }),
});

describe('insights', () => {
  it('counts headcount, joiners, leavers and turnover for the year so far', () => {
    const people = [
      person({ id: 'A' }),
      person({ id: 'B' }),
      person({ id: 'C', lastDay: '2026-06-30' }),
      person({ id: 'D', joinedOn: '2026-03-01' }),
      person({ id: 'E', joinedOn: '2026-12-01' }),
      person({ id: 'F', lastDay: '2025-12-31' }),
    ];

    const result = workforce(people, TODAY);

    expect(result.total).toBe(4);
    expect(result.joiners.map(({ id }) => id)).toEqual(['D']);
    expect(result.leavers.map(({ id }) => id)).toEqual(['C']);
    expect(result.growthPercent).toBe(33);
    expect(result.attritionPercent).toBe(29);
    expect(result.retentionPercent).toBe(67);
    expect(isActive(person({ lastDay: TODAY }), TODAY)).toBe(true);
  });

  it('gives zeros rather than dividing by nothing', () => {
    expect(workforce([], TODAY)).toMatchObject({ total: 0, growthPercent: 0, attritionPercent: 0, retentionPercent: 0 });
  });

  it('groups and shares, biggest first, then by name', () => {
    expect(shares(['b', 'a', 'b', 'c'], (item) => item)).toEqual([
      { label: 'b', count: 2, percent: 50 },
      { label: 'a', count: 1, percent: 25 },
      { label: 'c', count: 1, percent: 25 },
    ]);
  });

  it('works out ages and their bands, birthdays not yet reached included', () => {
    expect(yearsSince('1996-11-13', TODAY)).toBe(29);
    expect(yearsSince('1996-11-12', TODAY)).toBe(30);
    expect([ageBand('2004-01-01', TODAY), ageBand('1996-01-01', TODAY), ageBand('1960-01-01', TODAY), ageBand(undefined, TODAY)]).toEqual([
      'Under 25', '25 to 34', '55 and over', 'Not recorded',
    ]);
  });

  it('counts who is in, late, absent, on leave, from home and at a resort', () => {
    const active = [
      person({ today: day('present') }), person({ today: day('late', 'home') }), person({ today: day('present', 'resort') }),
      person({ today: day('absent') }), person({ today: day('on-leave') }), person({}),
    ];

    expect(presence(active)).toEqual({ present: 3, late: 1, absent: 1, onLeave: 1, fromHome: 1, atResort: 1 });
  });

  it('sums leave waiting, annual leave used and sick days by month', () => {
    const summary = leaveSummary(
      [
        { employeeId: 'A', type: 'sick', from: '2026-10-05', to: '2026-10-06', days: 2, status: 'approved', appliedOn: '2026-10-05' },
        { employeeId: 'A', type: 'sick', from: '2026-11-02', to: '2026-11-02', days: 1, status: 'rejected', appliedOn: '2026-11-02' },
        { employeeId: 'B', type: 'annual', from: '2026-12-20', to: '2026-12-24', days: 3, status: 'pending', appliedOn: '2026-11-10' },
      ],
      [{ employeeId: 'A', type: 'annual', entitled: 30, taken: 12, pending: 0 }, { employeeId: 'B', type: 'annual', entitled: 30, taken: 3, pending: 3 }],
      TODAY,
    );

    expect(summary.pending).toBe(1);
    expect(summary.annualUsedPercent).toBe(25);
    expect(summary.sickByMonth.map(({ month, days }) => `${month} ${days}`)).toEqual(['2026-06 0', '2026-07 0', '2026-08 0', '2026-09 0', '2026-10 2', '2026-11 0']);
  });

  it('counts expired and soon expiring papers, quota use and expatriates with no visa', () => {
    const result = compliance(
      [
        person({ visaExpiry: '2026-11-01', passportExpiry: '2026-12-20', insuranceExpiry: '2027-06-30' }),
        person({ visaExpiry: '2027-12-01' }),
        person({ nationality: 'Indian' }),
        person({ nationality: 'Maldivian' }),
      ],
      [
        { id: 'Q1', jobCategory: 'Engineering', slots: 2, used: 2, approvalNumber: 'Q', approvedOn: '2025-01-01', expiresOn: '2027-01-01' },
        { id: 'Q2', jobCategory: 'Logistics', slots: 3, used: 1, approvalNumber: 'Q', approvedOn: '2025-01-01', expiresOn: '2027-01-01' },
      ],
      TODAY,
    );

    expect(result.papers.find(({ kind }) => kind === 'visa')).toMatchObject({ expired: 1, expiring: 0 });
    expect(result.papers.find(({ kind }) => kind === 'passport')).toMatchObject({ expired: 0, expiring: 1 });
    expect(result).toMatchObject({ quotaUsed: 3, quotaSlots: 5, quotasFull: ['Engineering'], missingVisa: 1 });
  });

  it('lists this month’s birthdays and anniversaries, and probation and contracts ending soon', () => {
    const events = peopleEvents(
      [
        person({ id: 'A', dateOfBirth: '1990-11-30', joinedOn: '2020-11-02' }),
        person({ id: 'B', dateOfBirth: '1992-11-05', joinedOn: '2026-11-01', probationEndsOn: '2026-12-01' }),
        person({ id: 'C', dateOfBirth: '1992-10-05', contractEndsOn: '2027-01-05' }),
        person({ id: 'D', contractEndsOn: '2027-02-01', probationEndsOn: '2026-12-20' }),
      ],
      TODAY,
    );

    expect(events.birthdays.map(({ id }) => id)).toEqual(['B', 'A']);
    expect(events.anniversaries.map(({ id }) => id)).toEqual(['A']);
    expect(events.probation.map(({ id }) => id)).toEqual(['B']);
    expect(events.contracts.map(({ id }) => id)).toEqual(['C']);
  });

  describe('performance', () => {
    it('counts probation and how far the cycle has got, leaving out people with no HOD', () => {
      const people = [person({ id: 'A', managerId: 'H', probationEndsOn: '2026-12-01' }), person({ id: 'B', managerId: 'H' }), person({ id: 'S' })];
      const appraisals = [{ employeeId: 'A', rating: 5, recommendsPromotion: true }, { employeeId: 'B', rating: 2, recommendsPromotion: false }, { employeeId: 'S', rating: 3, recommendsPromotion: false }];

      expect(performance(people, appraisals)).toEqual({ onProbation: 1, due: 2, done: 2, averageRating: '3.5', highPerformers: 1, promotions: 1 });
    });

    it('has no average before anyone is appraised', () => {
      expect(performance([person({ managerId: 'H' })], []).averageRating).toBeUndefined();
    });
  });
});
