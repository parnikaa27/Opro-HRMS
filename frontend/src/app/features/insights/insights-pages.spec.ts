import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Insights } from '../../models/insights';
import { click, fail, NOW, respond, settle, setupHttp, text, texts } from '../../../testing/fixtures';
import { DashboardPage } from './dashboard-page';
import { ReportsPage } from './reports-page';

const FACTS: Insights = {
  today: '2026-11-12',
  people: [
    {
      id: 'OPR-0015', fullName: 'Priya Nair', department: 'Operations', designation: 'Officer', nationality: 'Indian', gender: 'female', dateOfBirth: '1992-11-20',
      joinedOn: '2022-11-14', employmentType: 'Permanent', visaExpiry: '2026-12-20', passportExpiry: '2031-06-30',
      today: { employeeId: 'OPR-0015', date: '2026-11-12', status: 'present', punches: [{ at: '2026-11-12T08:55:00+05:00', direction: 'in' }], workedMinutes: 0, overtimeMinutes: 0 },
    },
    { id: 'OPR-0023', fullName: 'Karan Mehta', department: 'Service', designation: 'Lead', nationality: 'Maldivian', gender: 'male', joinedOn: '2026-02-01', employmentType: 'Contract', contractEndsOn: '2026-12-31' },
  ],
  leave: [{ employeeId: 'OPR-0015', type: 'annual', from: '2026-12-20', to: '2026-12-24', days: 3, status: 'pending', appliedOn: '2026-11-10' }],
  balances: [{ employeeId: 'OPR-0015', type: 'annual', entitled: 30, taken: 15, pending: 3 }],
  quotas: [{ id: 'Q1', jobCategory: 'Administration', slots: 1, used: 1, approvalNumber: 'Q', approvedOn: '2025-01-01', expiresOn: '2027-01-01' }],
};

describe('insights pages', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    http = setupHttp();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('DashboardPage', () => {
    const render = async (scope: 'hr' | 'company' = 'hr') => {
      const fixture = TestBed.createComponent(DashboardPage);
      fixture.componentRef.setInput('scope', scope);
      await respond(http, { '/api/insights': FACTS });
      await respond(http, { '/api/insights/attendance?month=2026-11': [] });
      return fixture.nativeElement as HTMLElement;
    };

    it('shows the headline numbers, the workforce mix and who is in', async () => {
      const root = await render();

      expect([texts(root, 'kpi-total'), texts(root, 'kpi-joiners'), texts(root, 'kpi-leavers'), texts(root, 'kpi-in')]).toEqual([['2'], ['1'], ['0'], ['1']]);
      expect(texts(root.querySelector('[data-testid=workforce]') as HTMLElement, 'breakdown-row').slice(0, 2)).toEqual(['Expatriates 1 50%', 'Maldivians 1 50%']);
      expect(text(root.querySelector('[data-testid=leave]') as HTMLElement)).toContain('Annual leave used 50%');
    });

    it('flags papers, quota and what is coming up, linking to the right person page', async () => {
      const root = await render('company');

      expect(texts(root, 'paper')[0]).toBe('Visa 1 within 60 days');
      expect(text(root.querySelector('[data-testid=quota-use]') as HTMLElement)).toBe('Expatriate quota 1 of 1 slots used');
      expect(texts(root, 'birthday')).toEqual(['Priya Nair 20 Nov']);
      expect(texts(root, 'anniversary')).toEqual(['Priya Nair 4 years, 14 Nov']);
      expect(root.querySelector('[data-testid=contract]')?.getAttribute('href')).toBe('/company/OPR-0023');
      expect(root.querySelector('[data-testid=open-reports]')?.getAttribute('href')).toBe('/company/reports');
    });

    it('says so when it fails to load', async () => {
      const fixture = TestBed.createComponent(DashboardPage);
      await fail(http, '/api/insights');

      expect(text(fixture.nativeElement)).toContain("The dashboard didn't load");
    });
  });

  describe('ReportsPage', () => {
    const render = async () => {
      const fixture = TestBed.createComponent(ReportsPage);
      await respond(http, { '/api/insights': FACTS, '/api/leave/types': [{ code: 'annual', name: 'Annual leave' }] });
      return fixture.nativeElement as HTMLElement;
    };

    it('previews the chosen report and saves it in the chosen format', async () => {
      const saved: string[] = [];
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
        saved.push(this.download);
      });
      URL.createObjectURL = vi.fn(() => 'blob:report');
      URL.revokeObjectURL = vi.fn();
      const root = await render();
      expect(texts(root, 'report-row').map((row) => row.split(' ').slice(0, 2).join(' '))).toEqual(['Karan Mehta', 'Priya Nair']);

      click(root, 'report-balances');
      expect(texts(root, 'report-row')).toEqual(['Priya Nair Annual leave 30 15 3 12']);
      click(root, 'export-csv');
      await settle();

      expect(saved).toEqual(['leave-balances-2026.csv']);
    });

    it('loads a month of attendance only for the attendance report', async () => {
      const root = await render();
      http.expectNone((request) => request.url === '/api/insights/attendance');

      click(root, 'report-attendance');
      await respond(http, { '/api/insights/attendance?month=2026-11': [] });

      expect(texts(root, 'report-row')).toEqual(['Karan Mehta 0 0 0 0 00h 00m 0%', 'Priya Nair 0 0 0 0 00h 00m 0%']);
    });

    it('says when saving fails', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      URL.createObjectURL = vi.fn(() => {
        throw new Error('No space');
      });
      const root = await render();

      click(root, 'export-csv');
      await settle();

      expect(text(root.querySelector('[role=alert]') as HTMLElement)).toBe("That didn't save. Try again in a moment.");
    });
  });
});
