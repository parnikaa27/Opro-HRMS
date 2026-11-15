import { Component, signal } from '@angular/core';
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { LeaveBalance, LeaveType } from '../../models/leave';
import { fill, pdf, pickFile, setupHttp, settle, text } from '../../../testing/fixtures';
import { LeaveForm } from './leave-form';

const TYPES: LeaveType[] = [
  { code: 'annual', name: 'Annual leave', allowsHalfDay: true },
  { code: 'sick', name: 'Sick leave', allowsHalfDay: true, documentRequiredAfterDays: 2 },
  { code: 'maternity', name: 'Maternity leave', allowsHalfDay: false },
  { code: 'unpaid', name: 'Unpaid leave', allowsHalfDay: true, isUnlimited: true },
];
const BALANCES: LeaveBalance[] = [
  { type: 'annual', entitled: 30, taken: 27, pending: 0 },
  { type: 'sick', entitled: 30, taken: 0, pending: 0 },
];

@Component({
  imports: [LeaveForm],
  template: `<app-leave-form [types]="types" [balances]="balances" [holidays]="holidays" (applied)="applied.set(true); missing.set($event)" (cancelled)="cancelled.set(true)" />`,
})
class Host {
  types = TYPES;
  balances = BALANCES;
  holidays = new Set(['2026-12-01']);
  readonly applied = signal(false);
  readonly missing = signal<boolean | undefined>(undefined);
  readonly cancelled = signal(false);
}

