import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { FormField, form, max, maxLength, min, required, submit } from '@angular/forms/signals';
import { COMP_OFF, LeaveBalance, LeaveType } from '../../../models/leave';
import { FieldError } from '../../../shared/ui/field-error';
import { ModalHeading } from '../../../shared/ui/modal-heading';
import { serverReason } from '../../../shared/utils/form-submit';
import { plural } from '../../../shared/utils/text';
import { HrApi } from '../hr-api';

const MAX_DAYS = 365;
const MAX_REASON = 300;
const FAILED = "That didn't save. Try again in a moment.";

// How many days of a type one person gets this year: fewer for someone who joined late, or a type only they get.
// A type they hold can also be taken away. Every change needs a reason and is logged.
@Component({
  selector: 'app-leave-days-form',
  imports: [FieldError, FormField, ModalHeading],
  template: `
    <app-modal-heading eyebrow="Their leave" [heading]="'Leave days for ' + firstName()" intro="Sets what they get this year. Anything carried over from last year comes on top." />
    <form novalidate (submit)="save($event)">
      <label>
        Type of leave
        <select [value]="selected()" (change)="pick($event)" data-testid="days-type">
          @for (option of options(); track option.code) {
            <option [value]="option.code">{{ option.name }} · {{ held(option.code) ? plural(baseOf(option.code), 'day') + ' now' : 'not given yet' }}</option>
          }
        </select>
      </label>
      <label>Days this year <input type="number" step="0.5" [formField]="daysForm.days" data-testid="days-count" aria-describedby="days-count-error" /></label>
      <app-field-error id="days-count-error" [errors]="daysForm.days().errors()" [isTouched]="daysForm.days().touched()" />
      <label>
        Reason
        <textarea [formField]="daysForm.reason" placeholder="Joined in August, so 12 of the year's 30 days" data-testid="days-reason" aria-describedby="days-reason-error"></textarea>
      </label>
      <app-field-error id="days-reason-error" [errors]="daysForm.reason().errors()" [isTouched]="daysForm.reason().touched()" />
      @if (failure()) {
        <p role="alert" data-testid="days-error">{{ failure() }}</p>
      }
      <div class="modal-actions">
        @if (held(selected())) {
          <button type="button" class="secondary-button" [disabled]="daysForm().submitting()" (click)="takeAway()" data-testid="days-remove">Take it away</button>
        }
        <button type="button" class="secondary-button" (click)="cancelled.emit()">Cancel</button>
        <button type="submit" class="primary-button" [disabled]="daysForm().submitting()" data-testid="days-submit">Save days</button>
      </div>
    </form>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeaveDaysForm {
  private readonly api = inject(HrApi);
  readonly employeeId = input.required<string>();
  readonly name = input.required<string>();
  readonly types = input.required<readonly LeaveType[]>();
  readonly balances = input.required<readonly LeaveBalance[]>();
  readonly saved = output();
  readonly cancelled = output();

  protected readonly failure = signal<string | undefined>(undefined);
  protected readonly firstName = computed(() => this.name().split(' ')[0]);
  // Types with a balance that are still offered. Compensatory off is earned, not given; Adjust balance corrects it.
  protected readonly options = computed(() => this.types().filter(({ code, isUnlimited, retiredOn }) => !isUnlimited && !retiredOn && code !== COMP_OFF));
  protected readonly selected = linkedSignal(() => this.options()[0]?.code ?? '');
  // Starts from what they get now, or the policy's default for a type they don't hold yet.
  protected readonly draft = linkedSignal(() => {
    const code = this.selected();
    return { days: this.held(code) ? this.baseOf(code) : (this.options().find((type) => type.code === code)?.defaultEntitlement ?? 0), reason: '' };
  });
  protected readonly daysForm = form(this.draft, (path) => {
    min(path.days, 0, { message: 'Days can’t be negative.' });
    max(path.days, MAX_DAYS, { message: `That's more than a year.` });
    required(path.reason, { message: 'Say why. It goes in their log.' });
    maxLength(path.reason, MAX_REASON, { message: `Keep it under ${MAX_REASON} characters.` });
  });

  protected readonly held = (code: string) => this.balances().some(({ type }) => type === code);
  // What HR sets is this year's own days. Carried over days sit on top and aren't HR's to change here.
  protected readonly baseOf = (code: string) => {
    const balance = this.balances().find(({ type }) => type === code);
    return balance ? balance.entitled - (balance.carriedOver ?? 0) : 0;
  };
  protected readonly plural = plural;

  protected pick(event: Event) {
    if (event.target instanceof HTMLSelectElement) {
      this.selected.set(event.target.value);
    }
  }

  protected save(event: Event) {
    event.preventDefault();
    this.failure.set(undefined);
    return submit(this.daysForm, () => this.attempt(() => this.api.setLeaveDays(this.employeeId(), this.selected(), { days: this.draft().days, reason: this.draft().reason.trim() })));
  }

  protected takeAway() {
    this.failure.set(undefined);
    return submit(this.daysForm, () => this.attempt(() => this.api.takeLeaveTypeAway(this.employeeId(), this.selected(), this.draft().reason.trim())));
  }

  private async attempt(change: () => Promise<void>) {
    try {
      await change();
      this.saved.emit();
    } catch (error) {
      console.error('Changing leave days failed', error);
      this.failure.set(serverReason(error) ?? FAILED);
    }
    return undefined;
  }
}
