import { ChangeDetectionStrategy, Component, inject, input, linkedSignal, output, signal } from '@angular/core';
import { FormField, form, maxLength, required } from '@angular/forms/signals';
import { Holiday } from '../../../models/company';
import { FieldError } from '../../../shared/ui/field-error';
import { ModalHeading } from '../../../shared/ui/modal-heading';
import { submitForm } from '../../../shared/utils/form-submit';
import { HrApi } from '../hr-api';

const MAX_NAME = 60;

@Component({
  selector: 'app-holiday-form',
  imports: [FieldError, FormField, ModalHeading],
  template: `
    <app-modal-heading eyebrow="HOLIDAY CALENDAR" [heading]="holiday() ? 'Edit holiday' : 'Add a holiday'" intro="Islamic holidays stay tentative until the moon is sighted. Confirming one tells everyone." />
    <form novalidate (submit)="save($event)">
      <label>Name <input [formField]="holidayForm.name" placeholder="Eid al Fitr" data-testid="holiday-name" aria-describedby="holiday-name-error" /></label>
      <app-field-error id="holiday-name-error" [errors]="holidayForm.name().errors()" [isTouched]="holidayForm.name().touched()" />
      <div class="form-row">
        <label>Date <input type="date" [formField]="holidayForm.date" data-testid="holiday-date" aria-describedby="holiday-date-error" /></label>
        <label>
          Date is
          <select [formField]="holidayForm.certainty" data-testid="holiday-certainty">
            <option value="confirmed">Confirmed</option>
            <option value="tentative">Tentative</option>
          </select>
        </label>
      </div>
      <app-field-error id="holiday-date-error" [errors]="holidayForm.date().errors()" [isTouched]="holidayForm.date().touched()" />
      @if (failed()) {
        <p role="alert">That didn't save. Try again in a moment.</p>
      }
      <div class="modal-actions">
        <button type="button" class="secondary-button" (click)="cancelled.emit()">Cancel</button>
        <button type="submit" class="primary-button" [disabled]="holidayForm().submitting()" data-testid="holiday-submit">Save</button>
      </div>
    </form>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HolidayForm {
  private readonly api = inject(HrApi);
  readonly holiday = input<Holiday>();
  readonly saved = output();
  readonly cancelled = output();

  protected readonly failed = signal(false);
  protected readonly draft = linkedSignal(() => ({
    name: this.holiday()?.name ?? '',
    date: this.holiday()?.date ?? '',
    certainty: this.holiday()?.isTentative ? 'tentative' : 'confirmed',
  }));
  protected readonly holidayForm = form(this.draft, (path) => {
    required(path.name, { message: 'Give the holiday a name.' });
    maxLength(path.name, MAX_NAME, { message: `Keep it under ${MAX_NAME} characters.` });
    required(path.date, { message: 'Pick the date.' });
  });

  protected save(event: Event) {
    return submitForm(event, this.holidayForm, this.failed, async () => {
      const { name, date, certainty } = this.draft();
      await this.api.saveHoliday({ ...(this.holiday() && { id: this.holiday()?.id }), name: name.trim(), date, isTentative: certainty === 'tentative' });
      this.saved.emit();
    });
  }
}
