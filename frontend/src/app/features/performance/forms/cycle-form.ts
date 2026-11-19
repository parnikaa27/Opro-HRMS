import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { FormField, form, required, submit } from '@angular/forms/signals';
import { FieldError } from '../../../shared/ui/field-error';
import { serverReason } from '../../../shared/utils/form-submit';
import { PerformanceApi } from '../performance-api';

const FAILED = "That didn't save. Try again in a moment.";

// HR opens a cycle for everyone. Every HOD is told to set goals and appraise their team.
@Component({
  selector: 'app-cycle-form',
  imports: [FieldError, FormField],
  template: `
    <form novalidate class="inline-form" (submit)="save($event)">
      <label>Name <input [formField]="cycleForm.name" placeholder="2026 appraisals" data-testid="cycle-name" aria-describedby="cycle-name-error" /></label>
      <label>Due on <input type="date" [formField]="cycleForm.dueOn" data-testid="cycle-due" aria-describedby="cycle-due-error" /></label>
      <button type="submit" class="primary-button compact" [disabled]="cycleForm().submitting()" data-testid="cycle-submit">Open cycle</button>
    </form>
    <app-field-error id="cycle-name-error" [errors]="cycleForm.name().errors()" [isTouched]="cycleForm.name().touched()" />
    <app-field-error id="cycle-due-error" [errors]="cycleForm.dueOn().errors()" [isTouched]="cycleForm.dueOn().touched()" />
    @if (failure()) {
      <p role="alert" data-testid="cycle-error">{{ failure() }}</p>
    }
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CycleForm {
  private readonly api = inject(PerformanceApi);
  readonly opened = output();

  protected readonly failure = signal<string | undefined>(undefined);
  protected readonly draft = signal({ name: '', dueOn: '' });
  protected readonly cycleForm = form(this.draft, (path) => {
    required(path.name, { message: 'Name the cycle.' });
    required(path.dueOn, { message: 'Pick when appraisals are due.' });
  });

  protected save(event: Event) {
    event.preventDefault();
    this.failure.set(undefined);
    return submit(this.cycleForm, async () => {
      try {
        await this.api.openCycle({ name: this.draft().name.trim(), dueOn: this.draft().dueOn });
        this.draft.set({ name: '', dueOn: '' });
        this.opened.emit();
      } catch (error) {
        console.error('Opening a cycle failed', error);
        this.failure.set(serverReason(error) ?? FAILED);
      }
      return undefined;
    });
  }
}
