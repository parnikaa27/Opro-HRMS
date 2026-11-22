import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AllowanceGrant, Allowances, MonthlyAllowance } from '../../models/allowance';
import { click, fail, fill, NOW, respond, settle, setupHttp, text, texts } from '../../../testing/fixtures';
import { describeMonthly, money } from './allowance-api';
import { AllowanceTypesCard } from './allowance-types-card';
import { AllowancesCard } from './allowances-card';
import { GrantsToDecide } from './grants-to-decide';
import { HrAllowancesCard } from './hr-allowances-card';
import { TeamGrantsCard } from './team-grants-card';

const TYPES = [
  { code: 'housing', name: 'Housing' },
  { code: 'transport', name: 'Transport' },
  { code: 'old', name: 'Old', retiredOn: '2026-01-01' },
];
const HOUSING: MonthlyAllowance = { id: 'MA-1', typeCode: 'housing', typeName: 'Housing', amount: 6000, currency: 'MVR', startsOn: '2024-01-01' };
const FOOD_ENDED: MonthlyAllowance = { id: 'MA-2', typeCode: 'food', typeName: 'Food', amount: 1500, currency: 'MVR', startsOn: '2024-01-01', endsOn: '2025-12-31' };
const GRANT: AllowanceGrant = {
  id: 'AG-1', employeeId: 'OPR-0021', employeeName: 'Rohit Verma', typeCode: 'transport', typeName: 'Transport', amount: 750.5, currency: 'MVR',
  reason: 'Taxis during the ferry strike', status: 'pending', grantedByName: 'Vikram Singh', grantedOn: '2026-11-10',
};
const ALLOWANCES: Allowances = { monthly: [HOUSING, FOOD_ENDED], grants: [GRANT, { ...GRANT, id: 'AG-2', status: 'rejected', decisionNote: 'Paid by the ferry company' }] };

