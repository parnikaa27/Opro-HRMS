import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Session } from '../../core/session';
import { employee, NOW, respond, setupHttp, text, texts } from '../../../testing/fixtures';
import { HrOverviewPage } from './hr-overview-page';
import { PEOPLE } from './hr-pages.fixtures';

describe('HrOverviewPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    http = setupHttp();
    TestBed.inject(Session).user.set(employee({ fullName: 'Aishath Shifa', roles: ['EMPLOYEE', 'HR'] }));
  });

  afterEach(() => vi.useRealTimers());

  const render = async (overrides: Record<string, object> = {}) => {
    const fixture = TestBed.createComponent(HrOverviewPage);
    await respond(http, {
      '/api/hr/employees': PEOPLE,
      '/api/hr/leave-requests?status=pending': [
        { id: 'LR-2', employeeId: 'P', employeeName: 'Priya Nair', type: 'annual', from: '2026-12-20', to: '2026-12-24', days: 3, reason: 'Trip', status: 'pending', appliedOn: '2026-11-11' },
        { id: 'LR-1', employeeId: 'M', employeeName: 'Mariyam Nisha', type: 'annual', from: '2026-12-22', to: '2026-12-22', days: 1, reason: 'Trip', status: 'pending', appliedOn: '2026-11-09' },
      ],
      '/api/hr/corrections?status=pending': [{ id: 'AC-1' }],
      '/api/hr/change-requests': [{ id: 'CR-1', status: 'open' }, { id: 'CR-2', status: 'done' }],
      '/api/holidays?year=2026': [
        { id: 'HD-1', name: 'Mawlid al Nabi', date: '2026-11-20', isTentative: true },
        { id: 'HD-2', name: 'Republic Day', date: '2026-11-11', isTentative: false },
        { id: 'HD-3', name: 'Eid long ago', date: '2026-03-20', isTentative: true },
      ],
      '/api/holidays?year=2027': [{ id: 'HD-4', name: 'First day of Ramadan', date: '2027-02-08', isTentative: true }],
      ...overrides,
    });
    return fixture.nativeElement as HTMLElement;
  };

  it('greets HR with the company at a glance', async () => {
    const root = await render();

    expect(text(root.querySelector('.welcome') as HTMLElement)).toBe('THURSDAY, 12 NOVEMBER Good morning, Aishath. 4 people at Opro. 2 in today.');
    expect([texts(root, 'stat-people'), texts(root, 'stat-waiting'), texts(root, 'stat-visas'), texts(root, 'stat-inbox')]).toEqual([['4'], ['3'], ['2'], ['1']]);
  });

  it('lists the oldest waiting leave, visa alerts and holidays to confirm soon', async () => {
    const root = await render();

    expect(texts(root, 'waiting-leave')).toEqual(['MN Mariyam Nisha Submitted 3 days ago 22 December 2026 1 day', 'PN Priya Nair Submitted yesterday 20 Dec to 24 December 2026 3 days']);
    expect(texts(root, 'visa-alert')).toEqual(['RU Rahim Uddin Visa expired 02 Nov 2026 Expired', 'KP Kasun Perera Visa expires 20 Dec 2026 38 days']);
    expect(root.querySelector('[data-testid=visa-alert]')?.getAttribute('href')).toBe('/hr/people/OPR-0021');
    expect(texts(root, 'to-confirm')).toEqual(['Mawlid al Nabi Tentatively 20 Nov in 8 days']);
  });

  it('has calm empty states', async () => {
    const root = await render({ '/api/hr/employees': [], '/api/hr/leave-requests?status=pending': [], '/api/holidays?year=2026': [], '/api/holidays?year=2027': [] });

    expect(text(root)).toContain('Every request has a decision.');
    expect(text(root)).toContain('Every visa and passport is in date.');
    expect(text(root)).toContain('No tentative holidays in the next two months.');
  });
});
