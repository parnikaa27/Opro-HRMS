import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { click, fail, respond, settle, setupHttp, text, texts } from '../../../testing/fixtures';
import { HrPolicyPage } from './hr-policy-page';

const URL = '/api/leave/types';
const TYPES = [
  { code: 'annual', name: 'Annual leave', allowsHalfDay: true, defaultEntitlement: 30, isForEveryone: true, carriesForward: true, carryForwardCap: 15, needsHrApproval: true },
  { code: 'paternity', name: 'Paternity leave', allowsHalfDay: false, defaultEntitlement: 1, isForEveryone: false },
  { code: 'unpaid', name: 'Unpaid leave', allowsHalfDay: false, isUnlimited: true, isForEveryone: true },
  { code: 'old', name: 'Old leave', allowsHalfDay: false, defaultEntitlement: 2, retiredOn: '2026-01-01' },
  { code: 'comp-off', name: 'Compensatory off', allowsHalfDay: true },
];
const RULES = { punchFixes: false, homeDays: false, compOff: true, overtime: false };
const RATES = { year: 2026, usedUsd: 0, pendingUsd: 0, ratesPerUsd: { MVR: 15.42, INR: 88 }, claims: [] };

describe('HrPolicyPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    http = setupHttp();
  });

  afterEach(() => vi.restoreAllMocks());

  const render = async () => {
    const fixture = TestBed.createComponent(HrPolicyPage);
    await respond(http, { [URL]: TYPES, '/api/flights': RATES, '/api/hr/schedules': [], '/api/hr/approval-rules': RULES });
    return fixture.nativeElement as HTMLElement;
  };

  it('shows each active type with who gets it and what happens at year end', async () => {
    const root = await render();

    expect(texts(root, 'policy-row')).toEqual([
      'Annual leave 30 days Allowed Everyone Carries up to 15 days HOD, then HR Edit Remove',
      'Paternity leave 1 day Full days only People HR picks Lapses HOD Edit Remove',
      'Unpaid leave No limit Full days only Everyone HOD Edit Remove',
      'Compensatory off Earned Allowed Earned by working days off Lapses Set under Approvals',
    ]);
  });

  it('adds and edits types in a dialog and reloads after saving', async () => {
    const root = await render();

    click(root, 'add-policy');
    expect(text(root.querySelector('dialog[open]') as HTMLElement)).toContain('Add a leave type');
    click(root, 'edit-policy');
    (root.querySelector('dialog[open] button[type=submit]') as HTMLButtonElement).click();
    await settle();
    http.expectOne('/api/hr/leave-types/annual').flush({});
    await respond(http, { [URL]: TYPES });

    expect(root.querySelector('dialog[open]')).toBeNull();
  });

  it('removes a type after asking, and says so when it fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const root = await render();

    click(root, 'remove-policy');
    click(root, 'confirm-yes');
    http.expectOne((request) => request.method === 'DELETE' && request.url === '/api/hr/leave-types/annual').flush('', { status: 500, statusText: 'Error' });
    await settle();
    expect(text(root)).toContain("That didn't remove.");

    click(root, 'remove-policy');
    click(root, 'confirm-yes');
    http.expectOne('/api/hr/leave-types/annual').flush(null);
    await settle();
    expect(http.match(URL)).toHaveLength(1);
  });

  it('saves new exchange rates', async () => {
    const root = await render();
    expect((root.querySelector('[data-testid=rate-mvr]') as HTMLInputElement).value).toBe('15.42');

    click(root, 'rates-submit');
    await settle();
    const request = http.expectOne('/api/hr/exchange-rates');
    expect(request.request.body).toEqual({ mvr: 15.42, inr: 88 });
    request.flush({});
    await settle();

    expect(text(root.querySelector('[data-testid=rates-status]') as HTMLElement)).toBe('Saved. New claims use these rates.');
  });

  it('says when the policy fails to load', async () => {
    const fixture = TestBed.createComponent(HrPolicyPage);
    await fail(http, URL);

    expect(text(fixture.nativeElement)).toContain("The leave policy didn't load");
  });

  it('saves which requests HR approves after the HOD', async () => {
    const root = await render();
    expect((root.querySelector('[data-testid=step-comp-off]') as HTMLInputElement).checked).toBe(true);

    click(root, 'step-overtime');
    click(root, 'steps-submit');
    await settle();
    const request = http.expectOne((sent) => sent.method === 'PUT' && sent.url === '/api/hr/approval-rules');
    expect(request.request.body).toEqual({ ...RULES, overtime: true });
    request.flush({ ...RULES, overtime: true });
    await settle();

    expect(text(root.querySelector('[data-testid=steps-status]') as HTMLElement)).toBe('Saved. Requests the HOD approves from now on follow these.');
  });

  it('says when the approval steps fail to save', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const root = await render();

    click(root, 'steps-submit');
    await settle();
    http.expectOne((sent) => sent.method === 'PUT' && sent.url === '/api/hr/approval-rules').flush('', { status: 500, statusText: 'Error' });
    await settle();

    expect(text(root.querySelector('[data-testid=steps-status]') as HTMLElement)).toBe("That didn't save. Try again in a moment.");
  });
});
