import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormField, form, hidden, maxLength, required, submit, validate } from '@angular/forms/signals';
import { LeaveBalance, LeaveType } from '../../models/leave';
import { FieldError } from '../../shared/ui/field-error';
import { Icon } from '../../shared/ui/icon';
import { ModalHeading } from '../../shared/ui/modal-heading';
import { plural } from '../../shared/utils/text';
import { LeaveApi } from './leave-api';
import { countLeaveDays } from './leave-days';

const MAX_REASON = 300;

interface LeaveDraft {
  type: string;
  from: string;
  to: string;
  halfDay: '' | 'first' | 'second';
  reason: string;
}

@Component({
  selector: 'app-leave-form',
  imports: [FormField, FieldError, Icon, ModalHeading],
  template: `
    <app-modal-heading eyebrow="TIME OFF" heading="Request leave" intro="Submit your leave dates for manager approval." />
    <form novalidate (submit)="save($event)">
      <label>
        Leave type
        <select [formField]="leaveForm.type" data-testid="leave-type" [attr.aria-invalid]="leaveForm.type().touched() && leaveForm.type().invalid()" aria-describedby="leave-type-error">
          @for (type of offeredTypes(); track type.code) {
            <option [value]="type.code">{{ type.name }}</option>
          }
        </select>
      </label>
      <app-field-error id="leave-type-error" [errors]="leaveForm.type().errors()" [isTouched]="leaveForm.type().touched()" />

      <div class="form-row">
        <label>
          From
          <input type="date" [formField]="leaveForm.from" data-testid="leave-from" [attr.aria-invalid]="leaveForm.from().touched() && leaveForm.from().invalid()" aria-describedby="leave-from-error" />
        </label>
        <label>
          To
          <input type="date" [formField]="leaveForm.to" [min]="draft().from" data-testid="leave-to" [attr.aria-invalid]="leaveForm.to().touched() && leaveForm.to().invalid()" aria-describedby="leave-to-error" />
        </label>
      </div>
      <app-field-error id="leave-from-error" [errors]="leaveForm.from().errors()" [isTouched]="leaveForm.from().touched()" />
      <app-field-error id="leave-to-error" [errors]="leaveForm.to().errors()" [isTouched]="leaveForm.to().touched()" />

      @if (!leaveForm.halfDay().hidden()) {
        <label>
          How much of the day?
          <select [formField]="leaveForm.halfDay" data-testid="leave-half">
            <option value="">The whole day</option>
            <option value="first">Morning only</option>
            <option value="second">Afternoon only</option>
          </select>
        </label>
      }

      <label>
        Reason
        <textarea [formField]="leaveForm.reason" placeholder="Add a short note for your manager…" data-testid="leave-reason" [attr.aria-invalid]="leaveForm.reason().touched() && leaveForm.reason().invalid()" aria-describedby="leave-reason-error"></textarea>
      </label>
      <app-field-error id="leave-reason-error" [errors]="leaveForm.reason().errors()" [isTouched]="leaveForm.reason().touched()" />

      <div class="form-summary" aria-live="polite" data-testid="leave-preview">
        <app-icon name="calendar" [size]="19" />
        <div>
          <strong>{{ days() > 0 ? plural(days(), 'day') + ' requested' : 'Pick your dates' }}</strong>
          <span>{{ summaryLine() }}</span>
        </div>
      </div>
      @if (needsCertificate()) {
        <p class="modal-intro">Sick leave longer than {{ plural(selectedType()?.documentRequiredAfterDays ?? 0, 'day') }} needs a medical certificate. Hand it to HR when you're back.</p>
      }

      @if (submitFailed()) {
        <p role="alert">That didn't go through. Check your connection and try again.</p>
      }

      <div class="modal-actions">
        <button type="button" class="secondary-button" (click)="cancelled.emit()">Cancel</button>
        <button type="submit" class="primary-button" [disabled]="leaveForm().submitting()" data-testid="leave-submit">
          {{ leaveForm().submitting() ? 'Sending…' : 'Submit request' }} <app-icon name="arrow" [size]="16" />
        </button>
      </div>
    </form>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeaveForm {
  private readonly api = inject(LeaveApi);

  readonly types = input.required<readonly LeaveType[]>();
  readonly balances = input.required<readonly LeaveBalance[]>();
  readonly holidays = input.required<ReadonlySet<string>>();
  readonly applied = output();
  readonly cancelled = output();

  protected readonly draft = signal<LeaveDraft>({ type: 'annual', from: '', to: '', halfDay: '', reason: '' });
  protected readonly submitFailed = signal(false);

  // Only types this person has a balance for, plus uncapped ones like unpaid leave.
  protected readonly offeredTypes = computed(() =>
    this.types().filter((type) => type.isUnlimited || this.balances().some((balance) => balance.type === type.code)),
  );
  protected readonly selectedType = computed(() => this.types().find((type) => type.code === this.draft().type));
  private readonly isSingleDay = computed(() => this.draft().from !== '' && this.draft().from === this.draft().to);
  private readonly canHalfDay = computed(() => this.isSingleDay() && !!this.selectedType()?.allowsHalfDay);
  private readonly isHalfDay = computed(() => this.canHalfDay() && this.draft().halfDay !== '');

  protected readonly days = computed(() => countLeaveDays({ ...this.draft(), isHalfDay: this.isHalfDay() }, this.holidays()));

  // Undefined means there is no cap. Only uncapped types reach the form without a balance.
  protected readonly available = computed(() => {
    const balance = this.balances().find((entry) => entry.type === this.draft().type);
    return balance ? balance.entitled - balance.taken - balance.pending : undefined;
  });
  protected readonly summaryLine = computed(() => {
    const available = this.available();
    if (this.days() === 0) {
      return 'Weekends and public holidays don’t count.';
    }
    return available === undefined ? 'Unpaid, so it doesn’t use a balance.' : `${plural(available - this.days(), 'day')} will remain after approval`;
  });
  protected readonly needsCertificate = computed(() => {
    const limit = this.selectedType()?.documentRequiredAfterDays;
    return limit !== undefined && this.days() > limit;
  });

  protected readonly leaveForm = form(this.draft, (path) => {
    required(path.type, { message: 'Pick a type of leave.' });
    required(path.from, { message: 'Pick your first day.' });
    required(path.to, { message: 'Pick your last day.' });
    required(path.reason, { message: 'Add a short reason for your manager.' });
    maxLength(path.reason, MAX_REASON, { message: `Keep it under ${MAX_REASON} characters.` });
    hidden(path.halfDay, () => !this.canHalfDay());
    validate(path.to, ({ value, valueOf }) => {
      const from = valueOf(path.from);
      if (!value() || !from) {
        return undefined;
      }
      if (value() < from) {
        return { kind: 'order', message: "The last day can't be before the first." };
      }
      return this.days() === 0 ? { kind: 'no-working-days', message: 'Those dates are all weekends or holidays. Nothing to take.' } : undefined;
    });
    validate(path.type, () => {
      const available = this.available();
      return available !== undefined && this.days() > available
        ? { kind: 'balance', message: `You only have ${plural(available, 'day')} of this leave left.` }
        : undefined;
    });
  });

  protected readonly plural = plural;

  protected async save(event: Event) {
    event.preventDefault();
    this.submitFailed.set(false);
    await submit(this.leaveForm, async () => {
      try {
        const { type, from, to, halfDay, reason } = this.draft();
        await this.api.apply({ type, from, to, days: this.days(), reason: reason.trim(), ...(this.isHalfDay() && halfDay !== '' && { halfDay }) });
        this.applied.emit();
      } catch (error) {
        console.error('Applying for leave failed', error);
        this.submitFailed.set(true);
      }
      return undefined;
    });
  }
}
