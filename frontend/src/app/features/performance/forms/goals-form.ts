import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { applyEach, FormField, form, max, min, required, submit } from '@angular/forms/signals';
import { Goal, GoalPlan } from '../../../models/performance';
import { FieldError } from '../../../shared/ui/field-error';
import { ModalHeading } from '../../../shared/ui/modal-heading';
import { serverReason } from '../../../shared/utils/form-submit';
import { PerformanceApi } from '../performance-api';

const MAX_GOALS = 10;
const FULL_WEIGHT = 100;
const FAILED = "That didn't save. Try again in a moment.";

// The HOD sets one person's goals for the open cycle, weighted to 100%. Saving replaces what was there.
@Component({
  selector: 'app-goals-form',
  imports: [FieldError, FormField, ModalHeading],
  template: `
    <app-modal-heading eyebrow="PERFORMANCE" [heading]="'Goals for ' + name()" intro="Say how each goal will be measured, so the rating at the end of the year is easy to agree on." />
    <form novalidate (submit)="save($event)">
      @for (goal of goalsForm.goals; track $index; let index = $index) {
        <fieldset class="goal-fields" data-testid="goal-fields">
          <legend>Goal {{ index + 1 }}</legend>
          <label>Goal <input [formField]="goal.title" placeholder="Hand over phase 2 of the site" data-testid="goal-title" [attr.aria-describedby]="'goal-title-error-' + index" /></label>
          <app-field-error [id]="'goal-title-error-' + index" [errors]="goal.title().errors()" [isTouched]="goal.title().touched()" />
          <div class="form-row">
            <label>Measured by <input [formField]="goal.measure" placeholder="Snag list closed by 30 November" data-testid="goal-measure" [attr.aria-describedby]="'goal-measure-error-' + index" /></label>
            <label>Weight (%) <input type="number" [formField]="goal.weight" data-testid="goal-weight" /></label>
          </div>
          <app-field-error [id]="'goal-measure-error-' + index" [errors]="goal.measure().errors()" [isTouched]="goal.measure().touched()" />
          @if (draft().goals.length > 1) {
            <button type="button" class="text-link" (click)="remove(index)" data-testid="remove-goal">Remove this goal</button>
          }
        </fieldset>
      }
      @if (draft().goals.length < maxGoals) {
        <button type="button" class="text-link" (click)="add()" data-testid="add-goal">Add another goal</button>
      }
      <p class="weight-total" [class.is-off]="total() !== fullWeight" data-testid="weight-total">Weights add up to {{ total() }}%{{ total() === fullWeight ? '' : ', they need to make 100%' }}</p>
      @if (failure()) {
        <p role="alert" data-testid="goals-error">{{ failure() }}</p>
      }
      <div class="modal-actions">
        <button type="button" class="secondary-button" (click)="cancelled.emit()">Cancel</button>
        <button type="submit" class="primary-button" [disabled]="goalsForm().submitting()" data-testid="goals-submit">Save goals</button>
      </div>
    </form>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GoalsForm {
  private readonly api = inject(PerformanceApi);
  readonly employeeId = input.required<string>();
  readonly name = input.required<string>();
  readonly goals = input<readonly Goal[]>([]);
  readonly saved = output();
  readonly cancelled = output();

  protected readonly maxGoals = MAX_GOALS;
  protected readonly fullWeight = FULL_WEIGHT;
  protected readonly failure = signal<string | undefined>(undefined);
  protected readonly draft = linkedSignal<{ goals: GoalPlan[] }>(() => ({
    goals: this.goals().length ? this.goals().map(({ title, measure, weight }) => ({ title, measure, weight })) : [{ title: '', measure: '', weight: FULL_WEIGHT }],
  }));
  protected readonly total = computed(() => this.draft().goals.reduce((sum, { weight }) => sum + Number(weight), 0));
  protected readonly goalsForm = form(this.draft, (path) => {
    applyEach(path.goals, (goal) => {
      required(goal.title, { message: 'Name the goal.' });
      required(goal.measure, { message: 'Say how it will be measured.' });
      min(goal.weight, 1, { message: 'At least 1%.' });
      max(goal.weight, FULL_WEIGHT, { message: 'At most 100%.' });
    });
  });

  protected add() {
    this.draft.update(({ goals }) => ({ goals: [...goals, { title: '', measure: '', weight: 0 }] }));
  }

  protected remove(index: number) {
    this.draft.update(({ goals }) => ({ goals: goals.filter((_, position) => position !== index) }));
  }

  protected save(event: Event) {
    event.preventDefault();
    this.failure.set(undefined);
    return submit(this.goalsForm, async () => {
      if (this.total() !== FULL_WEIGHT) {
        this.failure.set('Goal weights need to add up to 100%.');
        return undefined;
      }
      try {
        await this.api.setGoals(this.employeeId(), this.draft().goals.map(({ title, measure, weight }) => ({ title: title.trim(), measure: measure.trim(), weight: Number(weight) })));
        this.saved.emit();
      } catch (error) {
        console.error('Saving goals failed', error);
        this.failure.set(serverReason(error) ?? FAILED);
      }
      return undefined;
    });
  }
}
