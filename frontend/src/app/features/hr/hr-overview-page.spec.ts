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
    TestBed.inject(Session).user.set(employee({ fullName: 'Ananya Iyer', roles: ['EMPLOYEE', 'HR'] }));
  });

  afterEach(() => vi.useRealTimers());

  const render = async (overrides: Record<string, object> = {}) => {
    const fixture = TestBed.createComponent(HrOverviewPage);
    await respond(http, {
      '/api/hr/employees': PEOPLE,
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

    expect(text(root.querySelector('.welcome') as HTMLElement)).toBe('THURSDAY, 12 NOVEMBER Good morning, Ananya. 4 people at Opro. 2 in today.');
    expect([texts(root, 'stat-people'), texts(root, 'stat-on-leave'), texts(root, 'stat-visas'), texts(root, 'stat-inbox')]).toEqual([['4'], ['1'], ['2'], ['1']]);
    http.expectNone((request) => request.url.includes('leave-requests') || request.url.includes('corrections'));
  });

  it('counts everything waiting in the inbox, the same as the sidebar badge', async () => {
    const root = await render({
      '/api/hr/documents': [{ type: 'national-id' }],
      '/api/hr/bank-accounts': [{ employeeId: 'OPR-0018' }],
      '/api/hr/approvals': { leave: [{ id: 'LR-1' }], corrections: [], homeDays: [], compOffs: [], overtime: [] },
      '/api/hr/resignations': [{ id: 'RS-1' }],
      '/api/hr/allowance-grants': [{ id: 'AG-1' }, { id: 'AG-2' }],
    });

    expect(texts(root, 'stat-inbox')).toEqual(['7']);
  });

  it('lists who is on leave today, visa alerts and holidays to confirm soon', async () => {
    const root = await render();

    expect(texts(root, 'on-leave')).toEqual(['RS Rajesh Sharma Site Engineer']);
    expect(root.querySelector('[data-testid=on-leave]')?.getAttribute('href')).toBe('/hr/people/OPR-0001');
    expect(texts(root, 'visa-alert')).toEqual(['RV Rohit Verma Visa expired 02 Nov 2026 Expired', 'AR Arjun Reddy Visa expires 20 Dec 2026 38 days']);
    expect(root.querySelector('[data-testid=visa-alert]')?.getAttribute('href')).toBe('/hr/people/OPR-0021');
    expect(texts(root, 'to-confirm')).toEqual(['Mawlid al Nabi Tentatively 20 Nov in 8 days']);
  });

  it('has calm empty states', async () => {
    const root = await render({ '/api/hr/employees': [], '/api/holidays?year=2026': [], '/api/holidays?year=2027': [] });

    expect(text(root)).toContain("Nobody's on leave today.");
    expect(text(root)).toContain('Every visa and passport is in date.');
    expect(text(root)).toContain('No tentative holidays in the next two months.');
  });
});
