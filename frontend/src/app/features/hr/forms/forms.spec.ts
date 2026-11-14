import { HttpTestingController } from '@angular/common/http/testing';
import { OutputRef, Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LeaveType } from '../../../models/leave';
import { fill, NOW, pickFile, settle, setupHttp, text } from '../../../../testing/fixtures';
import { employee } from '../../../../testing/fixtures';
import { AdjustBalanceForm } from './adjust-balance-form';
import { EmployeeForm } from './employee-form';
import { LeavingForm } from './leaving-form';
import { PhotoForm } from './photo-form';
import { ScheduleForm } from './schedule-form';
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

  const render = async <T extends { saved: OutputRef<unknown>; cancelled: OutputRef<void> }>(component: Type<T>, inputs: Record<string, unknown> = {}) => {
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

  describe('ScheduleForm', () => {
    const CURRENT = { id: 'WS-1', effectiveFrom: '2024-01-01', shiftStart: '09:00', shiftEnd: '17:00', graceMinutes: 15, halfDayMinutes: 240, ramadanStart: '09:00', ramadanEnd: '14:00', reason: 'x', setBy: 'H', setOn: '2023-12-10' };

    it('starts from the rules in force and only accepts sensible changes', async () => {
      const { root } = await render(ScheduleForm, { current: CURRENT });
      expect((root.querySelector('[data-testid=schedule-half]') as HTMLInputElement).value).toBe('4');

      fill(root, 'schedule-from', '2026-11-12');
      fill(root, 'schedule-end', '08:00');
      fill(root, 'schedule-ramadan-end', '08:00');
      fill(root, 'schedule-grace', '90');
      await submit(root);

      expect(errors(root)).toEqual([
        'Changes can only start after today.',
        'The shift has to end after it starts.',
        'Keep grace to 60 minutes or less.',
        'A half day has to be shorter than the shift.',
        'Ramadan hours have to end after they start.',
        'Say why, so the change makes sense later.',
      ]);
    });

    it('saves a new version from a future date', async () => {
      const { root, saved } = await render(ScheduleForm, { current: CURRENT });
      fill(root, 'schedule-from', '2026-12-01');
      fill(root, 'schedule-start', '08:30');
      fill(root, 'schedule-end', '16:30');
      fill(root, 'schedule-half', '3.5');
      fill(root, 'schedule-reason', ' Earlier start ');

      await submit(root);
      const request = http.expectOne('/api/hr/schedules');
      expect(request.request.body).toEqual({ effectiveFrom: '2026-12-01', shiftStart: '08:30', shiftEnd: '16:30', graceMinutes: 15, halfDayMinutes: 210, ramadanStart: '09:00', ramadanEnd: '14:00', reason: 'Earlier start' });
      request.flush({});
      await settle();

      expect(saved).toHaveBeenCalled();
    });

    it('has defaults when nothing is in force yet', async () => {
      const { root } = await render(ScheduleForm);

      expect((root.querySelector('[data-testid=schedule-start]') as HTMLInputElement).value).toBe('09:00');
    });
  });

  describe('EmployeeForm', () => {
    const PEOPLE = [
      employee({ id: 'OPR-0001', fullName: 'Hassan Waheed', department: 'Operations', managerId: undefined }),
      employee({ id: 'OPR-0004', fullName: 'Ibrahim Rasheed', managerId: 'OPR-0001' }),
      employee({ id: 'OPR-0018', fullName: 'Kasun Perera', department: 'Site', managerId: 'OPR-0004' }),
    ];
    const NEW_PERSON = {
      'employee-name': 'Fathimath Nazra', 'employee-designation': 'Accounts Officer', 'employee-department': 'Finance', 'employee-email': 'nazra@opro.mv',
      'employee-joined': '2026-11-15', 'employee-phone': '+960 777 1030', 'employee-nationality': 'Maldivian', 'employee-manager': 'OPR-0001',
      'employee-contact-name': 'Ali Nazir', 'employee-contact-relation': 'Father', 'employee-contact-phone': '+960 777 2030',
    };

    it('names every missing field and needs a manager for a new person', async () => {
      const { root } = await render(EmployeeForm, { people: PEOPLE });
      await submit(root);

      expect(errors(root)).toEqual([
        'Enter their full name.', 'Enter their job title.', 'Enter their department.', 'Pick who they report to.', 'Enter their work email.', 'Pick the day they start.',
        'Enter their phone number.', 'Enter their nationality.', 'Enter who to call in an emergency.', 'Say how they’re related.', 'Enter a number to call.',
      ]);
      expect([...root.querySelectorAll('#departments option')].map((option) => option.getAttribute('value'))).toEqual(['Operations', 'Site']);
    });

    it('adds a person and shows the server’s reason when it says no', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const { root, saved } = await render(EmployeeForm, { people: PEOPLE });
      Object.entries(NEW_PERSON).forEach(([testId, value]) => fill(root, testId, value));

      await submit(root);
      http.expectOne('/api/hr/employees').flush({ message: 'That email is already in use' }, { status: 409, statusText: 'Conflict' });
      await settle();
      expect(text(root.querySelector('[role=alert]') as HTMLElement)).toBe('That email is already in use');

      await submit(root);
      const request = http.expectOne('/api/hr/employees');
      expect(request.request.body).toEqual({
        fullName: 'Fathimath Nazra', designation: 'Accounts Officer', department: 'Finance', workLocation: 'Malé office', employmentType: 'Full-time', email: 'nazra@opro.mv',
        joinedOn: '2026-11-15', phone: '+960 777 1030', nationality: 'Maldivian', bloodGroup: 'A+', managerId: 'OPR-0001',
        emergencyContact: { name: 'Ali Nazir', relation: 'Father', phone: '+960 777 2030' },
      });
      request.flush({ id: 'OPR-0028' });
      await settle();
      expect(saved).toHaveBeenCalledWith({ id: 'OPR-0028' });
    });

    it('edits a person, never offering them or their reports as manager', async () => {
      const { root } = await render(EmployeeForm, { people: PEOPLE, employee: PEOPLE[1] });

      expect([...root.querySelectorAll('[data-testid=employee-manager] option')].map((option) => text(option))).toEqual(['Pick their manager', 'Hassan Waheed, Site Engineer']);
      expect((root.querySelector('[data-testid=employee-name]') as HTMLInputElement).value).toBe('Ibrahim Rasheed');
      await submit(root);
      expect(http.expectOne('/api/hr/employees/OPR-0004').request.method).toBe('PUT');
    });

    it('lets the person at the top stay without a manager, and says when saving fails', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const { root } = await render(EmployeeForm, { people: PEOPLE, employee: PEOPLE[0] });
      expect(text(root.querySelector('[data-testid=employee-manager] option') as HTMLElement)).toBe('Nobody, they lead the company');

      await submit(root);
      const request = http.expectOne('/api/hr/employees/OPR-0001');
      expect(request.request.body.managerId).toBeUndefined();
      request.flush('', { status: 500, statusText: 'Server Error' });
      await settle();
      expect(text(root.querySelector('[role=alert]') as HTMLElement)).toBe("That didn't save. Try again in a moment.");
    });
  });

  describe('LeavingForm', () => {
    const inputs = { employeeId: 'OPR-0021', name: 'Rahim Uddin', joinedOn: '2024-04-01', reports: [] };

    it('needs a last day after they joined and a reason', async () => {
      const { root } = await render(LeavingForm, inputs);
      fill(root, 'leaving-date', '2024-01-01');
      await submit(root);

      expect(errors(root)).toEqual(['That’s before they joined.', 'Say why, for their record.']);
    });

    it('saves the last day, and shows why the server refused', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const { root, saved } = await render(LeavingForm, inputs);
      fill(root, 'leaving-date', '2026-12-31');
      fill(root, 'leaving-reason', ' Moving abroad ');

      await submit(root);
      http.expectOne('/api/hr/employees/OPR-0021/leaving').flush({ message: 'Move their 2 reports to another manager first' }, { status: 409, statusText: 'Conflict' });
      await settle();
      expect(text(root.querySelector('[role=alert]') as HTMLElement)).toBe('Move their 2 reports to another manager first');

      await submit(root);
      const request = http.expectOne('/api/hr/employees/OPR-0021/leaving');
      expect(request.request.body).toEqual({ lastDay: '2026-12-31', reason: 'Moving abroad' });
      request.flush({});
      await settle();
      expect(saved).toHaveBeenCalled();
    });

    it('asks to move reports first, in the right number', async () => {
      const { root, cancelled } = await render(LeavingForm, { ...inputs, reports: [employee(), employee({ id: 'B', fullName: 'Priya Nair' })] });

      expect(text(root.querySelector('[data-testid=move-reports]') as HTMLElement)).toContain('2 people report to Rahim.');
      expect(root.querySelector('form')).toBeNull();
      (root.querySelector('.secondary-button') as HTMLButtonElement).click();
      expect(cancelled).toHaveBeenCalled();
    });
  });

  describe('PhotoForm', () => {
    const inputs = { employeeId: 'OPR-0021', name: 'Rahim Uddin' };
    const photo = new File(['x'], 'face.png', { type: 'image/png' });
    let drawImage: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      drawImage = vi.fn();
      vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 800, height: 600, close: vi.fn() })));
      // jsdom has no canvas. The form only ever calls drawImage on it.
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ({ drawImage }) as unknown as CanvasRenderingContext2D);
      vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((done) => done(new Blob(['jpeg'], { type: 'image/jpeg' })));
    });

    afterEach(() => vi.unstubAllGlobals());

    it('crops a picked photo to the card, centred, and uploads a JPEG', async () => {
      const { root, saved } = await render(PhotoForm, inputs);
      expect((root.querySelector('[data-testid=photo-submit]') as HTMLButtonElement).disabled).toBe(true);

      pickFile(root, 'photo-file', photo);
      await settle();
      // 800 by 600 scaled to cover 480 by 600 is 800 by 600, so it shifts left by 160.
      expect(drawImage).toHaveBeenCalledWith(expect.anything(), -160, 0, 800, 600);

      (root.querySelector('[data-testid=photo-submit]') as HTMLButtonElement).click();
      await settle();
      const request = http.expectOne('/api/hr/employees/OPR-0021/photo');
      expect(request.request.method).toBe('PUT');
      expect((request.request.body as Blob).type).toBe('image/jpeg');
      request.flush({});
      await settle();
      expect(saved).toHaveBeenCalled();
    });

    it('turns away files that aren’t photos, or can’t be read', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const { root } = await render(PhotoForm, inputs);

      pickFile(root, 'photo-file', new File(['x'], 'cv.pdf', { type: 'application/pdf' }));
      expect(text(root.querySelector('[role=alert]') as HTMLElement)).toBe('Pick a JPG, PNG or WebP photo under 10 MB.');

      vi.stubGlobal('createImageBitmap', vi.fn(async () => Promise.reject(new Error('broken'))));
      pickFile(root, 'photo-file', photo);
      await settle();
      expect(text(root.querySelector('[role=alert]') as HTMLElement)).toBe("That file isn't a photo we can read. Try another one.");
    });

    it('says when saving fails', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const { root } = await render(PhotoForm, inputs);
      pickFile(root, 'photo-file', photo);
      await settle();

      (root.querySelector('[data-testid=photo-submit]') as HTMLButtonElement).click();
      await settle();
      http.expectOne('/api/hr/employees/OPR-0021/photo').flush('', { status: 500, statusText: 'Server Error' });
      await settle();

      expect(text(root.querySelector('[role=alert]') as HTMLElement)).toBe("That didn't save. Try again in a moment.");
    });

    it('shows the current photo and can go back to initials', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const { root, saved } = await render(PhotoForm, { ...inputs, photoUrl: '/api/employees/OPR-0021/photo?v=1' });
      expect(root.querySelector('.photo-picker img')?.getAttribute('src')).toBe('/api/employees/OPR-0021/photo?v=1');

      (root.querySelector('[data-testid=remove-photo]') as HTMLButtonElement).click();
      TestBed.tick();
      (root.querySelector('[data-testid=confirm-yes]') as HTMLButtonElement).click();
      await settle();
      http.expectOne('/api/hr/employees/OPR-0021/photo').flush('', { status: 500, statusText: 'Server Error' });
      await settle();
      expect(root.querySelector('[role=alert]')).not.toBeNull();

      (root.querySelector('[data-testid=remove-photo]') as HTMLButtonElement).click();
      TestBed.tick();
      (root.querySelector('[data-testid=confirm-yes]') as HTMLButtonElement).click();
      await settle();
      http.expectOne('/api/hr/employees/OPR-0021/photo').flush(null);
      await settle();
      expect(saved).toHaveBeenCalled();
    });
  });

  it('cancels without saving', async () => {
    const { root, cancelled } = await render(AdjustBalanceForm, { employeeId: 'OPR-0021', name: 'Rahim Uddin', types: TYPES });

    (root.querySelector('.secondary-button') as HTMLButtonElement).click();

    expect(cancelled).toHaveBeenCalled();
  });
});
