import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormField, form, maxLength, required, validate } from '@angular/forms/signals';
import { LeaveType } from '../../../models/leave';
import { FieldError } from '../../../shared/ui/field-error';
import { ModalHeading } from '../../../shared/ui/modal-heading';
import { submitForm } from '../../../shared/utils/form-submit';
import { HrApi } from '../hr-api';

const MAX_REASON = 300;

@Component({
  selector: 'app-adjust-balance-form',
  imports: [FieldError, FormField, ModalHeading],
  template: `
    <app-modal-heading eyebrow="LEAVE BALANCE" [heading]="'Adjust ' + firstName() + '’s balance'" intro="Every change is logged with your name and reason, and shows on their page." />
    <form novalidate (submit)="save($event)">
      <div class="form-row">
        <label>
          Leave type
          <select [formField]="adjustForm.type" data-testid="adjust-type">
            @for (type of capped(); track type.code) {
              <option [value]="type.code" [selected]="type.code === draft().type">{{ type.name }}</option>
            }
          </select>
        </label>
        <label>
          Days to add (negative to remove)
          <input type="number" step="0.5" [formField]="adjustForm.days" data-testid="adjust-days" aria-describedby="adjust-days-error" />
        </label>
      </div>
      <app-field-error id="adjust-days-error" [errors]="adjustForm.days().errors()" [isTouched]="adjustForm.days().touched()" />
      <label>
        Reason
        <textarea [formField]="adjustForm.reason" placeholder="Carried forward from last year, approved by the director" data-testid="adjust-reason" aria-describedby="adjust-reason-error"></textarea>
      </label>
      <app-field-error id="adjust-reason-error" [errors]="adjustForm.reason().errors()" [isTouched]="adjustForm.reason().touched()" />
      @if (failed()) {
        <p role="alert">That didn't save. Try again in a moment.</p>
      }
      <div class="modal-actions">
        <button type="button" class="secondary-button" (click)="cancelled.emit()">Cancel</button>
        <button type="submit" class="primary-button" [disabled]="adjustForm().submitting()" data-testid="adjust-submit">Save adjustment</button>
      </div>
    </form>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdjustBalanceForm {
  private readonly api = inject(HrApi);
  readonly employeeId = input.required<string>();
  readonly name = input.required<string>();
  readonly types = input.required<readonly LeaveType[]>();
  readonly saved = output();
  readonly cancelled = output();

  protected readonly firstName = computed(() => this.name().split(' ')[0]);
  protected readonly capped = computed(() => this.types().filter(({ isUnlimited }) => !isUnlimited));
  protected readonly failed = signal(false);
  protected readonly draft = signal({ type: 'annual', days: 0, reason: '' });
  protected readonly adjustForm = form(this.draft, (path) => {
    required(path.type);
    validate(path.days, ({ value }) => (value() === 0 || !Number.isFinite(value()) ? { kind: 'zero', message: 'Enter how many days to add or remove.' } : undefined));
    required(path.reason, { message: 'Say why, so the change makes sense later.' });
    maxLength(path.reason, MAX_REASON, { message: `Keep it under ${MAX_REASON} characters.` });
  });

  protected save(event: Event) {
    return submitForm(event, this.adjustForm, this.failed, async () => {
      const { type, days, reason } = this.draft();
      await this.api.adjustBalance({ employeeId: this.employeeId(), type, days, reason: reason.trim() });
      this.saved.emit();
    });
  }
}
