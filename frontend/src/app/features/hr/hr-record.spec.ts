import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { BankAccount, EmployeeRecord, Quota } from '../../models/record';
import { click, fill, NOW, respond, settle, setupHttp, text, texts } from '../../../testing/fixtures';
import { BanksToCheck } from './banks-to-check';
import { HrRecordCard } from './hr-record-card';
import { QuotaCard } from './quota-card';

const BANK: BankAccount = {
  employeeId: 'OPR-0015', employeeName: 'Priya Nair', bankName: 'Maldives Islamic Bank', accountName: 'Priya Nair', accountNumber: '9001234567', accountLast4: '4567',
  currency: 'USD', status: 'pending', submittedOn: '2026-11-10',
};
const RECORD: EmployeeRecord = {
  insurance: { provider: 'Allied Insurance', policyNumber: 'AIM-1', expiresOn: '2027-06-30' },
  bankAccount: BANK,
  education: [{ id: 'ED-1', qualification: 'BCom', institution: 'University of Kerala', completedYear: 2019 }],
  experience: [{ id: 'EX-1', employer: 'Infosys', role: 'Analyst', from: '2019-07-01' }],
};
const QUOTAS: Quota[] = [
  { id: 'QA-1', jobCategory: 'Engineering', slots: 2, used: 2, approvalNumber: 'QT-1', approvedOn: '2025-12-01', expiresOn: '2026-12-31' },
  { id: 'QA-2', jobCategory: 'Administration', slots: 3, used: 1, approvalNumber: 'QT-2', approvedOn: '2025-12-01', expiresOn: '2027-06-30' },
];

