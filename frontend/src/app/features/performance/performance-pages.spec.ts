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
      form: { goalsStatus: 'approved', accomplishments: 'Cut reply times', certifications: 'CX certificate' },
      goals: [{ id: 'GL-3', title: 'Faster replies', measure: 'Under 4 hours', weight: 100 }],
      appraisals: [{ ...KARAN_APPRAISAL, recommendsPromotion: undefined, incrementPercent: undefined, selfReviewComment: 'Go for the certificate.' }],
      probationReviews: [{ id: 'PR-1', employeeId: 'OPR-0023', probationEnded: '2026-08-01', outcome: 'extended', extendedTo: '2026-11-01', comments: 'More time', reviewedByName: 'Vikram Singh', reviewedOn: '2026-07-20' }],
    };

    const render = async (mine: MyPerformance = MINE) => {
      const fixture = TestBed.createComponent(MyPerformancePage);
      await respond(http, { '/api/performance': mine });
      return fixture.nativeElement as HTMLElement;
    };

    it('shows goals, the appraisal with each goal rated, and the probation review', async () => {
      const root = await render();

      expect(texts(root, 'my-goal')).toEqual(['Faster replies Under 4 hours · 100%']);
      expect(text(root.querySelector('[data-testid=goals-status]') as HTMLElement)).toBe('Approved');
      expect(root.querySelector('[data-testid=write-goals]')).toBeNull();
      expect(text(root.querySelector('[data-testid=self-review]') as HTMLElement)).toBe('Accomplishments Cut reply times Plan for certifications CX certificate');
      expect(text(root.querySelector('[data-testid=self-review-comment-shown]') as HTMLElement)).toBe('On your self review: “Go for the certificate.”');
      // Appraised in this cycle, so the self review is final.
      expect(root.querySelector('[data-testid=write-self-review]')).toBeNull();
      expect(text(root.querySelector('[data-testid=my-appraisal]') as HTMLElement)).toContain('4, Exceeds expectations');
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

    it('writes goals while a draft or sent back, and shows why they came back', async () => {
      const root = await render({
        cycle: CYCLE, form: { goalsStatus: 'rejected', goalsNote: 'Add a customs goal', goalsDecidedByName: 'Vikram Singh' }, goals: [], appraisals: [], probationReviews: [],
      });

      expect(text(root.querySelector('[data-testid=goals-note-shown]') as HTMLElement)).toBe('Vikram Singh sent them back: “Add a customs goal”');
      click(root, 'write-goals');
      fill(root, 'goal-title', 'Clear customs faster');
      fill(root, 'goal-measure', 'Within 3 days');
      click(root, 'goals-submit');
      await settle();
      const written = http.expectOne('/api/performance/goals');
      expect(written.request.body).toEqual({ goals: [{ title: 'Clear customs faster', measure: 'Within 3 days', weight: 100 }] });
      written.flush([]);
      await settle();
      http.expectOne('/api/performance/goals/submit').flush({});
      await settle();

      expect(http.match('/api/performance')).toHaveLength(1);
    });

    it('saves goals as a draft without sending them', async () => {
      const root = await render({ cycle: CYCLE, goals: [], appraisals: [], probationReviews: [] });

      click(root, 'write-goals');
      fill(root, 'goal-title', 'Clear customs faster');
      fill(root, 'goal-measure', 'Within 3 days');
      click(root, 'goals-draft');
      await settle();
      http.expectOne('/api/performance/goals').flush([]);
      await settle();

      http.expectNone('/api/performance/goals/submit');
    });

    it('writes the self review', async () => {
      const root = await render({ cycle: CYCLE, form: { goalsStatus: 'submitted' }, goals: [], appraisals: [], probationReviews: [] });
      expect(text(root.querySelector('[data-testid=goals-status]') as HTMLElement)).toBe('Waiting for the HOD');

      click(root, 'write-self-review');
      fill(root, 'review-strengths', ' Patience ');
      click(root, 'review-submit');
      await settle();

      expect(http.expectOne('/api/performance/self-review').request.body).toEqual({ accomplishments: '', strengths: 'Patience', learning: '', certifications: '' });
    });

    it('explains an empty year, and a failed load', async () => {
      const empty = await render({ goals: [], appraisals: [], probationReviews: [] });
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
          employeeId: 'OPR-0018', fullName: 'Arjun Reddy', designation: 'Site Engineer', form: { goalsStatus: 'approved', strengths: 'Scheduling' },
          goals: [{ id: 'GL-1', title: 'Hand over', measure: 'Snag list', weight: 100 }],
        },
        { employeeId: 'OPR-0023', fullName: 'Karan Mehta', designation: 'Lead', form: { goalsStatus: 'approved' }, goals: KARAN_APPRAISAL.goals, appraisal: KARAN_APPRAISAL },
        { employeeId: 'OPR-0021', fullName: 'Rohit Verma', designation: 'Coordinator', form: { goalsStatus: 'submitted' }, goals: [{ id: 'GL-5', title: 'Freight', measure: '3 days', weight: 100 }] },
        { employeeId: 'OPR-0027', fullName: 'Kavya Menon', designation: 'Officer', probationEndsOn: '2026-12-20', goals: [] },
      ],
    };

    const render = async (team: TeamPerformance = TEAM) => {
      const fixture = TestBed.createComponent(TeamPerformancePage);
      await respond(http, { '/api/team/performance': team });
      return fixture;
    };

    it('lists probation to review and each person in the cycle', async () => {
      const root = (await render()).nativeElement as HTMLElement;

      expect(texts(root, 'probation-row')).toEqual(['KM Kavya Menon Officer PROBATION ENDS 20 December 2026 Review']);
      expect(texts(root, 'team-appraisal-row')).toEqual([
        'AR Arjun Reddy Site Engineer GOALS 1 goal, approved RATING Not yet Appraise',
        'KM Karan Mehta Lead GOALS 1 goal, approved RATING 4, Exceeds expectations Not accepted yet',
        'RV Rohit Verma Coordinator GOALS 1 goal, waiting for the hod RATING Not yet Review goals',
        'KM Kavya Menon Officer GOALS Not written yet RATING Not yet Waiting for their goals',
      ]);
    });

    it('approves goals someone sent, or sends them back with what to change', async () => {
      const root = (await render()).nativeElement as HTMLElement;

      click(root, 'review-goals');
      expect(texts(root, 'goal-to-decide')).toEqual(['Freight 3 days · 100%']);
      click(root, 'send-back-goals');
      click(root, 'confirm-send-back');
      await settle();
      expect(text(root.querySelector('dialog[open]') as HTMLElement)).toContain('Say what to change, so they can fix it.');
      fill(root, 'goals-note', 'Add a customs goal');
      click(root, 'confirm-send-back');
      await settle();
      const sentBack = http.expectOne('/api/team/performance/OPR-0021/goals/decision');
      expect(sentBack.request.body).toEqual({ decision: 'rejected', note: 'Add a customs goal' });
      sentBack.flush(null);
      await settle();

      expect(http.match('/api/team/performance')).toHaveLength(1);
    });

    it('shows their self review in the appraisal, with room to comment', async () => {
      const root = (await render()).nativeElement as HTMLElement;

      click(root, 'appraise');
      await settle();

      expect(text(root.querySelector('[data-testid=their-self-review]') as HTMLElement)).toContain('Strengths Scheduling');
    });

    it('opens the probation form', async () => {
      const root = (await render()).nativeElement as HTMLElement;

      click(root, 'review-probation');
      await settle();
      expect(root.querySelector('app-probation-review-form')).not.toBeNull();
    });

    it('says when no cycle is open', async () => {
      const root = (await render({ people: [] })).nativeElement as HTMLElement;

      expect(text(root)).toContain('No appraisal cycle is open. HR opens one each year');
      expect(root.querySelector('[data-testid=probation-card]')).toBeNull();
    });
  });

  describe('HrPerformancePage', () => {
    const OVERVIEW: HrPerformance = {
      cycles: [CYCLE],
      people: [
        {
          employeeId: 'OPR-0018', fullName: 'Arjun Reddy', department: 'Operations', managerName: 'Vikram Singh', form: { goalsStatus: 'hod-approved', hodApprovedByName: 'Vikram Singh' },
          goals: [{ id: 'GL-1', title: 'Hand over', measure: 'Snag list', weight: 60 }, { id: 'GL-2', title: 'Safety', measure: 'No incidents', weight: 40 }],
        },
        {
          employeeId: 'OPR-0023', fullName: 'Karan Mehta', department: 'Operations', managerName: 'Vikram Singh', form: { goalsStatus: 'approved' }, goals: KARAN_APPRAISAL.goals,
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
        'Arjun Reddy Operations Vikram Singh 2, waiting for hr Not yet Not yet Not yet',
        'Karan Mehta Operations Vikram Singh 1, approved 4, Exceeds expectations Promotion, 8% increment 12 Nov',
      ]);
      expect(texts(root, 'probation-review')).toEqual(['Kavya Menon by Vikram Singh, 12 Nov OUTCOME Confirmed COMMENTS Settled in well']);
      expect(root.querySelector('app-cycle-form')).toBeNull();
    });

    it('says None when an appraisal recommends nothing', async () => {
      const [, karan] = OVERVIEW.people;
      const root = await render({ ...OVERVIEW, people: [{ ...karan, appraisal: { ...KARAN_APPRAISAL, recommendsPromotion: false, incrementPercent: undefined } }] });

      expect(texts(root, 'hr-appraisal-row')).toEqual(['Karan Mehta Operations Vikram Singh 1, approved 4, Exceeds expectations None Not yet']);
    });

    it('approves goals the HOD approved', async () => {
      const root = await render();
      expect(texts(root, 'goals-for-hr-row')).toEqual(['Arjun Reddy Approved by Vikram Singh GOALS 2 Review goals']);

      click(root, 'review-goals');
      click(root, 'approve-goals');
      await settle();

      expect(http.expectOne('/api/hr/performance/OPR-0018/goals/decision').request.body).toEqual({ decision: 'approved' });
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
    });
  });
});
