import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Onboarding } from '../../models/onboarding';
import { click, employee, fill, NOW, respond, settle, setupHttp, text, texts } from '../../../testing/fixtures';
import { HrOnboardingCard } from './hr-onboarding-card';
import { describeDue, progress } from './onboarding-api';
import { OnboardingProgressCard } from './onboarding-progress-card';
import { OnboardingTasksCard } from './onboarding-tasks-card';
import { TeamOnboardingCard } from './team-onboarding-card';
import { WelcomeCard } from './welcome-card';

const KAVYA: Onboarding = {
  employeeId: 'OPR-0027', employeeName: 'Kavya Menon', designation: 'Operations Analyst', startsOn: '2026-11-01', firstDayTime: '08:45',
  firstDayPlace: 'Malé office', firstDayContact: 'Ananya Iyer', hodName: 'Vikram Singh', buddyName: 'Arjun Reddy', buddyId: 'OPR-0018',
  items: [
    { id: 'OI-1', name: 'Contract signed', owner: 'hr', dueOn: '2026-10-25', doneOn: '2026-10-24', doneByName: 'Ananya Iyer' },
    { id: 'OI-2', name: 'ID card printed', owner: 'hr', dueOn: '2026-11-01' },
    { id: 'OI-4', name: 'First week planned', owner: 'hod', dueOn: '2026-11-20' },
    { id: 'OI-5', name: 'Upload your documents', owner: 'joiner', dueOn: '2026-11-04' },
  ],
};

