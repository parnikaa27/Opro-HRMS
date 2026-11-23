import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormField, form, max, maxLength, min, required, submit } from '@angular/forms/signals';
import { OnboardingTask, TaskOwner } from '../../models/onboarding';
import { ConfirmButton } from '../../shared/ui/confirm-button';
import { FieldError } from '../../shared/ui/field-error';
import { ListSkeleton } from '../../shared/ui/list-skeleton';
import { serverReason } from '../../shared/utils/form-submit';
import { valueOr } from '../../shared/utils/resource';
import { describeDue, OnboardingApi, OWNERS } from './onboarding-api';

const MAX_NAME = 120;
const MAX_DAYS = 90;

// HR's onboarding task list, in Policies. Every new joiner gets a copy; changes don't touch people already onboarding.
@Component({
  selector: 'app-onboarding-tasks-card',
  imports: [ConfirmButton, FieldError, FormField, ListSkeleton],
  template: `
    <section class="card request-history" data-testid="onboarding-tasks">
      <div class="card-heading"><div><span class="eyebrow">New joiners</span><h2>Onboarding tasks</h2></div></div>
      @if (tasks.error()) {
        <p class="attendance-off">The list didn't load. Refresh the page to try again.</p>
      } @else if (tasks.isLoading() && list().length === 0) {
        <app-list-skeleton [count]="3" />
      } @else {
        @for (task of list(); track task.id) {
          <div class="history-row exit-row" data-testid="onboarding-task-row">
            <div><strong>{{ task.name }}</strong><span>{{ owners[task.owner] }} · {{ describeDue(task.dueInDays) }}</span></div>
            <span></span>
            <span class="row-actions">
              <app-confirm-button label="Remove" [question]="'Remove “' + task.name + '”?'" yes="Yes, remove it" testId="remove-onboarding-task" (confirmed)="remove(task)" />
            </span>
          </div>
        } @empty {
          <p class="attendance-off">No onboarding tasks. Add what HR, the HOD and the joiner each do in the first weeks.</p>
        }
        <form novalidate (submit)="add($event)">
          <div class="form-row">
            <label>Task <input [formField]="taskForm.name" placeholder="Meet the director" data-testid="onboarding-task-name" aria-describedby="onboarding-task-name-error" /></label>
            <label>
              Who does it
              <select [formField]="taskForm.owner" data-testid="onboarding-task-owner">
                <option value="hr">HR</option>
                <option value="hod">The HOD</option>
                <option value="joiner">The joiner</option>
              </select>
            </label>
            <label>Due (days from joining) <input type="number" step="1" [formField]="taskForm.days" data-testid="onboarding-task-days" aria-describedby="onboarding-task-days-error" /></label>
          </div>
          <app-field-error id="onboarding-task-name-error" [errors]="taskForm.name().errors()" [isTouched]="taskForm.name().touched()" />
          <app-field-error id="onboarding-task-days-error" [errors]="taskForm.days().errors()" [isTouched]="taskForm.days().touched()" />
          <button type="submit" class="secondary-button" [disabled]="taskForm().submitting()" data-testid="add-onboarding-task">Add task</button>
        </form>
        @if (failure()) {
          <p class="row-error" role="alert">{{ failure() }}</p>
        }
        <p class="table-note">A negative number is before joining. Changes apply to people added from now on.</p>
      }
    </section>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnboardingTasksCard {
  private readonly api = inject(OnboardingApi);
  protected readonly tasks = this.api.tasks();
  protected readonly list = computed(() => valueOr(this.tasks, []));
  protected readonly owners = OWNERS;
  protected readonly describeDue = describeDue;
  protected readonly failure = signal<string | undefined>(undefined);
  protected readonly draft = signal({ name: '', owner: 'hr' as TaskOwner, days: 0 });
  protected readonly taskForm = form(this.draft, (path) => {
    required(path.name, { message: 'Name the task.' });
    maxLength(path.name, MAX_NAME, { message: `Keep it under ${MAX_NAME} characters.` });
    min(path.days, -MAX_DAYS, { message: `Keep it within ${MAX_DAYS} days of joining.` });
    max(path.days, MAX_DAYS, { message: `Keep it within ${MAX_DAYS} days of joining.` });
  });

  protected add(event: Event) {
    event.preventDefault();
    this.failure.set(undefined);
    return submit(this.taskForm, async () => {
      const { name, owner, days } = this.draft();
      try {
        await this.api.addTask({ name: name.trim(), owner, dueInDays: Math.round(Number(days)) });
        this.draft.set({ name: '', owner: 'hr', days: 0 });
        this.taskForm().reset();
        this.tasks.reload();
      } catch (error) {
        console.error('Adding an onboarding task failed', error);
        this.failure.set(serverReason(error) ?? "That didn't save. Try again in a moment.");
      }
      return undefined;
    });
  }

  protected async remove({ id }: OnboardingTask) {
    this.failure.set(undefined);
    try {
      await this.api.removeTask(id);
      this.tasks.reload();
    } catch (error) {
      console.error('Removing an onboarding task failed', error);
      this.failure.set("That didn't remove. Try again in a moment.");
    }
  }
}
