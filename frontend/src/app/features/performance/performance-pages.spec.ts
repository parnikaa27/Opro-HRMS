import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HrPerformance, MyPerformance, TeamPerformance } from '../../models/performance';
import { click, fail, fill, NOW, respond, settle, setupHttp, text, texts } from '../../../testing/fixtures';
import { HrPerformancePage } from './hr-performance-page';
import { MyPerformancePage } from './my-performance-page';
import { TeamPerformancePage } from './team-performance-page';

const CYCLE = { id: 'AY-2026', name: '2026 appraisals', dueOn: '2027-01-31', openedOn: '2026-11-10' };
const KARAN_APPRAISAL = {
  id: 'AP-1', cycleId: 'AY-2026', cycleName: '2026 appraisals', employeeId: 'OPR-0023', rating: 4, comments: 'Calm through the busy season.',
  recommendsPromotion: true, incrementPercent: 8, appraisedByName: 'Vikram Singh', appraisedOn: '2026-11-11',
  goals: [{ id: 'GL-3', title: 'Faster replies', measure: 'Under 4 hours', weight: 100, rating: 4, comment: 'Under 3 hours since August.' }],
};

describe('Performance pages', () => {
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

  describe('MyPerformancePage', () => {
    const MINE: MyPerformance = {
      cycle: CYCLE,
      form: { status: 'approved', decidedByName: 'Ananya Iyer', decidedOn: '2026-11-11' },
      goals: [{ id: 'GL-3', title: 'Faster replies', measure: 'Under 4 hours', weight: 100 }],
      entries: [
        { id: 'PE-1', section: 'accomplishment', title: 'Cut reply times' },
        { id: 'PE-2', section: 'certification', title: 'CX certificate', details: 'Online', targetOn: '2027-06-30' },
      ],
      appraisals: [{ ...KARAN_APPRAISAL, recommendsPromotion: undefined, incrementPercent: undefined, selfReviewComment: 'Go for the certificate.' }],
      probationReviews: [{ id: 'PR-1', employeeId: 'OPR-0023', probationEnded: '2026-08-01', outcome: 'extended', extendedTo: '2026-11-01', comments: 'More time', reviewedByName: 'Vikram Singh', reviewedOn: '2026-07-20' }],
    };
    const DRAFT: MyPerformance = { cycle: CYCLE, goals: [], entries: [], appraisals: [], probationReviews: [] };

    const render = async (mine: MyPerformance = MINE) => {
      const fixture = TestBed.createComponent(MyPerformancePage);
      await respond(http, { '/api/performance': mine });
      return fixture.nativeElement as HTMLElement;
    };

    it('shows the plan as five numbered sections, the appraisal with each goal rated, and the probation review', async () => {
      const root = await render();

      expect(texts(root, 'plan-count')).toEqual(['1 added: Faster replies', '1 added: CX certificate', 'Nothing added yet', '1 added: Cut reply times', 'Nothing added yet']);
      // Appraised in this cycle, so the plan is final and only opens to read.
      expect(text(root.querySelector('[data-testid=plan-status-pill]') as HTMLElement)).toBe('Appraised');
      expect(root.querySelector('[data-testid=send-plan]')).toBeNull();
      click(root, 'plan-tile-certification');
      await settle();
      expect(text(root.querySelector('[data-testid=plan-view]') as HTMLElement)).toBe('2 Plan for certifications CX certificate Online · By 30 June 2027');
      expect(text(root.querySelector('[data-testid=self-review-comment-shown]') as HTMLElement)).toBe('On your plan: “Go for the certificate.”');
      expect(text(root.querySelector('[data-testid=my-appraisal]') as HTMLElement)).toContain('Faster replies 4, Exceeds expectations · Under 3 hours since August.');
      expect(text(root.querySelector('[data-testid=my-probation]') as HTMLElement)).toContain('Extended until 1 November 2026');
    });

    it('asks them to accept their rating, and accepts it', async () => {
      const root = await render();
      expect(text(root.querySelector('[data-testid=accept-needed]') as HTMLElement)).toContain('accept your rating');

      click(root, 'accept-rating');
      await settle();
      http.expectOne('/api/performance/appraisals/AP-1/accept').flush({});
      await settle();

      expect(http.match('/api/performance')).toHaveLength(1);
    });

    it('says what happens next at each step', async () => {
      const waiting = await render({ ...DRAFT, form: { status: 'hod-approved', hodApprovedByName: 'Vikram Singh', hodApprovedOn: '2026-11-11' } });
      expect(text(waiting.querySelector('[data-testid=plan-next]') as HTMLElement)).toBe('Vikram Singh approved it on 11 Nov. It’s with HR now.'.replace('’', "'"));

      const earlier = await render({ ...DRAFT, form: { status: 'approved' } });
      expect(text(earlier.querySelector('[data-testid=plan-next]') as HTMLElement)).toBe('Approved. Your HOD appraises you against it at the end of the cycle.');

      const back = await render({ ...DRAFT, form: { status: 'rejected', note: 'Add a customs goal', decidedByName: 'Vikram Singh', decidedOn: '2026-11-12' } });
      expect(text(back.querySelector('[data-testid=plan-note-shown]') as HTMLElement)).toBe('Vikram Singh sent it back: “Add a customs goal”');
    });

    it('saves goals as a draft, and sends the plan only once there are goals', async () => {
      const root = await render(DRAFT);
      expect((root.querySelector('[data-testid=send-plan]') as HTMLButtonElement).disabled).toBe(true);

      click(root, 'plan-tile-goals');
      await settle();
      fill(root, 'goal-title', 'Clear customs faster');
      fill(root, 'goal-measure', 'Within 3 days');
      click(root, 'goals-save');
      await settle();
      const written = http.expectOne('/api/performance/goals');
      expect(written.request.body).toEqual({ goals: [{ title: 'Clear customs faster', measure: 'Within 3 days', weight: 100 }] });
      written.flush([]);
      await settle();
      http.expectNone('/api/performance/submit');
      await respond(http, { '/api/performance': { ...DRAFT, goals: [{ id: 'GL-9', title: 'Clear customs faster', measure: 'Within 3 days', weight: 100 }] } });

      click(root, 'send-plan');
      await settle();
      http.expectOne('/api/performance/submit').flush({});
      await settle();
      expect(http.match('/api/performance')).toHaveLength(1);
    });

    it('adds several entries to a section, takes one off with its cross, and drops empty ones', async () => {
      const root = await render(DRAFT);

      click(root, 'plan-tile-certification');
      await settle();
      fill(root, 'entry-title', 'PMP');
      fill(root, 'entry-target', '2027-06-30');
      click(root, 'add-entry');
      click(root, 'add-entry');
      await settle();
      const titles = root.querySelectorAll<HTMLInputElement>('[data-testid=entry-title]');
      titles[1].value = 'Wrong one';
      titles[1].dispatchEvent(new Event('input'));
      await settle();
      root.querySelectorAll<HTMLButtonElement>('[data-testid=remove-entry]')[1].click();
      await settle();
      click(root, 'entries-save');
      await settle();

      expect(http.expectOne('/api/performance/sections/certification').request.body).toEqual({ entries: [{ title: 'PMP', targetOn: '2027-06-30' }] });
    });

    it('explains an empty year, and a failed load', async () => {
      const empty = await render({ goals: [], entries: [], appraisals: [], probationReviews: [] });
      expect(text(empty)).toContain('No appraisal cycle is open right now.');

      const fixture = TestBed.createComponent(MyPerformancePage);
      await fail(http, '/api/performance');
      expect(text(fixture.nativeElement)).toContain("Your performance didn't load.");
    });
  });

  describe('TeamPerformancePage', () => {
    const TEAM: TeamPerformance = {
      cycle: CYCLE,
      people: [
        {
          employeeId: 'OPR-0018', fullName: 'Arjun Reddy', designation: 'Site Engineer', managerName: 'Vikram Singh', form: { status: 'approved' },
          goals: [{ id: 'GL-1', title: 'Hand over', measure: 'Snag list', weight: 100 }], entries: [{ id: 'PE-1', section: 'strength', title: 'Scheduling' }],
        },
        { employeeId: 'OPR-0023', fullName: 'Karan Mehta', designation: 'Lead', form: { status: 'approved' }, goals: KARAN_APPRAISAL.goals, entries: [], appraisal: KARAN_APPRAISAL },
        {
          employeeId: 'OPR-0021', fullName: 'Rohit Verma', designation: 'Coordinator', form: { status: 'submitted', submittedOn: '2026-11-11' },
          goals: [{ id: 'GL-5', title: 'Freight', measure: '3 days', weight: 100 }], entries: [{ id: 'PE-2', section: 'learning', title: 'Customs rules', details: 'Course' }],
        },
        { employeeId: 'OPR-0027', fullName: 'Kavya Menon', designation: 'Officer', probationEndsOn: '2026-12-20', goals: [], entries: [] },
      ],
    };

    const render = async (team: TeamPerformance = TEAM, scope: 'team' | 'company' = 'team') => {
      const fixture = TestBed.createComponent(TeamPerformancePage);
      fixture.componentRef.setInput('scope', scope);
      await respond(http, { [`/api/${scope}/performance`]: team });
      return fixture.nativeElement as HTMLElement;
    };

    it('opens on plans to approve, with a tab for each stage', async () => {
      const root = await render();

      expect(texts(root, 'probation-row')).toEqual(['KM Kavya Menon Officer Probation ends 20 December 2026 Review']);
      expect(texts(root, 'team-appraisal-row')).toEqual(['RV Rohit Verma Coordinator Sent 11 Nov Review plan']);
      click(root, 'tab-appraise');
      expect(texts(root, 'team-appraisal-row')).toEqual(['AR Arjun Reddy Site Engineer Plan approved Appraise']);
      click(root, 'tab-waiting');
      expect(texts(root, 'team-appraisal-row')).toEqual(['KM Kavya Menon Officer Not sent yet View plan']);
      click(root, 'tab-done');
      expect(texts(root, 'team-appraisal-row')).toEqual(['KM Karan Mehta Lead Rated 4, not accepted yet View plan']);
    });

    it('shows the whole plan, and sends it back with what to change', async () => {
      const root = await render();

      click(root, 'review-plan');
      await settle();
      expect(texts(root, 'plan-view-section')).toEqual([
        '1 Goals and KPIs Freight 3 days · 100%',
        '2 Plan for certifications Nothing added.',
        '3 Learning and development Customs rules Course',
        '4 Accomplishments Nothing added.',
        '5 Strengths Nothing added.',
      ]);
      click(root, 'send-back-plan');
      click(root, 'confirm-send-back');
      await settle();
      expect(text(root.querySelector('dialog[open]') as HTMLElement)).toContain('Say what to change, so they can fix it.');
      fill(root, 'plan-note', 'Add a customs goal');
      click(root, 'confirm-send-back');
      await settle();
      const sentBack = http.expectOne('/api/team/performance/OPR-0021/decision');
      expect(sentBack.request.body).toEqual({ decision: 'rejected', note: 'Add a customs goal' });
      sentBack.flush(null);
      await settle();

      // The tab picked stays picked when the list reloads.
      click(root, 'tab-waiting');
      const [rohit] = TEAM.people.filter(({ employeeId }) => employeeId === 'OPR-0021');
      const others = TEAM.people.filter(({ employeeId }) => employeeId !== 'OPR-0021');
      await respond(http, { '/api/team/performance': { ...TEAM, people: [...others, { ...rohit, form: { status: 'rejected', decidedOn: '2026-11-12', note: 'Add a customs goal' } }] } });
      expect(texts(root, 'team-appraisal-row')).toEqual(['KM Kavya Menon Officer Not sent yet View plan', 'RV Rohit Verma Coordinator Sent back 12 Nov View plan']);
    });

    it('shows the rest of their plan in the appraisal, with room to comment', async () => {
      const root = await render();

      click(root, 'tab-appraise');
      click(root, 'appraise');
      await settle();

      expect(text(root.querySelector('[data-testid=their-self-review]') as HTMLElement)).toContain('5 Strengths Scheduling');
    });

    it('lets a super admin step in, naming each person’s HOD', async () => {
      const root = await render(TEAM, 'company');

      click(root, 'tab-appraise');
      expect(texts(root, 'team-appraisal-row')).toEqual(['AR Arjun Reddy Site Engineer, HOD Vikram Singh Plan approved Appraise']);
      click(root, 'tab-approve');
      click(root, 'review-plan');
      await settle();
      click(root, 'approve-plan');
      await settle();

      expect(http.expectOne('/api/company/performance/OPR-0021/decision').request.body).toEqual({ decision: 'approved' });
    });

    it('opens the probation form', async () => {
      const root = await render();

      click(root, 'review-probation');
      await settle();
      expect(root.querySelector('app-probation-review-form')).not.toBeNull();
    });

    it('says when no cycle is open', async () => {
      const root = await render({ people: [] });
      expect(text(root)).toContain('No appraisal cycle is open. HR opens one each year');
      expect(root.querySelector('[data-testid=probation-card]')).toBeNull();
    });
  });

  describe('HrPerformancePage', () => {
    const OVERVIEW: HrPerformance = {
      cycles: [CYCLE],
      people: [
        {
          employeeId: 'OPR-0018', fullName: 'Arjun Reddy', department: 'Operations', managerName: 'Vikram Singh', form: { status: 'hod-approved', hodApprovedByName: 'Vikram Singh', hodApprovedOn: '2026-11-11' },
          goals: [{ id: 'GL-1', title: 'Hand over', measure: 'Snag list', weight: 60 }, { id: 'GL-2', title: 'Safety', measure: 'No incidents', weight: 40 }],
          entries: [],
        },
        {
          employeeId: 'OPR-0023', fullName: 'Karan Mehta', department: 'Operations', managerName: 'Vikram Singh', form: { status: 'approved' }, goals: KARAN_APPRAISAL.goals, entries: [],
          appraisal: { ...KARAN_APPRAISAL, acceptedOn: '2026-11-12' },
        },
      ],
      probationReviews: [{ id: 'PR-1', employeeId: 'OPR-0027', employeeName: 'Kavya Menon', probationEnded: '2026-12-20', outcome: 'confirmed', comments: 'Settled in well', reviewedByName: 'Vikram Singh', reviewedOn: '2026-11-12' }],
    };

    const render = async (overview: HrPerformance = OVERVIEW) => {
      const fixture = TestBed.createComponent(HrPerformancePage);
      await respond(http, { '/api/hr/performance': overview });
      return fixture.nativeElement as HTMLElement;
    };

    it('shows how far the cycle has got, the recommendations and probation reviews', async () => {
      const root = await render();

      expect(text(root.querySelector('[data-testid=cycle-progress]') as HTMLElement)).toBe('1 of 2 appraised. Due 31 January 2027.');
      expect(texts(root, 'hr-appraisal-row')).toEqual([
        'Arjun Reddy Operations Vikram Singh Waiting for HR Not yet Not yet Not yet',
        'Karan Mehta Operations Vikram Singh Approved 4, Exceeds expectations Promotion, 8% increment 12 Nov',
      ]);
      expect(texts(root, 'probation-review')).toEqual(['Kavya Menon by Vikram Singh, 12 Nov Outcome Confirmed Comments Settled in well']);
      expect(root.querySelector('app-cycle-form')).toBeNull();
    });

    it('says None when an appraisal recommends nothing', async () => {
      const [, karan] = OVERVIEW.people;
      const root = await render({ ...OVERVIEW, people: [{ ...karan, appraisal: { ...KARAN_APPRAISAL, recommendsPromotion: false, incrementPercent: undefined } }] });

      expect(texts(root, 'hr-appraisal-row')).toEqual(['Karan Mehta Operations Vikram Singh Approved 4, Exceeds expectations None Not yet']);
    });

    it('approves plans the HOD approved', async () => {
      const root = await render();
      expect(texts(root, 'plan-for-hr-row')).toEqual(['Arjun Reddy Operations HOD approved Vikram Singh, 11 Nov Review plan']);

      click(root, 'review-plan');
      click(root, 'approve-plan');
      await settle();

      expect(http.expectOne('/api/hr/performance/OPR-0018/decision').request.body).toEqual({ decision: 'approved' });
    });

    it('closes the open cycle after asking', async () => {
      const root = await render();

      click(root, 'close-cycle');
      await settle();
      click(root, 'confirm-yes');
      await settle();
      http.expectOne('/api/hr/appraisal-cycles/AY-2026/close').flush({});
      await settle();

      expect(http.match('/api/hr/performance')).toHaveLength(1);
    });

    it('says when closing fails', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const root = await render();

      click(root, 'close-cycle');
      await settle();
      click(root, 'confirm-yes');
      await settle();
      http.expectOne('/api/hr/appraisal-cycles/AY-2026/close').flush('', { status: 500, statusText: 'Error' });
      await settle();

      expect(text(root)).toContain("That didn't close.");
    });

    it('offers to open a cycle when none is open', async () => {
      const root = await render({ cycles: [], people: [], probationReviews: [] });

      expect(root.querySelector('app-cycle-form')).not.toBeNull();
      expect(text(root)).toContain('No probation reviews yet.');
      expect(text(root)).toContain('No plans waiting for HR.');
    });
  });
});
