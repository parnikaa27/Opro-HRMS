import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormField, form, maxLength, required, validate } from '@angular/forms/signals';
import { FieldError } from '../../../shared/ui/field-error';
import { ModalHeading } from '../../../shared/ui/modal-heading';
import { maldivesToday } from '../../../shared/utils/date-time';
import { submitForm } from '../../../shared/utils/form-submit';
import { HrApi } from '../hr-api';

const MAX_TEXT = 120;

// One job before Opro. Leave the end empty for a job they held until they joined.
@Component({
  selector: 'app-experience-form',
  imports: [FieldError, FormField, ModalHeading],
  template: `
    <app-modal-heading eyebrow="Work experience" [heading]="'Add to ' + firstName() + '’s experience'" intro="Leave the end empty if they came to Opro straight from this job." />
    <form novalidate (submit)="save($event)">
      <div class="form-row">
        <label>Employer <input [formField]="experienceForm.employer" data-testid="experience-employer" aria-describedby="experience-employer-error" /></label>
        <label>Role <input [formField]="experienceForm.role" data-testid="experience-role" aria-describedby="experience-role-error" /></label>
      </div>
      <app-field-error id="experience-employer-error" [errors]="experienceForm.employer().errors()" [isTouched]="experienceForm.employer().touched()" />
      <app-field-error id="experience-role-error" [errors]="experienceForm.role().errors()" [isTouched]="experienceForm.role().touched()" />
      <div class="form-row">
        <label>From <input type="date" [formField]="experienceForm.from" data-testid="experience-from" aria-describedby="experience-from-error" /></label>
        <label>To <input type="date" [formField]="experienceForm.to" data-testid="experience-to" aria-describedby="experience-to-error" /></label>
      </div>
      <app-field-error id="experience-from-error" [errors]="experienceForm.from().errors()" [isTouched]="experienceForm.from().touched()" />
      <app-field-error id="experience-to-error" [errors]="experienceForm.to().errors()" [isTouched]="experienceForm.to().touched()" />
      @if (failed()) {
        <p role="alert">That didn't save. Try again in a moment.</p>
      }
      <div class="modal-actions">
        <button type="button" class="secondary-button" (click)="cancelled.emit()">Cancel</button>
        <button type="submit" class="primary-button" [disabled]="experienceForm().submitting()" data-testid="experience-submit">Add</button>
      </div>
    </form>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExperienceForm {
  private readonly api = inject(HrApi);
  readonly employeeId = input.required<string>();
  readonly name = input.required<string>();
  readonly saved = output();
  readonly cancelled = output();

  private readonly today = maldivesToday();
  protected readonly firstName = computed(() => this.name().split(' ')[0]);
  protected readonly failed = signal(false);
  protected readonly draft = signal({ employer: '', role: '', from: '', to: '' });
  protected readonly experienceForm = form(this.draft, (path) => {
    required(path.employer, { message: 'Enter the employer.' });
    maxLength(path.employer, MAX_TEXT, { message: `Keep it under ${MAX_TEXT} characters.` });
    required(path.role, { message: 'Enter their role.' });
    maxLength(path.role, MAX_TEXT, { message: `Keep it under ${MAX_TEXT} characters.` });
    required(path.from, { message: 'Enter when they started.' });
    validate(path.from, ({ value }) => (value() && value() > this.today ? { kind: 'future', message: 'Pick a start that has already happened.' } : undefined));
    validate(path.to, ({ value, valueOf }) => (value() && value() < valueOf(path.from) ? { kind: 'order', message: 'The end can’t be before the start.' } : undefined));
  });

  protected save(event: Event) {
    return submitForm(event, this.experienceForm, this.failed, async () => {
      const { employer, role, from, to } = this.draft();
      await this.api.addExperience(this.employeeId(), { employer: employer.trim(), role: role.trim(), from, ...(to && { to }) });
      this.saved.emit();
    });
  }
}
