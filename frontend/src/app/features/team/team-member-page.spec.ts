import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { employee, NOW, respond, setupHttp, settle, text, texts } from '../../../testing/fixtures';
import { TeamMemberPage } from './team-member-page';

describe('TeamMemberPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    http = setupHttp();
  });

  afterEach(() => vi.useRealTimers());

  const create = () => {
    const fixture = TestBed.createComponent(TeamMemberPage);
    fixture.componentRef.setInput('employeeId', 'OPR-0018');
    return fixture;
  };

  it("shows one report's leave, month, requests, visa and card, read only", async () => {
    const fixture = create();
    await respond(http, {
      '/api/team/OPR-0018': { ...employee(), leaveBalances: [{ type: 'annual', entitled: 30, taken: 18, pending: 0 }] },
      '/api/team/attendance?month=2026-11': [
        { employeeId: 'OPR-0018', date: '2026-11-10', status: 'absent', punches: [], workedMinutes: 0, overtimeMinutes: 0 },
        { employeeId: 'OTHER', date: '2026-11-10', status: 'present', punches: [], workedMinutes: 0, overtimeMinutes: 0 },
        { employeeId: 'OPR-0018', date: '2026-11-20', status: 'present', punches: [], workedMinutes: 0, overtimeMinutes: 0 },
      ],
      '/api/team/leave-requests': [
        { id: 'LR-1', employeeId: 'OPR-0018', type: 'annual', from: '2026-12-01', to: '2026-12-01', days: 1, reason: 'Trip', status: 'pending', appliedOn: '2026-11-10' },
        { id: 'LR-2', employeeId: 'OTHER', type: 'annual', from: '2026-12-01', to: '2026-12-01', days: 1, reason: 'Other', status: 'pending', appliedOn: '2026-11-10' },
      ],
      '/api/leave/types': [{ code: 'annual', name: 'Annual leave', allowsHalfDay: true }],
    });
    const root = fixture.nativeElement as HTMLElement;

    expect(text(root.querySelector('h1') as HTMLElement)).toBe('Arjun Reddy');
    expect(texts(root, 'leave-balance')).toEqual(['12 annual days Annual leave 12 of 30 days available']);
    expect(texts(root, 'attendance-row')).toEqual(['Tuesday 10 Nov, Tue — — — Absent']);
    expect(text(root.querySelector('[data-testid=visa-card]') as HTMLElement)).toContain('Missing');
    expect(texts(root, 'leave-request')).toHaveLength(1);
    expect(root.querySelector('[data-testid=cancel-request]')).toBeNull();
    expect(root.querySelector('[data-testid=employee-card]')).not.toBeNull();
  });

  it('says so when the person is not on the team', async () => {
    const fixture = create();
    TestBed.tick();
    http.expectOne('/api/team/OPR-0018').flush({ message: 'Not one of your reports' }, { status: 404, statusText: 'Not Found' });
    await settle();

    expect(text(fixture.nativeElement)).toContain('Not on your team');
  });

  it('shows a skeleton while loading and a message on other failures', async () => {
    const fixture = create();
    TestBed.tick();
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid=list-loading]')).not.toBeNull();

    http.expectOne('/api/team/OPR-0018').flush('', { status: 500, statusText: 'Server Error' });
    await settle();

    expect(text(fixture.nativeElement)).toContain("This person's details didn't load");
  });
});
