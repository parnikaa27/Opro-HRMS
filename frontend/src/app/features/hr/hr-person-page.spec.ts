import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { click, employee, fill, NOW, respond, settle, setupHttp, text, texts } from '../../../testing/fixtures';
import { HrPersonPage } from './hr-person-page';

const PERSON = '/api/hr/employees/OPR-0021';
const LEAVE = '/api/hr/leave-requests';
const ATTENDANCE = '/api/hr/attendance?employeeId=OPR-0021&month=2026-11';
const EDITS = '/api/hr/punch-edits?employeeId=OPR-0021&month=2026-11';
const EVERYONE = '/api/hr/employees';
const TYPES = [
  { code: 'annual', name: 'Annual leave', allowsHalfDay: true },
  { code: 'paternity', name: 'Paternity leave', allowsHalfDay: false },
  { code: 'unpaid', name: 'Unpaid leave', allowsHalfDay: false, isUnlimited: true },
];
const DETAIL = {
  ...employee({ id: 'OPR-0021', fullName: 'Rahim Uddin', visa: { workPermitNumber: 'WP', visaNumber: 'MV-EV-4', passportLast4: '9012', visaIssuedOn: '2024-11-02', visaExpiry: '2026-11-02', passportExpiry: '2029-01-01' } }),
  leaveBalances: [{ type: 'annual', entitled: 32, taken: 20, pending: 0 }],
  adjustments: [{ id: 'BA-1', employeeId: 'OPR-0021', type: 'annual', days: 2, reason: 'Carried forward', by: 'OPR-0002', byName: 'Aishath Shifa', on: '2026-01-05' }],
};

