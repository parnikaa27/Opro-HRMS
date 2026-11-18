import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { FormField, form, maxLength, required } from '@angular/forms/signals';
import { MedicalInsurance } from '../../../models/record';
import { FieldError } from '../../../shared/ui/field-error';
import { ModalHeading } from '../../../shared/ui/modal-heading';
import { submitForm } from '../../../shared/utils/form-submit';
import { HrApi } from '../hr-api';

const MAX_TEXT = 80;

// Someone's medical insurance. Reminders follow its expiry.
@Component({
  selector: 'app-insurance-form',
  imports: [FieldError, FormField, ModalHeading],
  template: `
    <app-modal-heading eyebrow="MEDICAL INSURANCE" [heading]="firstName() + '’s insurance'" intro="They're told, and reminded before it runs out." />
    <form novalidate (submit)="save($event)">
      <div class="form-row">
        <label>Provider <input [formField]="insuranceForm.provider" placeholder="Allied Insurance" data-testid="insurance-provider" aria-describedby="insurance-provider-error" /></label>
        <label>Policy number <input [formField]="insuranceForm.policyNumber" data-testid="insurance-policy" aria-describedby="insurance-policy-error" /></label>
      </div>
      <app-field-error id="insurance-provider-error" [errors]="insuranceForm.provider().errors()" [isTouched]="insuranceForm.provider().touched()" />
      <app-field-error id="insurance-policy-error" [errors]="insuranceForm.policyNumber().errors()" [isTouched]="insuranceForm.policyNumber().touched()" />
      <label>Expires on <input type="date" [formField]="insuranceForm.expiresOn" data-testid="insurance-expiry" aria-describedby="insurance-expiry-error" /></label>
      <app-field-error id="insurance-expiry-error" [errors]="insuranceForm.expiresOn().errors()" [isTouched]="insuranceForm.expiresOn().touched()" />
      @if (failed()) {
        <p role="alert">That didn't save. Try again in a moment.</p>
      }
      <div class="modal-actions">
        <button type="button" class="secondary-button" (click)="cancelled.emit()">Cancel</button>
        <button type="submit" class="primary-button" [disabled]="insuranceForm().submitting()" data-testid="insurance-submit">Save</button>
      </div>
    </form>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InsuranceForm {
  private readonly api = inject(HrApi);
  readonly employeeId = input.required<string>();
  readonly name = input.required<string>();
  readonly insurance = input<MedicalInsurance>();
  readonly saved = output();
  readonly cancelled = output();

  protected readonly firstName = computed(() => this.name().split(' ')[0]);
  protected readonly failed = signal(false);
  protected readonly draft = linkedSignal(() => ({
    provider: this.insurance()?.provider ?? '',
    policyNumber: this.insurance()?.policyNumber ?? '',
    expiresOn: this.insurance()?.expiresOn ?? '',
  }));
  protected readonly insuranceForm = form(this.draft, (path) => {
    required(path.provider, { message: 'Enter the provider.' });
    maxLength(path.provider, MAX_TEXT, { message: `Keep it under ${MAX_TEXT} characters.` });
    required(path.policyNumber, { message: 'Enter the policy number.' });
    required(path.expiresOn, { message: 'Enter when it expires.' });
  });

  protected save(event: Event) {
    return submitForm(event, this.insuranceForm, this.failed, async () => {
      const { provider, policyNumber, expiresOn } = this.draft();
      await this.api.saveInsurance(this.employeeId(), { provider: provider.trim(), policyNumber: policyNumber.trim(), expiresOn });
      this.saved.emit();
    });
  }
}
