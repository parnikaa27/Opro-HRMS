import { HttpTestingController } from '@angular/common/http/testing';
import { OutputEmitterRef, Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LeaveType } from '../../../models/leave';
import { fill, NOW, settle, setupHttp, text } from '../../../../testing/fixtures';
import { AdjustBalanceForm } from './adjust-balance-form';
import { AnnouncementForm } from './announcement-form';
import { EventForm } from './event-form';
import { HolidayForm } from './holiday-form';
import { PolicyForm } from './policy-form';
import { RecordLeaveForm } from './record-leave-form';
import { VisaForm } from './visa-form';

const TYPES: LeaveType[] = [
  { code: 'annual', name: 'Annual leave', allowsHalfDay: true, defaultEntitlement: 30 },
  { code: 'sick', name: 'Sick leave', allowsHalfDay: true, defaultEntitlement: 30 },
  { code: 'unpaid', name: 'Unpaid leave', allowsHalfDay: false, isUnlimited: true },
];

describe('HR forms', () => {
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

  const render = async <T extends { saved: OutputEmitterRef<void>; cancelled: OutputEmitterRef<void> }>(component: Type<T>, inputs: Record<string, unknown> = {}) => {
    const fixture = TestBed.createComponent(component);
    Object.entries(inputs).forEach(([name, value]) => fixture.componentRef.setInput(name, value));
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const saved = vi.fn();
    const cancelled = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);
    fixture.componentInstance.cancelled.subscribe(cancelled);
    return { root, saved, cancelled };
  };

  const submit = async (root: HTMLElement) => {
    (root.querySelector('button[type=submit]') as HTMLButtonElement).click();
    await settle();
  };

  const errors = (root: HTMLElement) => [...root.querySelectorAll('.field-error')].map((error) => text(error));

  describe('AdjustBalanceForm', () => {
    const inputs = { employeeId: 'OPR-0021', name: 'Rahim Uddin', types: TYPES };

    it('offers only capped types and needs days and a reason', async () => {
      const { root } = await render(AdjustBalanceForm, inputs);

      expect([...root.querySelectorAll('[data-testid=adjust-type] option')].map((option) => text(option))).toEqual(['Annual leave', 'Sick leave']);
      await submit(root);

      expect(errors(root)).toEqual(['Enter how many days to add or remove.', 'Say why, so the change makes sense later.']);
    });

    it('sends the change with a trimmed reason, and says when it fails', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const { root, saved } = await render(AdjustBalanceForm, inputs);
      fill(root, 'adjust-type', 'sick');
      fill(root, 'adjust-days', '-1.5');
      fill(root, 'adjust-reason', '  Logged twice  ');

      await submit(root);
      const request = http.expectOne('/api/hr/balance-adjustments');
      expect(request.request.body).toEqual({ employeeId: 'OPR-0021', type: 'sick', days: -1.5, reason: 'Logged twice' });
      request.flush('', { status: 500, statusText: 'Server Error' });
      await settle();

      expect(text(root.querySelector('[role=alert]') as HTMLElement)).toBe("That didn't save. Try again in a moment.");
      expect(saved).not.toHaveBeenCalled();
    });
  });

  describe('RecordLeaveForm', () => {
    const inputs = { employeeId: 'OPR-0021', name: 'Rahim Uddin', types: TYPES, holidays: new Set(['2026-11-17']) };

    it('starts on sick leave and shows it as selected', async () => {
      const { root } = await render(RecordLeaveForm, inputs);
      const select = root.querySelector('[data-testid=record-type]') as HTMLSelectElement;

      expect(select.options[select.selectedIndex].textContent).toBe('Sick leave');
    });

    it('falls back to the first type when sick leave is not on offer', async () => {
      const { root } = await render(RecordLeaveForm, { ...inputs, types: [TYPES[2]] });
      const select = root.querySelector('[data-testid=record-type]') as HTMLSelectElement;

      expect(select.value).toBe('unpaid');
    });

    it('counts working days, checks the order of dates, and records the leave', async () => {
      const { root, saved } = await render(RecordLeaveForm, inputs);
      await submit(root);
      expect(errors(root)).toEqual(['Pick the first day.', 'Pick the last day.', 'Add a short reason for the record.']);

      fill(root, 'record-from', '2026-11-16');
      fill(root, 'record-to', '2026-11-14');
      expect(errors(root)).toContain("The last day can't be before the first.");

      fill(root, 'record-to', '2026-11-18');
      fill(root, 'record-reason', 'Hospital admission');
      expect(text(root.querySelector('[data-testid=record-preview]') as HTMLElement)).toContain('2 working days');

      await submit(root);
      const request = http.expectOne('/api/hr/leave-requests');
      expect(request.request.body).toEqual({ employeeId: 'OPR-0021', type: 'sick', from: '2026-11-16', to: '2026-11-18', days: 2, reason: 'Hospital admission' });
      request.flush({});
      await settle();

      expect(saved).toHaveBeenCalled();
    });

    it('rejects a range of only weekends and holidays', async () => {
      const { root } = await render(RecordLeaveForm, inputs);
      fill(root, 'record-from', '2026-11-13');
      fill(root, 'record-to', '2026-11-14');
      await submit(root);

      expect(errors(root)).toContain('Those dates are all weekends or holidays.');
    });
  });

  describe('VisaForm', () => {
    const visa = { workPermitNumber: 'WP-1', visaNumber: 'MV-EV-1', passportLast4: '1234', visaIssuedOn: '2025-11-02', visaExpiry: '2026-11-02', passportExpiry: '2029-09-04' };

    it('starts from the current papers and checks the passport and dates', async () => {
      const { root } = await render(VisaForm, { employeeId: 'OPR-0021', name: 'Rahim Uddin', visa });
      expect((root.querySelector('[data-testid=visa-number]') as HTMLInputElement).value).toBe('MV-EV-1');

      fill(root, 'visa-passport', 'AB12C');
      fill(root, 'visa-expiry', '2025-01-01');
      await submit(root);

      expect(errors(root)).toEqual(['Expiry must come after the issue date.', 'Exactly 4 letters or numbers.']);
    });

    it('saves new papers with the passport characters in capitals', async () => {
      const { root, saved } = await render(VisaForm, { employeeId: 'OPR-0021', name: 'Rahim Uddin', visa });
      fill(root, 'visa-expiry', '2028-11-01');
      fill(root, 'visa-passport', 'ab12');

      await submit(root);
      const request = http.expectOne('/api/hr/employees/OPR-0021/visa');
      expect(request.request.method).toBe('PUT');
      expect(request.request.body).toEqual({ ...visa, visaExpiry: '2028-11-01', passportLast4: 'AB12' });
      request.flush({});
      await settle();

      expect(saved).toHaveBeenCalled();
    });

    it('starts empty for someone with no record', async () => {
      const { root } = await render(VisaForm, { employeeId: 'OPR-0021', name: 'Rahim Uddin' });
      await submit(root);

      expect(errors(root)).toContain('Enter the visa number.');
    });
  });

  describe('HolidayForm', () => {
    it('adds a tentative holiday', async () => {
      const { root, saved } = await render(HolidayForm);
      await submit(root);
      expect(errors(root)).toEqual(['Give the holiday a name.', 'Pick the date.']);

      fill(root, 'holiday-name', ' Eid al Fitr ');
      fill(root, 'holiday-date', '2027-03-10');
      fill(root, 'holiday-certainty', 'tentative');
      await submit(root);
      const request = http.expectOne('/api/hr/holidays');
      expect(request.request.body).toEqual({ name: 'Eid al Fitr', date: '2027-03-10', isTentative: true });
      request.flush({});
      await settle();

      expect(saved).toHaveBeenCalled();
    });

    it('edits an existing holiday in place', async () => {
      const { root } = await render(HolidayForm, { holiday: { id: 'HD-3', name: 'Hajj Day', date: '2026-05-26', isTentative: true } });
      fill(root, 'holiday-certainty', 'confirmed');

      await submit(root);
      const request = http.expectOne('/api/hr/holidays/HD-3');

      expect(request.request.method).toBe('PUT');
      expect(request.request.body).toEqual({ name: 'Hajj Day', date: '2026-05-26', isTentative: false });
    });
  });

  describe('EventForm', () => {
    it('adds and edits company events', async () => {
      const { root, cancelled } = await render(EventForm, { event: { id: 'EV-1', name: 'Team review', date: '2026-12-02' } });
      fill(root, 'event-name', 'Office social');

      await submit(root);
      const request = http.expectOne('/api/hr/events/EV-1');
      expect(request.request.body).toEqual({ name: 'Office social', date: '2026-12-02' });

      (root.querySelector('.secondary-button') as HTMLButtonElement).click();
      expect(cancelled).toHaveBeenCalled();
    });

    it('needs a name and a date', async () => {
      const { root } = await render(EventForm);
      await submit(root);

      expect(errors(root)).toEqual(['Give the event a name.', 'Pick the date.']);
    });
  });

  describe('AnnouncementForm', () => {
    it('posts a new note and keeps titles short', async () => {
      const { root, saved } = await render(AnnouncementForm);
      fill(root, 'announcement-title', 'x'.repeat(81));
      await submit(root);
      expect(errors(root)).toContain('Keep it under 80 characters.');
      http.expectNone('/api/hr/announcements');

      fill(root, 'announcement-title', 'Year end dinner');
      fill(root, 'announcement-body', ' Malé terrace, 7 pm. ');
      await submit(root);
      const request = http.expectOne('/api/hr/announcements');
      expect(request.request.body).toEqual({ title: 'Year end dinner', body: 'Malé terrace, 7 pm.' });
      request.flush({});
      await settle();

      expect(saved).toHaveBeenCalled();
    });

    it('updates an existing note', async () => {
      const { root } = await render(AnnouncementForm, { announcement: { id: 'AN-1', title: 'Old', body: 'Text', publishedOn: '2026-11-01' } });
      await submit(root);

      expect(http.expectOne('/api/hr/announcements/AN-1').request.method).toBe('PUT');
    });
  });

  describe('PolicyForm', () => {
    it('changes days and half days for a capped type', async () => {
      const { root, saved } = await render(PolicyForm, { type: TYPES[0] });
      fill(root, 'policy-days', '-2');
      await submit(root);
      expect(errors(root)).toContain('Days can’t be negative.');

      fill(root, 'policy-days', '32');
      fill(root, 'policy-half', 'no');
      await submit(root);
      const request = http.expectOne('/api/hr/leave-types/annual');
      expect(request.request.body).toEqual({ name: 'Annual leave', allowsHalfDay: false, defaultEntitlement: 32 });
      request.flush({});
      await settle();

      expect(saved).toHaveBeenCalled();
    });

    it('never sends days for an unlimited type', async () => {
      const { root } = await render(PolicyForm, { type: TYPES[2] });
      expect(root.querySelector('[data-testid=policy-days]')).toBeNull();

      await submit(root);

      expect(http.expectOne('/api/hr/leave-types/unpaid').request.body).toEqual({ name: 'Unpaid leave', allowsHalfDay: false });
    });
  });

  it('cancels without saving', async () => {
    const { root, cancelled } = await render(AdjustBalanceForm, { employeeId: 'OPR-0021', name: 'Rahim Uddin', types: TYPES });

    (root.querySelector('.secondary-button') as HTMLButtonElement).click();

    expect(cancelled).toHaveBeenCalled();
  });
});
