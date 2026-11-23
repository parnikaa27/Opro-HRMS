import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Dashboard } from '../../models/insights';
import { ReportTable } from '../../shared/utils/export';
import { click, fail, NOW, respond, settle, setupHttp, text, texts } from '../../../testing/fixtures';
import { DashboardPage } from './dashboard-page';
import { ReportsPage } from './reports-page';

const share = (label: string, count: number, percent: number) => ({ label, count, percent });

const DASHBOARD: Dashboard = {
  today: '2026-11-12',
  workforce: { total: 2, joiners: 1, leavers: 0, growthPercent: 100, attritionPercent: 0, retentionPercent: 100 },
  presence: { present: 1, late: 0, notInYet: 2, absent: 0, onLeave: 0, fromHome: 0, atResort: 0 },
  month: { month: '2026-11', attendancePercent: 90, lateCount: 2, onTimePercent: 80 },
  mix: {
    origin: [share('Expatriates', 1, 50), share('Maldivians', 1, 50)],
    gender: [share('Female', 1, 50), share('Male', 1, 50)],
    employmentType: [share('Contract', 1, 50), share('Permanent', 1, 50)],
    age: [share('25 to 34', 1, 50), share('Not recorded', 1, 50)],
    department: [share('Operations', 1, 50), share('Service', 1, 50)],
    nationality: [share('Indian', 1, 50), share('Maldivian', 1, 50)],
  },
  leave: { pending: 1, annualUsedPercent: 50, sickByMonth: [{ month: '2026-10', days: 0 }, { month: '2026-11', days: 2 }] },
  compliance: {
    papers: [
      { kind: 'visa', label: 'Visa', expired: 0, expiring: 1 },
      { kind: 'passport', label: 'Passport', expired: 0, expiring: 0 },
    ],
    quotaUsed: 1,
    quotaSlots: 1,
    quotasFull: ['Administration'],
    missingVisa: 0,
  },
  events: {
    birthdays: [{ id: 'OPR-0015', fullName: 'Priya Nair', on: '2026-11-20' }],
    anniversaries: [{ id: 'OPR-0015', fullName: 'Priya Nair', on: '2026-11-14', years: 4 }],
    probation: [{ id: 'OPR-0023', fullName: 'Karan Mehta', on: '2026-12-20' }],
    contracts: [{ id: 'OPR-0023', fullName: 'Karan Mehta', on: '2026-12-31' }],
  },
  performance: { cycleName: '2026 appraisals', onProbation: 1, due: 2, done: 1, averageRating: '4.0', highPerformers: 1, promotions: 1 },
};

const HEADCOUNT: ReportTable = {
  title: 'Headcount',
  fileName: 'headcount-2026-11-12',
  columns: ['Name', 'Department'],
  rows: [['Karan Mehta', 'Service'], ['Priya Nair', 'Operations']],
};
const BALANCES: ReportTable = {
  title: 'Leave balances, 2026',
  fileName: 'leave-balances-2026',
  columns: ['Name', 'Leave type', 'Entitled', 'Taken', 'Waiting', 'Left'],
  rows: [['Priya Nair', 'Annual leave', 30, 15, 3, 12]],
};
const reportUrl = (kind: string, by = 'department') => `/api/insights/reports/${kind}?year=2026&month=2026-11&by=${by}`;

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
      await respond(http, { '/api/insights/dashboard': DASHBOARD });
      return fixture.nativeElement as HTMLElement;
    };

    it('shows the headline numbers, the workforce mix and who is in', async () => {
      const root = await render();

      expect([texts(root, 'kpi-total'), texts(root, 'kpi-joiners'), texts(root, 'kpi-leavers'), texts(root, 'kpi-in')]).toEqual([['2'], ['1'], ['0'], ['1']]);
      expect(texts(root, 'not-in-yet')).toEqual(['2']);
      expect(texts(root.querySelector('[data-testid=workforce]') as HTMLElement, 'breakdown-row').slice(0, 2)).toEqual(['Expatriates 1 50%', 'Maldivians 1 50%']);
      expect(text(root.querySelector('[data-testid=leave]') as HTMLElement)).toContain('Annual leave used 50%');
      expect(text(root.querySelector('[data-testid=performance]') as HTMLElement)).toBe(
        'Performance 2026 appraisals On probation 1 Appraised 1 of 2 Average rating 4.0 Rated 4 or 5 1 Recommended for promotion 1',
      );
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
      await fail(http, '/api/insights/dashboard');

      expect(text(fixture.nativeElement)).toContain("The dashboard didn't load");
    });
  });

  describe('ReportsPage', () => {
    const render = async () => {
      const fixture = TestBed.createComponent(ReportsPage);
      await respond(http, { [reportUrl('headcount')]: HEADCOUNT });
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
      expect(texts(root, 'report-row')).toEqual(['Karan Mehta Service', 'Priya Nair Operations']);

      click(root, 'report-balances');
      await respond(http, { [reportUrl('balances')]: BALANCES });
      expect(texts(root, 'report-row')).toEqual(['Priya Nair Annual leave 30 15 3 12']);
      click(root, 'export-csv');
      await settle();

      expect(saved).toEqual(['leave-balances-2026.csv']);
    });

    it('asks for the workforce mix grouped the chosen way', async () => {
      const root = await render();

      click(root, 'report-mix');
      await respond(http, { [reportUrl('mix')]: { ...HEADCOUNT, columns: ['Department', 'People', 'Share'], rows: [['Operations', 1, '50%']] } });
      const by = root.querySelector('[data-testid=mix-by]') as HTMLSelectElement;
      by.value = 'gender';
      by.dispatchEvent(new Event('change'));
      TestBed.tick();
      await respond(http, { [reportUrl('mix', 'gender')]: { ...HEADCOUNT, columns: ['Gender', 'People', 'Share'], rows: [['Female', 1, '50%']] } });

      expect(texts(root, 'report-row')).toEqual(['Female 1 50%']);
    });

    it('says when a report fails to load', async () => {
      const fixture = TestBed.createComponent(ReportsPage);
      await fail(http, reportUrl('headcount'));

      expect(text(fixture.nativeElement)).toContain("The reports didn't load");
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