describe('HR record', () => {
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

  describe('HrRecordCard', () => {
    const URL = '/api/hr/employees/OPR-0015/record';
    const render = async (isOwn = false, record: EmployeeRecord = RECORD) => {
      const fixture = TestBed.createComponent(HrRecordCard);
      fixture.componentRef.setInput('employeeId', 'OPR-0015');
      fixture.componentRef.setInput('name', 'Priya Nair');
      fixture.componentRef.setInput('isOwn', isOwn);
      await respond(http, { [URL]: record });
      return fixture.nativeElement as HTMLElement;
    };

    it('shows insurance, the full bank number to check, education and experience', async () => {
      const root = await render();

      expect(texts(root, 'record-insurance')[0]).toContain('Allied Insurance · AIM-1 · expires 30 Jun 2027');
      expect(texts(root, 'record-bank')[0]).toContain('Maldives Islamic Bank · Priya Nair · 9001234567 · USD Waiting for HR Send back Verify');
      expect(texts(root, 'record-education')).toEqual(['BCom University of Kerala, 2019 Remove']);
      expect(texts(root, 'record-experience')).toEqual(['Analyst, Infosys From 01 Jul 2019 Remove']);
    });

    it('verifies bank details, and sends them back with a reason', async () => {
      const root = await render();

      click(root, 'bank-verify');
      expect(http.expectOne('/api/hr/employees/OPR-0015/bank-account/decision').request.body).toEqual({ decision: 'verified' });
    });

    it('sends bank details back with a reason', async () => {
      const root = await render();

      click(root, 'bank-send-back');
      fill(root, 'decision-note', 'Name doesn’t match');
      click(root, 'confirm-reject');
      expect(http.expectOne('/api/hr/employees/OPR-0015/bank-account/decision').request.body).toEqual({ decision: 'rejected', note: 'Name doesn’t match' });
    });

    it('adds insurance, a qualification and a past job through dialogs', async () => {
      const root = await render(false, { education: [], experience: [] });
      expect(texts(root, 'record-insurance')[0]).toContain('None on record');
      expect(texts(root, 'record-bank')[0]).toContain('They haven\'t entered any yet');

      click(root, 'edit-insurance');
      fill(root, 'insurance-provider', 'Allied Insurance');
      fill(root, 'insurance-policy', 'AIM-9');
      fill(root, 'insurance-expiry', '2027-12-31');
      click(root, 'insurance-submit');
      await settle();
      expect(http.expectOne('/api/hr/employees/OPR-0015/insurance').request.body).toEqual({ provider: 'Allied Insurance', policyNumber: 'AIM-9', expiresOn: '2027-12-31' });
    });

    it('checks a qualification and a past job before adding them', async () => {
      const root = await render(false, { education: [], experience: [] });

      click(root, 'add-education');
      fill(root, 'education-year', '2030');
      click(root, 'education-submit');
      await settle();
      expect(text(root.querySelector('dialog[open]') as HTMLElement)).toContain('Pick a year that has already happened.');
      fill(root, 'education-qualification', 'MBA');
      fill(root, 'education-institution', 'ISB');
      fill(root, 'education-year', '2024');
      click(root, 'education-submit');
      await settle();
      expect(http.expectOne('/api/hr/employees/OPR-0015/education').request.body).toEqual({ qualification: 'MBA', institution: 'ISB', completedYear: 2024 });
    });

    it('adds a past job, leaving out an empty end', async () => {
      const root = await render(false, { education: [], experience: [] });

      click(root, 'add-experience');
      fill(root, 'experience-employer', 'Infosys');
      fill(root, 'experience-role', 'Analyst');
      fill(root, 'experience-from', '2019-07-01');
      click(root, 'experience-submit');
      await settle();
      expect(http.expectOne('/api/hr/employees/OPR-0015/experience').request.body).toEqual({ employer: 'Infosys', role: 'Analyst', from: '2019-07-01' });
    });

    it('removes a qualification after asking', async () => {
      const root = await render();

      click(root, 'remove-education');
      click(root, 'confirm-yes');
      expect(http.expectOne('/api/hr/employees/OPR-0015/education/ED-1').request.method).toBe('DELETE');
    });

    it('offers nothing to change on their own page', async () => {
      const root = await render(true);

      expect(root.querySelector('[data-testid=bank-verify]')).toBeNull();
      expect(root.querySelector('[data-testid=add-education]')).toBeNull();
    });
  });

  describe('BanksToCheck', () => {
    it('lists bank details waiting, with the full number, and verifies them', async () => {
      const fixture = TestBed.createComponent(BanksToCheck);
      await respond(http, { '/api/hr/bank-accounts': [BANK] });
      const root = fixture.nativeElement as HTMLElement;

      expect(texts(root, 'waiting-bank')[0]).toContain('Priya Nair Maldives Islamic Bank · Submitted 2 days ago Account Priya Nair, 9001234567 USD');
      click(root, 'bank-verify');
      expect(http.expectOne('/api/hr/employees/OPR-0015/bank-account/decision').request.body).toEqual({ decision: 'verified' });
    });

    it('says when nothing is waiting', async () => {
      const fixture = TestBed.createComponent(BanksToCheck);
      await respond(http, { '/api/hr/bank-accounts': [] });

      expect(text(fixture.nativeElement)).toContain('Nothing to check.');
    });
  });

  describe('QuotaCard', () => {
    const render = async (categories = ['Engineering', 'Logistics']) => {
      const fixture = TestBed.createComponent(QuotaCard);
      fixture.componentRef.setInput('categories', categories);
      await respond(http, { '/api/hr/quotas': QUOTAS });
      return fixture.nativeElement as HTMLElement;
    };

    it('shows slots used and expiry, and names categories with no quota', async () => {
      const root = await render();

      expect(texts(root, 'quota-row')).toEqual([
        'Engineering 2 of 2 Full QT-1 31 Dec 2026 Expires soon Edit Remove',
        'Administration 1 of 3 2 free QT-2 30 Jun 2027 Valid Edit Remove',
      ]);
      expect(text(root.querySelector('[data-testid=uncovered]') as HTMLElement)).toBe('No quota on file for: Logistics.');
    });

    it('adds a quota approval, checking its dates', async () => {
      const root = await render();

      click(root, 'add-quota');
      fill(root, 'quota-category', 'Logistics');
      fill(root, 'quota-slots', '2');
      fill(root, 'quota-number', 'QT-3');
      fill(root, 'quota-approved', '2026-11-01');
      fill(root, 'quota-expiry', '2026-10-01');
      click(root, 'quota-submit');
      await settle();
      expect(text(root.querySelector('dialog[open]') as HTMLElement)).toContain('It expires after it was approved.');

      fill(root, 'quota-expiry', '2027-11-01');
      click(root, 'quota-submit');
      await settle();
      expect(http.expectOne('/api/hr/quotas').request.body).toEqual({ jobCategory: 'Logistics', slots: 2, approvalNumber: 'QT-3', approvedOn: '2026-11-01', expiresOn: '2027-11-01' });
    });

    it('edits one with the server’s reason, and removes one', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const root = await render();

      click(root, 'edit-quota');
      click(root, 'quota-submit');
      await settle();
      http.expectOne('/api/hr/quotas/QA-1').flush({ message: 'The expiry has to come after the approval date.' }, { status: 400, statusText: 'Bad Request' });
      await settle();
      expect(text(root.querySelector('[data-testid=quota-error]') as HTMLElement)).toBe('The expiry has to come after the approval date.');
      (root.querySelector('dialog[open] .secondary-button') as HTMLButtonElement).click();
      TestBed.tick();

      click(root, 'remove-quota');
      click(root, 'confirm-yes');
      expect(http.expectOne('/api/hr/quotas/QA-1').request.method).toBe('DELETE');
    });
  });
});
