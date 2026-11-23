import { ChangeDetectionStrategy, Component, inject, input, linkedSignal, output, signal } from '@angular/core';
import { FormField, form, maxLength, min, required, submit, validate } from '@angular/forms/signals';
import { Quota } from '../../../models/record';
import { FieldError } from '../../../shared/ui/field-error';
import { ModalHeading } from '../../../shared/ui/modal-heading';
import { serverReason } from '../../../shared/utils/form-submit';
import { HrApi } from '../hr-api';

const MAX_TEXT = 80;
const FAILED = "That didn't save. Try again in a moment.";

// One quota approval from the Ministry. Leave the quota out to add one.
@Component({
  selector: 'app-quota-form',
  imports: [FieldError, FormField, ModalHeading],
  template: `
    <app-modal-heading eyebrow="Expatriate quota" [heading]="quota() ? 'Edit the ' + quota()?.jobCategory + ' quota' : 'Add a quota approval'" intro="Slots in use are counted from active expatriates with this job category on their record." />
    <form novalidate (submit)="save($event)">
      <div class="form-row">
        <label>Job category <input [formField]="quotaForm.jobCategory" list="quota-categories" placeholder="Engineering" data-testid="quota-category" aria-describedby="quota-category-error" /></label>
        <label>Slots <input type="number" [formField]="quotaForm.slots" data-testid="quota-slots" aria-describedby="quota-slots-error" /></label>
      </div>
      <datalist id="quota-categories">
        @for (category of categories(); track category) {
          <option [value]="category"></option>
        }
      </datalist>
      <app-field-error id="quota-category-error" [errors]="quotaForm.jobCategory().errors()" [isTouched]="quotaForm.jobCategory().touched()" />
      <app-field-error id="quota-slots-error" [errors]="quotaForm.slots().errors()" [isTouched]="quotaForm.slots().touched()" />
      <label>Approval number <input [formField]="quotaForm.approvalNumber" data-testid="quota-number" aria-describedby="quota-number-error" /></label>
      <app-field-error id="quota-number-error" [errors]="quotaForm.approvalNumber().errors()" [isTouched]="quotaForm.approvalNumber().touched()" />
      <div class="form-row">
        <label>Approved on <input type="date" [formField]="quotaForm.approvedOn" data-testid="quota-approved" aria-describedby="quota-approved-error" /></label>
        <label>Expires on <input type="date" [formField]="quotaForm.expiresOn" data-testid="quota-expiry" aria-describedby="quota-expiry-error" /></label>
      </div>
      <app-field-error id="quota-approved-error" [errors]="quotaForm.approvedOn().errors()" [isTouched]="quotaForm.approvedOn().touched()" />
      <app-field-error id="quota-expiry-error" [errors]="quotaForm.expiresOn().errors()" [isTouched]="quotaForm.expiresOn().touched()" />
      @if (failure()) {
        <p role="alert" data-testid="quota-error">{{ failure() }}</p>
      }
      <div class="modal-actions">
        <button type="button" class="secondary-button" (click)="cancelled.emit()">Cancel</button>
        <button type="submit" class="primary-button" [disabled]="quotaForm().submitting()" data-testid="quota-submit">{{ quota() ? 'Save' : 'Add quota' }}</button>
      </div>
    </form>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuotaForm {
  private readonly api = inject(HrApi);
  readonly quota = input<Quota>();
  // Job categories already on people's records, offered as suggestions.
  readonly categories = input<readonly string[]>([]);
  readonly saved = output();
  readonly cancelled = output();

  protected readonly failure = signal<string | undefined>(undefined);
  protected readonly draft = linkedSignal(() => ({
    jobCategory: this.quota()?.jobCategory ?? '',
    slots: this.quota()?.slots ?? 1,
    approvalNumber: this.quota()?.approvalNumber ?? '',
    approvedOn: this.quota()?.approvedOn ?? '',
    expiresOn: this.quota()?.expiresOn ?? '',
  }));
  protected readonly quotaForm = form(this.draft, (path) => {
    required(path.jobCategory, { message: 'Enter the job category.' });
    maxLength(path.jobCategory, MAX_TEXT, { message: `Keep it under ${MAX_TEXT} characters.` });
    min(path.slots, 1, { message: 'At least 1 slot.' });
    required(path.approvalNumber, { message: 'Enter the approval number.' });
    required(path.approvedOn, { message: 'Enter when it was approved.' });
    required(path.expiresOn, { message: 'Enter when it expires.' });
    validate(path.expiresOn, ({ value, valueOf }) =>
      value() && valueOf(path.approvedOn) && value() <= valueOf(path.approvedOn) ? { kind: 'order', message: 'It expires after it was approved.' } : undefined,
    );
  });

  protected save(event: Event) {
    event.preventDefault();
    this.failure.set(undefined);
    return submit(this.quotaForm, async () => {
      const { jobCategory, slots, approvalNumber, approvedOn, expiresOn } = this.draft();
      try {
        await this.api.saveQuota({ id: this.quota()?.id, jobCategory: jobCategory.trim(), slots, approvalNumber: approvalNumber.trim(), approvedOn, expiresOn });
        this.saved.emit();
      } catch (error) {
        console.error('Saving a quota failed', error);
        this.failure.set(serverReason(error) ?? FAILED);
      }
      return undefined;
    });
  }
}
