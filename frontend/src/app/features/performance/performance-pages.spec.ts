import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { HrPerformance, MyPerformance, TeamPerformance } from '../../models/performance';
import { click, fail, NOW, respond, settle, setupHttp, text, texts } from '../../../testing/fixtures';
import { GoalsForm } from './forms/goals-form';
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
      goals: [{ id: 'GL-3', title: 'Faster replies', measure: 'Under 4 hours', weight: 100 }],
      appraisals: [{ ...KARAN_APPRAISAL, recommendsPromotion: undefined, incrementPercent: undefined }],
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
      expect(text(root.querySelector('[data-testid=my-appraisal]') as HTMLElement)).toContain('4, Exceeds expectations');
      expect(text(root.querySelector('[data-testid=my-appraisal]') as HTMLElement)).toContain('Faster replies 4, Exceeds expectations · Under 3 hours since August.');
      expect(text(root.querySelector('[data-testid=my-probation]') as HTMLElement)).toContain('Extended until 1 November 2026');
    });

    it('acknowledges an appraisal once read', async () => {
      const root = await render();

      click(root, 'acknowledge');
      await settle();
      http.expectOne('/api/performance/appraisals/AP-1/acknowledge').flush({});
      await settle();

      expect(http.match('/api/performance')).toHaveLength(1);
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
        { employeeId: 'OPR-0018', fullName: 'Arjun Reddy', designation: 'Site Engineer', goals: [{ id: 'GL-1', title: 'Hand over', measure: 'Snag list', weight: 100 }] },
        { employeeId: 'OPR-0023', fullName: 'Karan Mehta', designation: 'Lead', goals: KARAN_APPRAISAL.goals, appraisal: KARAN_APPRAISAL },
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
        'AR Arjun Reddy Site Engineer GOALS 1 goal RATING Not yet Goals Appraise',
        'KM Karan Mehta Lead GOALS 1 goal RATING 4, Exceeds expectations Not read yet',
        'KM Kavya Menon Officer GOALS None yet RATING Not yet Goals Appraise',
      ]);
    });

    it('opens the goals form and reloads once saved', async () => {
      const fixture = await render();
      const root = fixture.nativeElement as HTMLElement;

      click(root, 'set-goals');
      await settle();
      fixture.debugElement.query(By.directive(GoalsForm)).componentInstance.saved.emit();
      await settle();

      expect(http.match('/api/team/performance')).toHaveLength(1);
    });

    it('opens the appraisal and probation forms', async () => {
      const root = (await render()).nativeElement as HTMLElement;

      click(root, 'appraise');
      await settle();
      expect(root.querySelector('app-appraisal-form')).not.toBeNull();
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
        { employeeId: 'OPR-0018', fullName: 'Arjun Reddy', department: 'Operations', managerName: 'Vikram Singh', goalCount: 2 },
        { employeeId: 'OPR-0023', fullName: 'Karan Mehta', department: 'Operations', managerName: 'Vikram Singh', goalCount: 1, appraisal: { ...KARAN_APPRAISAL, acknowledgedOn: '2026-11-12' } },
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
        'Arjun Reddy Operations Vikram Singh 2 Not yet',
        'Karan Mehta Operations Vikram Singh 1 4, Exceeds expectations Promotion, 8% increment 12 Nov',
      ]);
      expect(texts(root, 'probation-review')).toEqual(['Kavya Menon by Vikram Singh, 12 Nov OUTCOME Confirmed COMMENTS Settled in well']);
      expect(root.querySelector('app-cycle-form')).toBeNull();
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