describe('HrPersonPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    http = setupHttp();
  });

  afterEach(() => vi.useRealTimers());

  const render = async (detail: object = DETAIL) => {
    const fixture = TestBed.createComponent(HrPersonPage);
    fixture.componentRef.setInput('employeeId', 'OPR-0021');
    await respond(http, {
      [PERSON]: detail,
      [EDITS]: [{ id: 'PE-1', employeeId: 'OPR-0021', date: '2026-11-10', action: 'add', time: '08:55', reason: 'Device missed him', by: 'OPR-0002', byName: 'Aishath Shifa', on: '2026-11-11' }],
      [EVERYONE]: [employee({ id: 'OPR-0030', fullName: 'Ali Shareef', managerId: 'OPR-0021' }), employee()],
      [ATTENDANCE]: [
        { employeeId: 'OPR-0021', date: '2026-11-10', status: 'absent', punches: [], workedMinutes: 0, overtimeMinutes: 0 },
        { employeeId: 'OPR-0021', date: '2026-11-20', status: 'present', punches: [], workedMinutes: 0, overtimeMinutes: 0 },
      ],
      [LEAVE]: [
        { id: 'LR-1', employeeId: 'OPR-0021', type: 'annual', from: '2026-12-01', to: '2026-12-01', days: 1, reason: 'Trip', status: 'pending', appliedOn: '2026-11-10' },
        { id: 'LR-2', employeeId: 'OTHER', type: 'annual', from: '2026-12-01', to: '2026-12-01', days: 1, reason: 'Other', status: 'pending', appliedOn: '2026-11-10' },
      ],
      '/api/leave/types': TYPES,
      '/api/holidays?year=2026': [],
      '/api/holidays?year=2027': [],
    });
    return fixture.nativeElement as HTMLElement;
  };

  it('shows their balances, this month so far, their requests, the change log and visa', async () => {
    const root = await render();

    expect(text(root.querySelector('h1') as HTMLElement)).toBe('Rahim Uddin');
    expect(texts(root, 'leave-balance')).toEqual(['12 annual days Annual leave 12 of 32 days available']);
    expect(texts(root, 'attendance-row')).toEqual(['Tuesday 10 Nov, Tue — — — Absent Fix punches']);
    expect(texts(root, 'leave-request')).toHaveLength(1);
    expect(texts(root, 'adjustment')).toEqual(['+2 days annual leave Carried forward · Aishath Shifa, 5 Jan']);
    expect(text(root.querySelector('[data-testid=visa-card]') as HTMLElement)).toContain('Their visa has lapsed. Start the renewal today');
  });

  it('records leave from the types they hold, then shows it', async () => {
    const root = await render();

    click(root, 'open-record');
    expect([...root.querySelectorAll('[data-testid=record-type] option')].map((option) => text(option))).toEqual(['Annual leave', 'Unpaid leave']);
    fill(root, 'record-from', '2026-11-16');
    fill(root, 'record-to', '2026-11-16');
    fill(root, 'record-reason', 'Called in sick');
    click(root, 'record-submit');
    await settle();
    const request = http.expectOne((sent) => sent.method === 'POST' && sent.url === LEAVE);
    expect(request.request.body).toEqual({ employeeId: 'OPR-0021', type: 'annual', from: '2026-11-16', to: '2026-11-16', days: 1, reason: 'Called in sick' });
    request.flush({});
    await respond(http, { [PERSON]: DETAIL, [LEAVE]: [] });

    expect(text(root.querySelector('dialog[open]') as HTMLElement)).toContain('Leave recorded');
    (root.querySelector('[data-testid=success-state] button') as HTMLButtonElement).click();
    TestBed.tick();
    expect(root.querySelector('dialog[open]')).toBeNull();
  });

  it('adjusts a balance and updates papers through dialogs', async () => {
    const root = await render();

    click(root, 'open-adjust');
    expect([...root.querySelectorAll('[data-testid=adjust-type] option')].map((option) => text(option))).toEqual(['Annual leave', 'Paternity leave']);
    (root.querySelector('dialog .modal-close') as HTMLButtonElement).click();
    TestBed.tick();

    click(root, 'open-visa');
    expect((root.querySelector('[data-testid=visa-number]') as HTMLInputElement).value).toBe('MV-EV-4');
  });

  it('fixes a punch with a reason and shows the log for that day', async () => {
    const root = await render();

    click(root, 'edit-punches');
    expect(text(root.querySelector('[data-testid=punch-log]') as HTMLElement)).toBe('Added 08:55 AM · Device missed him · Aishath Shifa, 11 Nov');
    fill(root, 'punch-time', '17:20');
    fill(root, 'punch-reason', 'Device offline');
    click(root, 'punch-submit');
    await settle();
    const request = http.expectOne('/api/hr/punch-edits');
    expect(request.request.body).toEqual({ employeeId: 'OPR-0021', date: '2026-11-10', action: 'add', time: '17:20', reason: 'Device offline' });
    request.flush({});
    await settle();

    expect(http.match(ATTENDANCE)).toHaveLength(1);
    expect(http.match(EDITS)).toHaveLength(1);
  });

  it('won’t let someone with reports leave until they are moved', async () => {
    const root = await render();

    click(root, 'person-menu');
    click(root, 'mark-leaving');

    expect(text(root.querySelector('[data-testid=move-reports]') as HTMLElement)).toContain('1 person reports to Rahim. Give each of them a new manager');
    expect(root.querySelector('[data-testid=move-reports] a')?.getAttribute('href')).toBe('/hr/people/OPR-0030/edit');
  });

  it('shows a leaving date and takes it back if they stay', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const root = await render({ ...DETAIL, lastDay: '2026-12-31', leavingReason: 'Moving abroad' });
    expect(text(root.querySelector('[data-testid=leaving-note]') as HTMLElement)).toBe("Last day 31 December 2026 Moving abroad They're staying");

    click(root, 'cancel-leaving');
    click(root, 'confirm-yes');
    http.expectOne(`${PERSON}/leaving`).flush('', { status: 500, statusText: 'Server Error' });
    await settle();
    expect(text(root.querySelector('[data-testid=leaving-note]') as HTMLElement)).toContain("That didn't save.");

    click(root, 'cancel-leaving');
    click(root, 'confirm-yes');
    http.expectOne(`${PERSON}/leaving`).flush({});
    await settle();
    expect(http.match(PERSON)).toHaveLength(1);
  });

  it('says when someone has already left, and offers no leaving action', async () => {
    const root = await render({ ...DETAIL, lastDay: '2026-11-01', leavingReason: 'Contract ended' });

    expect(text(root.querySelector('[data-testid=leaving-note]') as HTMLElement)).toBe('Left on 1 November 2026 Contract ended');
    click(root, 'person-menu');
    expect(root.querySelector('[data-testid=mark-leaving]')).toBeNull();
    expect(root.querySelector('[data-testid=edit-person]')?.getAttribute('href')).toBe('/hr/people/OPR-0021/edit');
  });

  it('opens the photo dialog from the menu', async () => {
    const root = await render();

    click(root, 'person-menu');
    click(root, 'change-photo');

    expect(text(root.querySelector('dialog[open]') as HTMLElement)).toContain('Photo for Rahim');
  });

  it('says so when nobody has that ID, and when loading fails', async () => {
    const missing = TestBed.createComponent(HrPersonPage);
    missing.componentRef.setInput('employeeId', 'OPR-0021');
    TestBed.tick();
    http.expectOne(PERSON).flush({ message: 'No such employee' }, { status: 404, statusText: 'Not Found' });
    await settle();
    expect(text(missing.nativeElement)).toContain('Nobody by that ID');

    TestBed.resetTestingModule();
    http = setupHttp();
    const broken = TestBed.createComponent(HrPersonPage);
    broken.componentRef.setInput('employeeId', 'OPR-0021');
    TestBed.tick();
    expect((broken.nativeElement as HTMLElement).querySelector('[data-testid=list-loading]')).not.toBeNull();
    http.expectOne(PERSON).flush('', { status: 500, statusText: 'Server Error' });
    await settle();
    expect(text(broken.nativeElement)).toContain("This person's details didn't load");
  });
});