describe('allowances', () => {
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

  it('says amounts and spans the way people read them', () => {
    expect(money(750.5, 'MVR')).toBe('MVR 750.5');
    expect(describeMonthly(HOUSING, '2026-11-12')).toBe('MVR 6,000 a month since January 2024');
    expect(describeMonthly({ ...HOUSING, startsOn: '2026-12-01' }, '2026-11-12')).toBe('MVR 6,000 a month from December 2026');
    expect(describeMonthly(FOOD_ENDED, '2026-11-12')).toBe('MVR 1,500 a month since January 2024, until December 2025');
  });

  describe('AllowancesCard', () => {
    it('shows what they get now and their one-off grants, but not ended or declined ones', async () => {
      const fixture = TestBed.createComponent(AllowancesCard);
      await respond(http, { '/api/allowances': ALLOWANCES });
      const root = fixture.nativeElement as HTMLElement;

      expect(texts(root, 'my-allowance')).toEqual(['Housing MVR 6,000 a month since January 2024']);
      expect(texts(root, 'my-grant')).toEqual(['Transport, MVR 750.5 once Taxis during the ferry strike Waiting for HR']);
    });

    it('says when it failed to load', async () => {
      const fixture = TestBed.createComponent(AllowancesCard);
      await fail(http, '/api/allowances');

      expect(text(fixture.nativeElement)).toContain("Your allowances didn't load.");
    });
  });

  describe('HrAllowancesCard', () => {
    const LIST = '/api/hr/employees/OPR-0018/allowances';
    const render = async (isOwn = false) => {
      const fixture = TestBed.createComponent(HrAllowancesCard);
      fixture.componentRef.setInput('employeeId', 'OPR-0018');
      fixture.componentRef.setInput('isOwn', isOwn);
      await respond(http, { [LIST]: ALLOWANCES, '/api/allowance-types': TYPES });
      return fixture.nativeElement as HTMLElement;
    };

    it('lists monthly allowances and grants, and stops one after this month', async () => {
      const root = await render();
      expect(texts(root, 'hr-allowance')).toEqual([
        'Housing MVR 6,000 a month since January 2024 Change Stop after this month',
        'Food MVR 1,500 a month since January 2024, until December 2025',
      ]);
      expect(texts(root, 'hr-grant')[1]).toContain('Declined');

      click(root, 'stop-allowance');
      const stop = http.expectOne('/api/hr/employees/OPR-0018/allowances/housing/stop');
      expect(stop.request.body).toEqual({ lastMonth: '2026-11' });
    });

    it('adds a monthly allowance from next month, offering only active kinds', async () => {
      const root = await render();
      click(root, 'add-allowance');
      expect([...root.querySelectorAll('[data-testid=monthly-type] option')].map((option) => text(option))).toEqual(['Housing', 'Transport']);

      click(root, 'monthly-submit');
      await settle();
      expect(text(root.querySelector('dialog[open]') as HTMLElement)).toContain('Enter an amount.');
      fill(root, 'monthly-type', 'transport');
      fill(root, 'monthly-amount', '800');
      fill(root, 'monthly-note', ' Site moved ');
      click(root, 'monthly-submit');
      await settle();

      const saved = http.expectOne('/api/hr/employees/OPR-0018/allowances/transport');
      expect(saved.request.body).toEqual({ amount: 800, currency: 'MVR', startsOn: '2026-12-01', note: 'Site moved' });
      saved.flush({});
      await settle();
      expect(http.match(LIST)).toHaveLength(1);
    });

    it('changes one, and shows why the server refused', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const root = await render();
      click(root, 'change-allowance');
      expect((root.querySelector('[data-testid=monthly-amount]') as HTMLInputElement).value).toBe('6000');

      fill(root, 'monthly-amount', '7000');
      click(root, 'monthly-submit');
      await settle();
      http.expectOne('/api/hr/employees/OPR-0018/allowances/housing').flush({ message: 'Allowances start on the first of a month.' }, { status: 400, statusText: 'Bad Request' });
      await settle();

      expect(text(root.querySelector('[data-testid=monthly-error]') as HTMLElement)).toBe('Allowances start on the first of a month.');
    });

    it('offers nothing to change on their own page', async () => {
      const root = await render(true);

      expect(root.querySelector('[data-testid=add-allowance]')).toBeNull();
      expect(root.querySelector('[data-testid=change-allowance]')).toBeNull();
    });
  });

  describe('TeamGrantsCard', () => {
    const render = async () => {
      const fixture = TestBed.createComponent(TeamGrantsCard);
      fixture.componentRef.setInput('employeeId', 'OPR-0021');
      fixture.componentRef.setInput('name', 'Rohit Verma');
      await respond(http, { '/api/team/allowance-grants': [GRANT, { ...GRANT, id: 'AG-9', employeeId: 'OPR-0018' }], '/api/allowance-types': TYPES });
      return fixture.nativeElement as HTMLElement;
    };

    it('shows only this report’s grants and grants another with a reason', async () => {
      const root = await render();
      expect(texts(root, 'team-grant')).toEqual(['Transport, MVR 750.5 Taxis during the ferry strike · 10 Nov Waiting for HR']);

      click(root, 'grant-allowance');
      click(root, 'grant-submit');
      await settle();
      expect(text(root.querySelector('dialog[open]') as HTMLElement)).toContain('Say why, for HR and for them.');
      fill(root, 'grant-amount', '300');
      fill(root, 'grant-currency', 'USD');
      fill(root, 'grant-reason', 'Flight change for the site visit');
      click(root, 'grant-submit');
      await settle();

      const sent = http.expectOne('/api/team/allowance-grants');
      expect(sent.request.body).toEqual({ employeeId: 'OPR-0021', type: 'housing', amount: 300, currency: 'USD', reason: 'Flight change for the site visit' });
      sent.flush(GRANT);
      await settle();
      expect(http.match('/api/team/allowance-grants')).toHaveLength(1);
    });
  });

  describe('GrantsToDecide', () => {
    const render = async (waiting: AllowanceGrant[] = [GRANT]) => {
      const fixture = TestBed.createComponent(GrantsToDecide);
      await respond(http, { '/api/hr/allowance-grants': waiting });
      return fixture.nativeElement as HTMLElement;
    };

    it('approves in one click and declines with a reason', async () => {
      const root = await render();
      expect(texts(root, 'waiting-grant')[0]).toContain('Rohit Verma From Vikram Singh · “Taxis during the ferry strike” TRANSPORT MVR 750.5');

      click(root, 'approve');
      const approved = http.expectOne('/api/hr/allowance-grants/AG-1/decision');
      expect(approved.request.body).toEqual({ decision: 'approved' });
      approved.flush({});
      await settle();
      http.expectOne('/api/hr/allowance-grants').flush([GRANT]);
      await settle();

      click(root, 'reject');
      fill(root, 'decision-note', 'Paid by the ferry company');
      click(root, 'confirm-reject');
      expect(http.expectOne('/api/hr/allowance-grants/AG-1/decision').request.body).toEqual({ decision: 'rejected', note: 'Paid by the ferry company' });
    });

    it('says when nothing is waiting', async () => {
      const root = await render([]);

      expect(text(root)).toContain('No one-off allowances waiting.');
    });
  });

  describe('AllowanceTypesCard', () => {
    it('lists active kinds, adds one and removes one', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const fixture = TestBed.createComponent(AllowanceTypesCard);
      await respond(http, { '/api/allowance-types': TYPES });
      const root = fixture.nativeElement as HTMLElement;
      expect(texts(root, 'allowance-type-row')).toEqual(['Housing Remove', 'Transport Remove']);

      fill(root, 'allowance-type-name', ' Uniform ');
      click(root, 'add-allowance-type');
      await settle();
      const added = http.expectOne('/api/hr/allowance-types');
      expect(added.request.body).toEqual({ name: 'Uniform' });
      added.flush({ message: "There's already an allowance called that." }, { status: 409, statusText: 'Conflict' });
      await settle();
      expect(text(root.querySelector('[role=alert]') as HTMLElement)).toBe("There's already an allowance called that.");

      click(root, 'remove-allowance-type');
      click(root, 'confirm-yes');
      expect(http.expectOne('/api/hr/allowance-types/housing').request.method).toBe('DELETE');
    });
  });
});