describe('onboarding', () => {
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

  it('says when a task is due and how far someone has got', () => {
    expect([describeDue(-7), describeDue(0), describeDue(1)]).toEqual(['7 days before joining', 'On their first day', '1 day after joining']);
    expect(progress(KAVYA)).toBe('1 of 4 done');
  });

  describe('WelcomeCard', () => {
    const render = async (onboarding: Onboarding | null) => {
      const fixture = TestBed.createComponent(WelcomeCard);
      TestBed.tick();
      http.expectOne('/api/onboarding').flush(onboarding);
      await settle();
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    };

    it('shows the first day, the HOD and buddy, and every task, with only their own to tick', async () => {
      const root = await render(KAVYA);

      expect(text(root.querySelector('[data-testid=first-day]') as HTMLElement)).toBe('First day, 1 November 2026 at 08:45 AM, Malé office. Ask for Ananya Iyer.');
      expect(text(root.querySelector('[data-testid=welcome-people]') as HTMLElement)).toBe('Your HOD is Vikram Singh. Arjun Reddy is your buddy: ask them anything.');
      expect(texts(root, 'onboarding-item')).toEqual([
        'Contract signed HR · Done 24 Oct by Ananya Iyer',
        'ID card printed HR · Due 1 Nov Overdue',
        'First week planned HOD · Due 20 Nov',
        'Upload your documents Joiner · Due 4 Nov Mark done',
      ]);

      click(root, 'do-task');
      expect(http.expectOne('/api/onboarding/OPR-0027/items/OI-5/done').request.method).toBe('POST');
    });

    it('shows nothing once onboarding is done, or for someone not onboarding', async () => {
      expect((await render({ ...KAVYA, completedOn: '2026-11-10' })).querySelector('[data-testid=welcome-card]')).toBeNull();
      expect((await render(null)).querySelector('[data-testid=welcome-card]')).toBeNull();
    });
  });

  describe('TeamOnboardingCard', () => {
    it('lets the HOD tick their tasks and pick a buddy from the team', async () => {
      const fixture = TestBed.createComponent(TeamOnboardingCard);
      await respond(http, {
        '/api/team/onboarding': [KAVYA],
        '/api/team': [employee({ id: 'OPR-0018', fullName: 'Arjun Reddy' }), employee({ id: 'OPR-0027', fullName: 'Kavya Menon' })],
      });
      const root = fixture.nativeElement as HTMLElement;

      expect([...root.querySelectorAll('[data-testid=pick-buddy] option')].map((option) => text(option))).toEqual(['Change buddy', 'Arjun Reddy']);
      click(root, 'do-task');
      expect(http.expectOne('/api/onboarding/OPR-0027/items/OI-4/done').request.method).toBe('POST');

      fill(root, 'pick-buddy', 'OPR-0018');
      expect(http.expectOne('/api/team/onboarding/OPR-0027/buddy').request.body).toEqual({ buddyId: 'OPR-0018' });
    });
  });

  describe('HrOnboardingCard', () => {
    const URL = '/api/hr/employees/OPR-0027/onboarding';
    const render = async (onboarding: Onboarding | null, inputs: { isRecent?: boolean; isOwn?: boolean } = {}) => {
      const fixture = TestBed.createComponent(HrOnboardingCard);
      fixture.componentRef.setInput('employeeId', 'OPR-0027');
      fixture.componentRef.setInput('isRecent', inputs.isRecent ?? true);
      fixture.componentRef.setInput('isOwn', inputs.isOwn ?? false);
      TestBed.tick();
      http.expectOne(URL).flush(onboarding);
      await settle();
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    };

    it('saves the first day and ticks HR’s tasks', async () => {
      const root = await render(KAVYA);
      expect((root.querySelector('[data-testid=first-day-time]') as HTMLInputElement).value).toBe('08:45');

      fill(root, 'first-day-place', ' Hulhumalé site office ');
      click(root, 'save-first-day');
      await settle();
      expect(http.expectOne(`${URL}/first-day`).request.body).toEqual({ time: '08:45', place: 'Hulhumalé site office', contact: 'Ananya Iyer' });
      expect(texts(root, 'do-task')).toEqual(['Mark done']);
    });

    it('starts onboarding for someone added before it existed', async () => {
      const root = await render(null);

      click(root, 'start-onboarding');
      expect(http.expectOne(URL).request.method).toBe('POST');
    });

    it('offers nothing to do on their own page, and no start for people long settled in', async () => {
      expect((await render(KAVYA, { isOwn: true })).querySelector('[data-testid=save-first-day]')).toBeNull();
      expect((await render(null, { isRecent: false })).querySelector('[data-testid=start-onboarding]')).toBeNull();
    });
  });

  describe('OnboardingProgressCard', () => {
    it('lists joiners with progress and what is overdue', async () => {
      const fixture = TestBed.createComponent(OnboardingProgressCard);
      await respond(http, { '/api/hr/onboarding': [KAVYA] });
      const root = fixture.nativeElement as HTMLElement;

      expect(texts(root, 'joiner-progress')).toEqual(['KM Kavya Menon Joined 1 Nov · 1 of 4 done · 2 overdue']);
    });
  });

  describe('OnboardingTasksCard', () => {
    it('lists HR’s tasks, adds one and removes one', async () => {
      const fixture = TestBed.createComponent(OnboardingTasksCard);
      await respond(http, { '/api/hr/onboarding-tasks': [{ id: 'OT-1', name: 'Contract signed', owner: 'hr', dueInDays: -7 }] });
      const root = fixture.nativeElement as HTMLElement;
      expect(texts(root, 'onboarding-task-row')).toEqual(['Contract signed HR · 7 days before joining Remove']);

      fill(root, 'onboarding-task-name', ' Meet the director ');
      fill(root, 'onboarding-task-owner', 'hod');
      fill(root, 'onboarding-task-days', '5');
      click(root, 'add-onboarding-task');
      await settle();
      expect(http.expectOne('/api/hr/onboarding-tasks').request.body).toEqual({ name: 'Meet the director', owner: 'hod', dueInDays: 5 });

      click(root, 'remove-onboarding-task');
      click(root, 'confirm-yes');
      expect(http.expectOne('/api/hr/onboarding-tasks/OT-1').request.method).toBe('DELETE');
    });
  });
});
