import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { FormField, form, pattern, required, validate } from '@angular/forms/signals';
import { Visa } from '../../../models/employee';
import { FieldError } from '../../../shared/ui/field-error';
import { ModalHeading } from '../../../shared/ui/modal-heading';
import { submitForm } from '../../../shared/utils/form-submit';
import { HrApi } from '../hr-api';

const LAST_FOUR = /^[A-Za-z0-9]{4}$/;

@Component({
  selector: 'app-visa-form',
  imports: [FieldError, FormField, ModalHeading],
  template: `
    <app-modal-heading eyebrow="WORK VISA" [heading]="'Update ' + firstName() + '’s papers'" intro="Use this when a visa or passport is renewed. Expiry warnings update straight away." />
    <form novalidate (submit)="save($event)">
      <div class="form-row">
        <label>Visa number <input [formField]="visaForm.visaNumber" data-testid="visa-number" aria-describedby="visa-number-error" /></label>
        <label>Work permit number <input [formField]="visaForm.workPermitNumber" data-testid="visa-permit" aria-describedby="visa-permit-error" /></label>
      </div>
      <app-field-error id="visa-number-error" [errors]="visaForm.visaNumber().errors()" [isTouched]="visaForm.visaNumber().touched()" />
      <app-field-error id="visa-permit-error" [errors]="visaForm.workPermitNumber().errors()" [isTouched]="visaForm.workPermitNumber().touched()" />
      <div class="form-row">
        <label>Visa issued <input type="date" [formField]="visaForm.visaIssuedOn" data-testid="visa-issued" /></label>
        <label>Visa expires <input type="date" [formField]="visaForm.visaExpiry" data-testid="visa-expiry" aria-describedby="visa-expiry-error" /></label>
      </div>
      <app-field-error id="visa-expiry-error" [errors]="visaForm.visaExpiry().errors()" [isTouched]="visaForm.visaExpiry().touched()" />
      <div class="form-row">
        <label>Passport, last 4 characters <input [formField]="visaForm.passportLast4" data-testid="visa-passport" aria-describedby="visa-passport-error" /></label>
        <label>Passport expires <input type="date" [formField]="visaForm.passportExpiry" data-testid="visa-passport-expiry" /></label>
      </div>
      <app-field-error id="visa-passport-error" [errors]="visaForm.passportLast4().errors()" [isTouched]="visaForm.passportLast4().touched()" />
      <p class="modal-intro">Only the last 4 passport characters are stored. Keep the full copy in the employee's file.</p>
      @if (failed()) {
        <p role="alert">That didn't save. Try again in a moment.</p>
      }
      <div class="modal-actions">
        <button type="button" class="secondary-button" (click)="cancelled.emit()">Cancel</button>
        <button type="submit" class="primary-button" [disabled]="visaForm().submitting()" data-testid="visa-submit">Save</button>
      </div>
    </form>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VisaForm {
  private readonly api = inject(HrApi);
  readonly employeeId = input.required<string>();
  readonly name = input.required<string>();
  readonly visa = input<Visa>();
  readonly saved = output();
  readonly cancelled = output();

  protected readonly firstName = computed(() => this.name().split(' ')[0]);
  protected readonly failed = signal(false);
  protected readonly draft = linkedSignal(() => {
    const visa = this.visa();
    return {
      visaNumber: visa?.visaNumber ?? '',
      workPermitNumber: visa?.workPermitNumber ?? '',
      visaIssuedOn: visa?.visaIssuedOn ?? '',
      visaExpiry: visa?.visaExpiry ?? '',
      passportLast4: visa?.passportLast4 ?? '',
      passportExpiry: visa?.passportExpiry ?? '',
    };
  });
  protected readonly visaForm = form(this.draft, (path) => {
    required(path.visaNumber, { message: 'Enter the visa number.' });
    required(path.workPermitNumber, { message: 'Enter the work permit number.' });
    required(path.visaIssuedOn);
    required(path.visaExpiry, { message: 'Enter when the visa expires.' });
    required(path.passportExpiry);
    required(path.passportLast4, { message: 'Enter the last 4 passport characters.' });
    pattern(path.passportLast4, LAST_FOUR, { message: 'Exactly 4 letters or numbers.' });
    validate(path.visaExpiry, ({ value, valueOf }) =>
      value() && valueOf(path.visaIssuedOn) && value() <= valueOf(path.visaIssuedOn) ? { kind: 'order', message: 'Expiry must come after the issue date.' } : undefined,
    );
  });

  protected save(event: Event) {
    return submitForm(event, this.visaForm, this.failed, async () => {
      await this.api.saveVisa(this.employeeId(), { ...this.draft(), passportLast4: this.draft().passportLast4.toUpperCase() });
      this.saved.emit();
    });
  }
}
