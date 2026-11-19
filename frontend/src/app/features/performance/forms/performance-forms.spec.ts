import { HttpTestingController } from '@angular/common/http/testing';
import { OutputRef, Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Goal } from '../../../models/performance';
import { byTestId, click, fill, NOW, settle, setupHttp, text } from '../../../../testing/fixtures';
import { AppraisalForm } from './appraisal-form';
import { CycleForm } from './cycle-form';
import { GoalsForm } from './goals-form';
import { ProbationReviewForm } from './probation-review-form';

const GOALS: Goal[] = [
  { id: 'GL-1', title: 'Hand over phase 2', measure: 'Snag list closed', weight: 60 },
  { id: 'GL-2', title: 'Fewer incidents', measure: 'No lost time', weight: 40 },
];

describe('Performance forms', () => {
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

  const render = async <T extends { saved: OutputRef<unknown>; cancelled: OutputRef<void> }>(component: Type<T>, inputs: Record<string, unknown>) => {
    const fixture = TestBed.createComponent(component);
    Object.entries(inputs).forEach(([name, value]) => fixture.componentRef.setInput(name, value));
    await fixture.whenStable();
    const saved = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);
    return { root: fixture.nativeElement as HTMLElement, saved };
  };

  const submit = async (root: HTMLElement) => {
    (root.querySelector('button[type=submit]') as HTMLButtonElement).click();
    await settle();
  };

  describe('GoalsForm', () => {
    it('starts with one goal at 100% and refuses weights that miss 100', async () => {
      const { root } = await render(GoalsForm, { employeeId: 'OPR-0021', name: 'Rohit Verma' });
      fill(root, 'goal-title', 'Faster deliveries');
      fill(root, 'goal-measure', 'Same day for Malé');
      click(root, 'add-goal');
      await settle();
      expect(text(root.querySelector('[data-testid=weight-total]') as HTMLElement)).toBe('Weights add up to 100%');

      const [, second] = byTestId(root, 'goal-fields');
      fill(second, 'goal-title', 'Train a driver');
      fill(second, 'goal-measure', 'Covers a week alone');
      fill(second, 'goal-weight', '20');
      await submit(root);

      expect(text(root.querySelector('[data-testid=goals-error]') as HTMLElement)).toBe('Goal weights need to add up to 100%.');
      http.expectNone('/api/team/performance/OPR-0021/goals');
    });

    it('replaces the goals with what is on screen', async () => {
      const { root, saved } = await render(GoalsForm, { employeeId: 'OPR-0018', name: 'Arjun Reddy', goals: GOALS });
      const [first] = byTestId(root, 'remove-goal');
      first.click();
      await settle();
      fill(root, 'goal-weight', '100');
      await submit(root);

      const request = http.expectOne('/api/team/performance/OPR-0018/goals');
      expect(request.request.body).toEqual({ goals: [{ title: 'Fewer incidents', measure: 'No lost time', weight: 100 }] });
      request.flush([]);
      await settle();
      expect(saved).toHaveBeenCalled();
    });

    it('shows why the server refused', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const { root } = await render(GoalsForm, { employeeId: 'OPR-0018', name: 'Arjun Reddy', goals: GOALS });
      await submit(root);

      http.expectOne('/api/team/performance/OPR-0018/goals').flush({ message: "They've already been appraised in 2026 appraisals." }, { status: 409, statusText: 'Conflict' });
      await settle();
      expect(text(root.querySelector('[data-testid=goals-error]') as HTMLElement)).toBe("They've already been appraised in 2026 appraisals.");
    });
  });

  describe('AppraisalForm', () => {
    it('rates every goal and the year, and sends recommendations only when given', async () => {
      const { root, saved } = await render(AppraisalForm, { employeeId: 'OPR-0018', name: 'Arjun Reddy', goals: GOALS });
      const [first, second] = byTestId(root, 'rate-goal');
      fill(first, 'goal-rating', '5');
      fill(first, 'goal-comment', 'Handed over early');
      fill(second, 'goal-rating', '2');
      await settle();
      expect(text(root.querySelector('[data-testid=goal-average]') as HTMLElement)).toBe('Weighted by goal, the ratings come to 3.8.');

      await submit(root);
      expect(text(root)).toContain('Write a few lines so they know why.');
      fill(root, 'appraisal-comments', 'A strong year on site.');
      fill(root, 'overall-rating', '4');
      click(root, 'recommend-promotion');
      await submit(root);

      const request = http.expectOne('/api/team/performance/OPR-0018/appraisal');
      expect(request.request.body).toEqual({
        rating: 4, comments: 'A strong year on site.', recommendsPromotion: true,
        goals: [{ goalId: 'GL-1', rating: 5, comment: 'Handed over early' }, { goalId: 'GL-2', rating: 2 }],
      });
      request.flush({});
      await settle();
      expect(saved).toHaveBeenCalled();
    });

    it('sends an increment when one is recommended, and says when saving fails', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const { root } = await render(AppraisalForm, { employeeId: 'OPR-0021', name: 'Rohit Verma', goals: [] });
      expect(root.querySelector('[data-testid=goal-average]')).toBeNull();
      fill(root, 'appraisal-comments', 'Steady.');
      fill(root, 'recommend-increment', '5');
      await submit(root);

      const request = http.expectOne('/api/team/performance/OPR-0021/appraisal');
      expect(request.request.body).toEqual({ rating: 3, comments: 'Steady.', recommendsPromotion: false, incrementPercent: 5, goals: [] });
      request.flush('', { status: 500, statusText: 'Error' });
      await settle();
      expect(text(root.querySelector('[data-testid=appraisal-error]') as HTMLElement)).toBe("That didn't save. Try again in a moment.");
    });
  });

  describe('ProbationReviewForm', () => {
    it('asks for a new end date when extending', async () => {
      const { root, saved } = await render(ProbationReviewForm, { employeeId: 'OPR-0027', name: 'Kavya Menon', endsOn: '2026-12-20' });
      fill(root, 'probation-outcome', 'extended');
      fill(root, 'probation-comments', 'More time on the new system');
      await submit(root);
      expect(text(root)).toContain('Pick the new end date.');

      fill(root, 'probation-extended-to', '2027-03-20');
      await submit(root);
      const request = http.expectOne('/api/team/performance/OPR-0027/probation-review');
      expect(request.request.body).toEqual({ outcome: 'extended', extendedTo: '2027-03-20', comments: 'More time on the new system' });
      request.flush({});
      await settle();
      expect(saved).toHaveBeenCalled();
    });

    it('confirms without a date', async () => {
      const { root } = await render(ProbationReviewForm, { employeeId: 'OPR-0027', name: 'Kavya Menon', endsOn: '2026-12-20' });
      fill(root, 'probation-comments', 'Settled in well');
      await submit(root);

      expect(http.expectOne('/api/team/performance/OPR-0027/probation-review').request.body).toEqual({ outcome: 'confirmed', comments: 'Settled in well' });
    });
  });

  describe('CycleForm', () => {
    it('opens a cycle and clears itself, or shows why not', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const fixture = TestBed.createComponent(CycleForm);
      const opened = vi.fn();
      fixture.componentInstance.opened.subscribe(opened);
      await fixture.whenStable();
      const root = fixture.nativeElement as HTMLElement;

      fill(root, 'cycle-name', '2026 appraisals');
      fill(root, 'cycle-due', '2027-01-31');
      click(root, 'cycle-submit');
      await settle();
      http.expectOne('/api/hr/appraisal-cycles').flush({ message: 'A cycle is already open. Close it before opening another.' }, { status: 409, statusText: 'Conflict' });
      await settle();
      expect(text(root.querySelector('[data-testid=cycle-error]') as HTMLElement)).toBe('A cycle is already open. Close it before opening another.');

      click(root, 'cycle-submit');
      await settle();
      const request = http.expectOne('/api/hr/appraisal-cycles');
      expect(request.request.body).toEqual({ name: '2026 appraisals', dueOn: '2027-01-31' });
      request.flush({});
      await settle();
      expect(opened).toHaveBeenCalled();
      expect((root.querySelector('[data-testid=cycle-name]') as HTMLInputElement).value).toBe('');
    });
  });
});
