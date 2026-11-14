import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { FormField, form, maxLength, required, validate } from '@angular/forms/signals';
import { LeaveType } from '../../../models/leave';
import { FieldError } from '../../../shared/ui/field-error';
import { Icon } from '../../../shared/ui/icon';
import { ModalHeading } from '../../../shared/ui/modal-heading';
import { submitForm } from '../../../shared/utils/form-submit';
import { plural } from '../../../shared/utils/text';
import { countLeaveDays } from '../../leave/leave-days';
import { HrApi } from '../hr-api';

const MAX_REASON = 300;
// Most leave HR records for someone else is sick leave.
const LIKELY_TYPE = 'sick';

@Component({
  selector: 'app-record-leave-form',
  imports: [FieldError, FormField, Icon, ModalHeading],
  template: `
    <app-modal-heading eyebrow="ON THEIR BEHALF" [heading]="'Record leave for ' + firstName()" intro="For when someone can't apply themselves. It's saved as approved." />
    <form novalidate (submit)="save($event)">
      <label>
        Leave type
        <select [formField]="leaveForm.type" data-testid="record-type">
          @for (type of types(); track type.code) {
            <option [value]="type.code" [selected]="type.code === draft().type">{{ type.name }}</option>
          }
        </select>
      </label>
      <div class="form-row">
        <label>From <input type="date" [formField]="leaveForm.from" data-testid="record-from" aria-describedby="record-from-error" /></label>
        <label>To <input type="date" [formField]="leaveForm.to" [min]="draft().from" data-testid="record-to" aria-describedby="record-to-error" /></label>
      </div>
      <app-field-error id="record-from-error" [errors]="leaveForm.from().errors()" [isTouched]="leaveForm.from().touched()" />
      <app-field-error id="record-to-error" [errors]="leaveForm.to().errors()" [isTouched]="leaveForm.to().touched()" />
      <label>
        Reason
        <textarea [formField]="leaveForm.reason" placeholder="Called in sick, hospital admission" data-testid="record-reason" aria-describedby="record-reason-error"></textarea>
      </label>
      <app-field-error id="record-reason-error" [errors]="leaveForm.reason().errors()" [isTouched]="leaveForm.reason().touched()" />
      <div class="form-summary" aria-live="polite" data-testid="record-preview">
        <app-icon name="calendar" [size]="19" />
        <div>
          <strong>{{ days() > 0 ? plural(days(), 'working day') : 'Pick the dates' }}</strong>
          <span>Weekends and public holidays don't count.</span>
        </div>
      </div>
      @if (failed()) {
        <p role="alert">That didn't save. Try again in a moment.</p>
      }
      <div class="modal-actions">
        <button type="button" class="secondary-button" (click)="cancelled.emit()">Cancel</button>
        <button type="submit" class="primary-button" [disabled]="leaveForm().submitting()" data-testid="record-submit">Record leave</button>
      </div>
    </form>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecordLeaveForm {
  private readonly api = inject(HrApi);
  readonly employeeId = input.required<string>();
  readonly name = input.required<string>();
  readonly types = input.required<readonly LeaveType[]>();
  readonly holidays = input.required<ReadonlySet<string>>();
  readonly saved = output();
  readonly cancelled = output();

  protected readonly firstName = computed(() => this.name().split(' ')[0]);
  protected readonly failed = signal(false);
  protected readonly draft = linkedSignal(() => ({
    type: this.types().some(({ code }) => code === LIKELY_TYPE) ? LIKELY_TYPE : (this.types()[0]?.code ?? ''),
    from: '',
    to: '',
    reason: '',
  }));
  protected readonly days = computed(() => countLeaveDays({ ...this.draft(), isHalfDay: false }, this.holidays()));
  protected readonly leaveForm = form(this.draft, (path) => {
    required(path.from, { message: 'Pick the first day.' });
    required(path.to, { message: 'Pick the last day.' });
    required(path.reason, { message: 'Add a short reason for the record.' });
    maxLength(path.reason, MAX_REASON, { message: `Keep it under ${MAX_REASON} characters.` });
    validate(path.to, ({ value, valueOf }) => {
      const from = valueOf(path.from);
      if (!value() || !from) {
        return undefined;
      }
      return value() < from ? { kind: 'order', message: "The last day can't be before the first." } : this.days() === 0 ? { kind: 'none', message: 'Those dates are all weekends or holidays.' } : undefined;
    });
  });
  protected readonly plural = plural;

  protected save(event: Event) {
    return submitForm(event, this.leaveForm, this.failed, async () => {
      const { type, from, to, reason } = this.draft();
      await this.api.recordLeave({ employeeId: this.employeeId(), type, from, to, days: this.days(), reason: reason.trim() });
      this.saved.emit();
    });
  }
}
