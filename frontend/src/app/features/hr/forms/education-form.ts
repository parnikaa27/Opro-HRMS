import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormField, form, max, maxLength, min, required } from '@angular/forms/signals';
import { FieldError } from '../../../shared/ui/field-error';
import { ModalHeading } from '../../../shared/ui/modal-heading';
import { maldivesToday, yearOf } from '../../../shared/utils/date-time';
import { submitForm } from '../../../shared/utils/form-submit';
import { HrApi } from '../hr-api';

const MAX_TEXT = 120;
const FIRST_YEAR = 1950;

// One qualification on someone's record.
@Component({
  selector: 'app-education-form',
  imports: [FieldError, FormField, ModalHeading],
  template: `
    <app-modal-heading eyebrow="EDUCATION" [heading]="'Add to ' + firstName() + '’s education'" intro="Keep a copy of the certificate in their documents." />
    <form novalidate (submit)="save($event)">
      <label>Qualification <input [formField]="educationForm.qualification" placeholder="BCom, Accounting" data-testid="education-qualification" aria-describedby="education-qualification-error" /></label>
      <app-field-error id="education-qualification-error" [errors]="educationForm.qualification().errors()" [isTouched]="educationForm.qualification().touched()" />
      <div class="form-row">
        <label>Institution <input [formField]="educationForm.institution" data-testid="education-institution" aria-describedby="education-institution-error" /></label>
        <label>Year completed <input type="number" [formField]="educationForm.completedYear" data-testid="education-year" aria-describedby="education-year-error" /></label>
      </div>
      <app-field-error id="education-institution-error" [errors]="educationForm.institution().errors()" [isTouched]="educationForm.institution().touched()" />
      <app-field-error id="education-year-error" [errors]="educationForm.completedYear().errors()" [isTouched]="educationForm.completedYear().touched()" />
      @if (failed()) {
        <p role="alert">That didn't save. Try again in a moment.</p>
      }
      <div class="modal-actions">
        <button type="button" class="secondary-button" (click)="cancelled.emit()">Cancel</button>
        <button type="submit" class="primary-button" [disabled]="educationForm().submitting()" data-testid="education-submit">Add</button>
      </div>
    </form>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EducationForm {
  private readonly api = inject(HrApi);
  readonly employeeId = input.required<string>();
  readonly name = input.required<string>();
  readonly saved = output();
  readonly cancelled = output();

  private readonly thisYear = yearOf(maldivesToday());
  protected readonly firstName = computed(() => this.name().split(' ')[0]);
  protected readonly failed = signal(false);
  protected readonly draft = signal({ qualification: '', institution: '', completedYear: this.thisYear });
  protected readonly educationForm = form(this.draft, (path) => {
    required(path.qualification, { message: 'Enter the qualification.' });
    maxLength(path.qualification, MAX_TEXT, { message: `Keep it under ${MAX_TEXT} characters.` });
    required(path.institution, { message: 'Enter where they studied.' });
    maxLength(path.institution, MAX_TEXT, { message: `Keep it under ${MAX_TEXT} characters.` });
    min(path.completedYear, FIRST_YEAR, { message: `Pick a year from ${FIRST_YEAR}.` });
    max(path.completedYear, this.thisYear, { message: 'Pick a year that has already happened.' });
  });

  protected save(event: Event) {
    return submitForm(event, this.educationForm, this.failed, async () => {
      const { qualification, institution, completedYear } = this.draft();
      await this.api.addEducation(this.employeeId(), { qualification: qualification.trim(), institution: institution.trim(), completedYear });
      this.saved.emit();
    });
  }
}
