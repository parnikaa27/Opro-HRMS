import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { FormField, form, max, min, required, submit } from '@angular/forms/signals';
import { LeaveType } from '../../../models/leave';
import { FieldError } from '../../../shared/ui/field-error';
import { ModalHeading } from '../../../shared/ui/modal-heading';
import { serverReason } from '../../../shared/utils/form-submit';
import { HrApi } from '../hr-api';

const MAX_DAYS = 365;
const FAILED = "That didn't save. Try again in a moment.";

// Adds a leave type, or edits one. Leave the type out to add.
@Component({
  selector: 'app-policy-form',
  imports: [FieldError, FormField, ModalHeading],
  template: `
    <app-modal-heading eyebrow="LEAVE POLICY" [heading]="type() ? 'Edit ' + type()?.name?.toLowerCase() : 'Add a leave type'" [intro]="intro()" />
    <form novalidate (submit)="save($event)">
      <label>Name <input [formField]="policyForm.name" placeholder="Marriage leave" data-testid="policy-name" aria-describedby="policy-name-error" /></label>
      <app-field-error id="policy-name-error" [errors]="policyForm.name().errors()" [isTouched]="policyForm.name().touched()" />
      @if (!type()) {
        <label>
          Balance
          <select [formField]="policyForm.limit" data-testid="policy-limit">
            <option value="days">A number of days a year</option>
            <option value="none">No limit, like unpaid leave</option>
          </select>
        </label>
      }
      <div class="form-row">
        @if (!isUnlimited()) {
          <label>Days per year <input type="number" step="0.5" [formField]="policyForm.days" data-testid="policy-days" aria-describedby="policy-days-error" /></label>
        }
        <label>
          Half days
          <select [formField]="policyForm.halfDays" data-testid="policy-half">
            <option value="yes">Allowed</option>
            <option value="no">Not allowed</option>
          </select>
        </label>
        <label>
          Given to
          <select [formField]="policyForm.givenTo" data-testid="policy-given">
            <option value="everyone">Everyone, every year</option>
            <option value="individual">People HR picks</option>
          </select>
        </label>
      </div>
      <app-field-error id="policy-days-error" [errors]="policyForm.days().errors()" [isTouched]="policyForm.days().touched()" />
      @if (!isUnlimited()) {
        <div class="form-row">
          <label>
            At year end
            <select [formField]="policyForm.yearEnd" data-testid="policy-year-end">
              <option value="lapse">Unused days lapse</option>
              <option value="carry">Unused days carry forward</option>
            </select>
          </label>
          @if (draft().yearEnd === 'carry') {
            <label>Carry up to (days) <input type="number" step="0.5" [formField]="policyForm.cap" data-testid="policy-cap" aria-describedby="policy-cap-error" /></label>
          }
        </div>
        <app-field-error id="policy-cap-error" [errors]="policyForm.cap().errors()" [isTouched]="policyForm.cap().touched()" />
      }
      <div class="form-row">
        <label>
          Approved by
          <select [formField]="policyForm.approval" data-testid="policy-approval">
            <option value="hod">The HOD</option>
            <option value="hr">The HOD, then HR</option>
          </select>
        </label>
        <label>Asked for (days ahead) <input type="number" step="1" [formField]="policyForm.notice" data-testid="policy-notice" aria-describedby="policy-notice-error policy-notice-note" /></label>
      </div>
      <app-field-error id="policy-notice-error" [errors]="policyForm.notice().errors()" [isTouched]="policyForm.notice().touched()" />
      <p class="card-note" id="policy-notice-note">0 means it can be asked for any time, like sick leave. The paper form asks a month ahead for annual leave.</p>
      @if (failure()) {
        <p role="alert" data-testid="policy-error">{{ failure() }}</p>
      }
      <div class="modal-actions">
        <button type="button" class="secondary-button" (click)="cancelled.emit()">Cancel</button>
        <button type="submit" class="primary-button" [disabled]="policyForm().submitting()" data-testid="policy-submit">{{ type() ? 'Save' : 'Add leave type' }}</button>
      </div>
    </form>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PolicyForm {
  private readonly api = inject(HrApi);
  readonly type = input<LeaveType>();
  readonly saved = output();
  readonly cancelled = output();

  protected readonly failure = signal<string | undefined>(undefined);
  protected readonly draft = linkedSignal(() => {
    const type = this.type();
    return {
      name: type?.name ?? '',
      limit: type?.isUnlimited ? 'none' : 'days',
      days: type?.defaultEntitlement ?? 0,
      halfDays: (type?.allowsHalfDay ?? true) ? 'yes' : 'no',
      givenTo: (type?.isForEveryone ?? true) ? 'everyone' : 'individual',
      yearEnd: type?.carriesForward ? 'carry' : 'lapse',
      cap: type?.carryForwardCap ?? 0,
      approval: type?.needsHrApproval ? 'hr' : 'hod',
      notice: type?.noticeDays ?? 0,
    };
  });
  protected readonly isUnlimited = computed(() => this.draft().limit === 'none');
  protected readonly intro = computed(() =>
    this.type() ? 'A new number of days applies from the next leave year. Today’s balances stay as they are.' : 'A type for everyone reaches everyone straight away. One for people HR picks is given from each person’s page.',
  );
  protected readonly policyForm = form(this.draft, (path) => {
    required(path.name, { message: 'Give the leave type a name.' });
    min(path.days, 0, { message: 'Days can’t be negative.' });
    max(path.days, MAX_DAYS, { message: `That's more than a year.` });
    min(path.cap, 0, { message: 'Days can’t be negative.' });
    max(path.cap, MAX_DAYS, { message: `That's more than a year.` });
    min(path.notice, 0, { message: 'Days can’t be negative.' });
    max(path.notice, MAX_DAYS, { message: `That's more than a year.` });
  });

  protected save(event: Event) {
    event.preventDefault();
    this.failure.set(undefined);
    return submit(this.policyForm, async () => {
      const { name, days, halfDays, givenTo, yearEnd, cap, approval, notice } = this.draft();
      const isUnlimited = this.isUnlimited();
      const carries = !isUnlimited && yearEnd === 'carry';
      try {
        await this.api.saveLeaveType({
          code: this.type()?.code,
          name: name.trim(),
          allowsHalfDay: halfDays === 'yes',
          isUnlimited,
          ...(!isUnlimited && { defaultEntitlement: days }),
          documentRequiredAfterDays: this.type()?.documentRequiredAfterDays,
          isForEveryone: givenTo === 'everyone',
          carriesForward: carries,
          ...(carries && { carryForwardCap: cap }),
          needsHrApproval: approval === 'hr',
          ...(notice > 0 && { noticeDays: Math.round(notice) }),
        });
        this.saved.emit();
      } catch (error) {
        console.error('Saving a leave type failed', error);
        this.failure.set(serverReason(error) ?? FAILED);
      }
      return undefined;
    });
  }
}
