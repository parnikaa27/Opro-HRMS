import { Component, signal } from '@angular/core';
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { LeaveBalance, LeaveRequest, LeaveType } from '../../models/leave';
import { click, fill, NOW, pdf, pickFile, setupHttp, settle, text, texts } from '../../../testing/fixtures';
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
const BOOKED: LeaveRequest = {
  id: 'LR-1', employeeId: 'OPR-0018', type: 'annual', from: '2026-12-06', to: '2026-12-08', days: 3, reason: 'Trip', status: 'approved', appliedOn: '2026-11-01',
};

@Component({
  imports: [LeaveForm],
  template: `<app-leave-form [types]="types" [balances]="balances" [holidays]="holidays" [requests]="requests" joinedOn="2023-12-20" (applied)="applied.set(true); missing.set($event)" (cancelled)="cancelled.set(true)" />`,
})
class Host {
  types = TYPES;
  balances = BALANCES;
  holidays = new Set(['2026-12-01']);
  requests = [BOOKED];
  readonly applied = signal(false);
  readonly missing = signal<boolean | undefined>(undefined);
  readonly cancelled = signal(false);
}

describe('LeaveForm', () => {
  let http: HttpTestingController;
  let root: HTMLElement;
  let host: Host;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    http = setupHttp();
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    root = fixture.nativeElement;
    host = fixture.componentInstance;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

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
    fill(root, 'leave-to', '2026-12-04');
    await submitForm();

    expect(errors()).toContain('Those dates are all Fridays or public holidays. Nothing to take.');
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
    expect(request.request.body).toEqual({
      kind: 'initial', type: 'annual', from: '2026-12-03', to: '2026-12-03', days: 0.5, reason: 'Dentist', halfDay: 'first', usesFlightEntitlement: false, wantsSalaryAdvance: false,
    });
    request.flush({});
    await settle();
    expect(host.applied()).toBe(true);
  });

  it('lets unpaid leave go beyond any balance', async () => {
    fill(root, 'leave-type', 'unpaid');
    fill(root, 'leave-from', '2026-12-06');
    fill(root, 'leave-to', '2026-12-17');
    expect(text(root.querySelector('[data-testid=leave-preview]') as HTMLElement)).toBe('11 days requested Unpaid, so it doesn’t use a balance.');
    fill(root, 'leave-reason', 'Family emergency');
    await submitForm();

    expect(http.expectOne('/api/leave/requests').request.body.days).toBe(11);
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

  it('asks a type with notice that far ahead', async () => {
    host.types = TYPES.map((type) => (type.code === 'annual' ? { ...type, noticeDays: 30 } : type));
    TestBed.tick();
    fill(root, 'leave-from', '2026-12-03');
    fill(root, 'leave-to', '2026-12-03');
    await submitForm();

    expect(errors()).toContain('Annual leave is asked for 30 days ahead. The earliest it can start is 12 December 2026.');
  });

  it('keeps a request inside their leave year, which ends the day before they joined', async () => {
    fill(root, 'leave-type', 'unpaid');
    fill(root, 'leave-from', '2026-12-17');
    fill(root, 'leave-to', '2026-12-22');
    await submitForm();

    expect(errors()).toContain('Your leave year ends on 19 December 2026. Split this into two requests, one each side of it.');
  });

  it('amends a request: copies it in, gives its days back and names it', async () => {
    fill(root, 'leave-kind', 'amended');
    fill(root, 'leave-related', 'LR-1');
    expect((root.querySelector('[data-testid=leave-to]') as HTMLInputElement).value).toBe('2026-12-08');

    fill(root, 'leave-to', '2026-12-10');
    fill(root, 'leave-reason', 'Longer trip');
    click(root, 'leave-flight');
    await submitForm();

    const body = http.expectOne('/api/leave/requests').request.body;
    expect([body.kind, body.relatedRequestId, body.days, body.usesFlightEntitlement]).toEqual(['amended', 'LR-1', 5, true]);
  });

  it('starts an extension straight after the leave it extends, and refuses a gap', async () => {
    fill(root, 'leave-kind', 'extended');
    fill(root, 'leave-related', 'LR-1');
    expect((root.querySelector('[data-testid=leave-from]') as HTMLInputElement).value).toBe('2026-12-09');

    fill(root, 'leave-type', 'unpaid');
    fill(root, 'leave-from', '2026-12-12');
    fill(root, 'leave-to', '2026-12-12');
    await submitForm();

    expect(errors()).toContain('An extension starts straight after the leave it extends, which ends on 8 December 2026.');
  });

  it('needs the request an amendment changes', async () => {
    fill(root, 'leave-kind', 'amended');
    await submitForm();

    expect(errors()).toContain('Pick the request this changes.');
  });

  it('shows each day with its code and the day they are back', () => {
    fill(root, 'leave-from', '2026-11-30');
    fill(root, 'leave-to', '2026-12-04');

    expect(texts(root, 'day-strip')[0].replace(/\s+/g, ' ')).toBe('Mo 30 AL Tu 1 PH We 2 AL Th 3 AL Fr 4 OFF');
    expect(text(root.querySelector('[data-testid=return-date]') as HTMLElement)).toContain('Back at work on 5 December 2026.');
  });
});
