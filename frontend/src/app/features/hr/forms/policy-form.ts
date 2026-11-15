import { ChangeDetectionStrategy, Component, inject, input, linkedSignal, output, signal } from '@angular/core';
import { FormField, form, max, min, required } from '@angular/forms/signals';
import { LeaveType } from '../../../models/leave';
import { FieldError } from '../../../shared/ui/field-error';
import { ModalHeading } from '../../../shared/ui/modal-heading';
import { submitForm } from '../../../shared/utils/form-submit';
import { HrApi } from '../hr-api';

const MAX_DAYS = 365;

@Component({
  selector: 'app-policy-form',
  imports: [FieldError, FormField, ModalHeading],
  template: `
    <app-modal-heading eyebrow="LEAVE POLICY" [heading]="'Edit ' + type().name.toLowerCase()" intro="New entitlements apply from the next leave year. Today's balances stay as they are." />
    <form novalidate (submit)="save($event)">
      <label>Name <input [formField]="policyForm.name" data-testid="policy-name" aria-describedby="policy-name-error" /></label>
      <app-field-error id="policy-name-error" [errors]="policyForm.name().errors()" [isTouched]="policyForm.name().touched()" />
      <div class="form-row">
        @if (!type().isUnlimited) {
          <label>Days per year <input type="number" step="0.5" [formField]="policyForm.days" data-testid="policy-days" aria-describedby="policy-days-error" /></label>
        }
        <label>
          Half days
          <select [formField]="policyForm.halfDays" data-testid="policy-half">
            <option value="yes">Allowed</option>
            <option value="no">Not allowed</option>
          </select>
        </label>
      </div>
      <app-field-error id="policy-days-error" [errors]="policyForm.days().errors()" [isTouched]="policyForm.days().touched()" />
      @if (failed()) {
        <p role="alert">That didn't save. Try again in a moment.</p>
      }
      <div class="modal-actions">
        <button type="button" class="secondary-button" (click)="cancelled.emit()">Cancel</button>
        <button type="submit" class="primary-button" [disabled]="policyForm().submitting()" data-testid="policy-submit">Save</button>
      </div>
    </form>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PolicyForm {
  private readonly api = inject(HrApi);
  readonly type = input.required<LeaveType>();
  readonly saved = output();
  readonly cancelled = output();

  protected readonly failed = signal(false);
  protected readonly draft = linkedSignal(() => ({
    name: this.type().name,
    days: this.type().defaultEntitlement ?? 0,
    halfDays: this.type().allowsHalfDay ? 'yes' : 'no',
  }));
  protected readonly policyForm = form(this.draft, (path) => {
    required(path.name, { message: 'Give the leave type a name.' });
    min(path.days, 0, { message: 'Days can’t be negative.' });
    max(path.days, MAX_DAYS, { message: `That's more than a year.` });
  });

  protected save(event: Event) {
    return submitForm(event, this.policyForm, this.failed, async () => {
      const { name, days, halfDays } = this.draft();
      await this.api.updateLeaveType(this.type().code, {
        name: name.trim(),
        allowsHalfDay: halfDays === 'yes',
        ...(!this.type().isUnlimited && { defaultEntitlement: days }),
      });
      this.saved.emit();
    });
  }
}