describe('LeaveForm', () => {
  let http: HttpTestingController;
  let root: HTMLElement;
  let host: Host;

  beforeEach(async () => {
    http = setupHttp();
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    root = fixture.nativeElement;
    host = fixture.componentInstance;
  });

  afterEach(() => vi.restoreAllMocks());

  const errors = () => [...root.querySelectorAll('.field-error')].map((error) => text(error));
  const submitForm = async () => {
    (root.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();
  };

  it('only offers leave types the person has a balance for, plus unlimited ones', () => {
    const options = [...root.querySelectorAll('[data-testid=leave-type] option')].map((option) => text(option));

    expect(options).toEqual(['Annual leave', 'Sick leave', 'Unpaid leave']);
  });

  it('points at every missing field when sent empty', async () => {
    await submitForm();

    expect(errors()).toEqual(['Pick your first day.', 'Pick your last day.', 'Add a short reason for your manager.']);
    http.expectNone('/api/leave/requests');
  });

  it('refuses a range that runs backwards', async () => {
    fill(root, 'leave-from', '2026-12-10');
    fill(root, 'leave-to', '2026-12-08');
    await submitForm();

    expect(errors()).toContain("The last day can't be before the first.");
  });

  it('refuses a range with no working days in it', async () => {
    fill(root, 'leave-from', '2026-12-04');
    fill(root, 'leave-to', '2026-12-05');
    await submitForm();

    expect(errors()).toContain('Those dates are all weekends or holidays. Nothing to take.');
  });

  it('stops people asking for more than they have left', async () => {
    fill(root, 'leave-from', '2026-12-06');
    fill(root, 'leave-to', '2026-12-10');
    await submitForm();

    expect(errors()).toContain('You only have 3 days of this leave left.');
  });

  it('previews the count and asks for a certificate on longer sick leave', () => {
    fill(root, 'leave-type', 'sick');
    fill(root, 'leave-from', '2026-12-06');
    fill(root, 'leave-to', '2026-12-08');

    expect(text(root.querySelector('[data-testid=leave-preview]') as HTMLElement)).toBe('3 days requested 27 days will remain after approval');
    expect(text(root)).toContain('Sick leave longer than 2 days needs one. Only you and HR can open it.');
  });

  it('turns away a certificate that isn’t a PDF, JPG or PNG under 5 MB', () => {
    fill(root, 'leave-type', 'sick');
    fill(root, 'leave-from', '2026-12-06');
    fill(root, 'leave-to', '2026-12-08');

    pickFile(root, 'leave-certificate', new File(['x'], 'notes.txt', { type: 'text/plain' }));
    expect(text(root)).toContain('Attach a PDF, JPG or PNG under 5 MB.');
    pickFile(root, 'leave-certificate', pdf('big.pdf', 6_000_000));
    expect(text(root)).toContain('Attach a PDF, JPG or PNG under 5 MB.');
  });

  it('applies, then attaches the certificate to the new request', async () => {
    fill(root, 'leave-type', 'sick');
    fill(root, 'leave-from', '2026-12-06');
    fill(root, 'leave-to', '2026-12-08');
    fill(root, 'leave-reason', 'Dengue');
    pickFile(root, 'leave-certificate', pdf());
    await submitForm();

    http.expectOne('/api/leave/requests').flush({ id: 'LR-9' });
    await settle();
    const upload = http.expectOne('/api/leave/requests/LR-9/certificate');
    expect(upload.request.method).toBe('PUT');
    expect(upload.request.body).toBeInstanceOf(File);
    upload.flush({});
    await settle();

    expect(host.missing()).toBe(false);
  });

  it('still applies when the certificate fails or is missing, and says it is missing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fill(root, 'leave-type', 'sick');
    fill(root, 'leave-from', '2026-12-06');
    fill(root, 'leave-to', '2026-12-08');
    fill(root, 'leave-reason', 'Dengue');
    pickFile(root, 'leave-certificate', pdf());
    await submitForm();

    http.expectOne('/api/leave/requests').flush({ id: 'LR-9' });
    await settle();
    http.expectOne('/api/leave/requests/LR-9/certificate').flush('', { status: 500, statusText: 'Server Error' });
    await settle();

    expect(host.missing()).toBe(true);
  });

  it('offers half days only for a single day', () => {
    fill(root, 'leave-from', '2026-12-03');
    expect(root.querySelector('[data-testid=leave-half]')).toBeNull();

    fill(root, 'leave-to', '2026-12-03');
    expect(root.querySelector('[data-testid=leave-half]')).not.toBeNull();
  });

  it('sends a half day request and tells the page', async () => {
    fill(root, 'leave-from', '2026-12-03');
    fill(root, 'leave-to', '2026-12-03');
    fill(root, 'leave-half', 'first');
    fill(root, 'leave-reason', '  Dentist  ');
    await submitForm();

    const request = http.expectOne('/api/leave/requests');
    expect(request.request.body).toEqual({ type: 'annual', from: '2026-12-03', to: '2026-12-03', days: 0.5, reason: 'Dentist', halfDay: 'first' });
    request.flush({});
    await settle();
    expect(host.applied()).toBe(true);
  });

  it('lets unpaid leave go beyond any balance', async () => {
    fill(root, 'leave-type', 'unpaid');
    fill(root, 'leave-from', '2026-12-06');
    fill(root, 'leave-to', '2026-12-17');
    expect(text(root.querySelector('[data-testid=leave-preview]') as HTMLElement)).toBe('10 days requested Unpaid, so it doesn’t use a balance.');
    fill(root, 'leave-reason', 'Family emergency');
    await submitForm();

    expect(http.expectOne('/api/leave/requests').request.body.days).toBe(10);
  });

  it('says so when sending fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fill(root, 'leave-from', '2026-12-03');
    fill(root, 'leave-to', '2026-12-03');
    fill(root, 'leave-reason', 'Dentist');
    await submitForm();

    http.expectOne('/api/leave/requests').flush('', { status: 500, statusText: 'Server Error' });
    await settle();

    expect(root.querySelector('[role=alert]')).not.toBeNull();
    expect(host.applied()).toBe(false);
  });

  it('hints at what counts before dates are picked, and can be cancelled', () => {
    expect(text(root.querySelector('[data-testid=leave-preview]') as HTMLElement)).toBe('Pick your dates Weekends and public holidays don’t count.');

    (root.querySelector('.secondary-button') as HTMLButtonElement).click();

    expect(host.cancelled()).toBe(true);
  });
});
