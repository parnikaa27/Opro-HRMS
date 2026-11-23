import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormField, form, hidden, maxLength, required, submit, validate } from '@angular/forms/signals';
import { Session } from '../../core/session';
import { LeaveBalance, LeaveKind, LeaveRequest, LeaveType } from '../../models/leave';
import { FieldError } from '../../shared/ui/field-error';
import { Icon } from '../../shared/ui/icon';
import { ModalHeading } from '../../shared/ui/modal-heading';
import { addDays, formatFullDate, maldivesToday } from '../../shared/utils/date-time';
import { plural } from '../../shared/utils/text';
import { CERTIFICATE_ACCEPT, certificateProblem, LeaveApi, needsCertificate } from './leave-api';
import { LeaveDayStrip } from './leave-day-strip';
import { countLeaveDays, leaveYearOf, returnDate, shortCode } from './leave-days';
import { describeDates } from './leave-format';

const MAX_REASON = 300;

interface LeaveDraft {
  kind: LeaveKind;
  relatedId: string;
  type: string;
  from: string;
  to: string;
  halfDay: '' | 'first' | 'second';
  reason: string;
  usesFlightEntitlement: boolean;
  wantsSalaryAdvance: boolean;
}

const KINDS: readonly { value: LeaveKind; label: string }[] = [
  { value: 'initial', label: 'A new request' },
  { value: 'amended', label: 'A change to a request (amended)' },
  { value: 'extended', label: 'More days after a request (extended)' },
];

@Component({
  selector: 'app-leave-form',
  imports: [FormField, FieldError, Icon, LeaveDayStrip, ModalHeading],
  template: `
    <app-modal-heading eyebrow="Time off" heading="Request leave" [intro]="isSuperAdmin() ? 'Your leave is approved as soon as you send it.' : 'Submit your leave dates for manager approval.'" />
    <form novalidate (submit)="save($event)">
      <label>
        This is
        <select [formField]="leaveForm.kind" (change)="prefill()" data-testid="leave-kind">
          @for (kind of kinds; track kind.value) {
            <option [value]="kind.value">{{ kind.label }}</option>
          }
        </select>
      </label>
      @if (!leaveForm.relatedId().hidden()) {
        <label>
          Which request?
          <select [formField]="leaveForm.relatedId" (change)="prefill()" data-testid="leave-related" [attr.aria-invalid]="leaveForm.relatedId().touched() && leaveForm.relatedId().invalid()" aria-describedby="leave-related-error">
            <option value="">Pick one</option>
            @for (request of changeable(); track request.id) {
              <option [value]="request.id">{{ nameOf(request.type) }}, {{ describeDates(request) }}</option>
            }
          </select>
        </label>
        <app-field-error id="leave-related-error" [errors]="leaveForm.relatedId().errors()" [isTouched]="leaveForm.relatedId().touched()" />
      }

      <label>
        Leave type
        <select [formField]="leaveForm.type" data-testid="leave-type" [attr.aria-invalid]="leaveForm.type().touched() && leaveForm.type().invalid()" aria-describedby="leave-type-error">
          @for (type of offeredTypes(); track type.code) {
            <option [value]="type.code" [selected]="type.code === draft().type">{{ type.name }}</option>
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

      <div class="step-checks">
        <label class="check-label"><input type="checkbox" [formField]="leaveForm.usesFlightEntitlement" data-testid="leave-flight" /> I wish to use my flight entitlement</label>
        <label class="check-label"><input type="checkbox" [formField]="leaveForm.wantsSalaryAdvance" data-testid="leave-advance" /> I'd like my salary in advance</label>
      </div>

      <div class="form-summary" aria-live="polite" data-testid="leave-preview">
        <app-icon name="calendar" [size]="19" />
        <div>
          <strong>{{ days() > 0 ? plural(days(), 'day') + ' requested' : 'Pick your dates' }}</strong>
          <span>{{ summaryLine() }}</span>
        </div>
      </div>
      @if (days() > 0) {
        <app-leave-day-strip [from]="draft().from" [to]="draft().to" [code]="code()" [holidays]="holidays()" />
      }
      @if (needsCertificate()) {
        <label>
          Medical certificate, if you have it
          <input type="file" [accept]="certificateAccept" (change)="pickCertificate($event)" data-testid="leave-certificate" aria-describedby="leave-certificate-note" />
        </label>
        <p class="modal-intro" id="leave-certificate-note">
          {{ certificateProblem() ?? 'Sick leave longer than ' + plural(selectedType()?.documentRequiredAfterDays ?? 0, 'day') + ' needs one. Only you and HR can open it. No certificate yet? Add it later from your request history.' }}
        </p>
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
  protected readonly isSuperAdmin = inject(Session).isSuperAdmin;

  readonly types = input.required<readonly LeaveType[]>();
  readonly balances = input.required<readonly LeaveBalance[]>();
  readonly holidays = input.required<ReadonlySet<string>>();
  // Their own requests, to amend or extend one.
  readonly requests = input.required<readonly LeaveRequest[]>();
  // Sets when their leave year ends.
  readonly joinedOn = input<string>();
  // True when the request went in but its certificate is still missing.
  readonly applied = output<boolean>();
  readonly cancelled = output();

  private readonly today = maldivesToday();
  protected readonly kinds = KINDS;
  protected readonly draft = signal<LeaveDraft>({
    kind: 'initial',
    relatedId: '',
    type: 'annual',
    from: '',
    to: '',
    halfDay: '',
    reason: '',
    usesFlightEntitlement: false,
    wantsSalaryAdvance: false,
  });
  protected readonly submitFailed = signal(false);

  // Only types this person has a balance for, plus uncapped ones like unpaid leave.
  protected readonly offeredTypes = computed(() =>
    this.types().filter((type) => !type.retiredOn && (type.isUnlimited || this.balances().some((balance) => balance.type === type.code))),
  );
  protected readonly selectedType = computed(() => this.types().find((type) => type.code === this.draft().type));
  protected readonly code = computed(() => shortCode(this.selectedType()?.name ?? ''));
  protected readonly nameOf = (code: string) => this.types().find((type) => type.code === code)?.name ?? code;
  protected readonly describeDates = describeDates;

  // Waiting or approved requests. Only ones not over yet can be amended.
  protected readonly changeable = computed(() =>
    this.requests().filter(
      ({ status, to }) => (status === 'pending' || status === 'approved') && (this.draft().kind !== 'amended' || to >= this.today),
    ),
  );
  private readonly related = computed(() => this.requests().find((request) => request.id === this.draft().relatedId));
  private readonly isSingleDay = computed(() => this.draft().from !== '' && this.draft().from === this.draft().to);
  private readonly canHalfDay = computed(() => this.isSingleDay() && !!this.selectedType()?.allowsHalfDay);
  private readonly isHalfDay = computed(() => this.canHalfDay() && this.draft().halfDay !== '');

  protected readonly days = computed(() => countLeaveDays({ ...this.draft(), isHalfDay: this.isHalfDay() }, this.holidays()));

  // Undefined means there is no cap. Only uncapped types reach the form without a balance. An amendment gives back
  // the days of the request it replaces.
  protected readonly available = computed(() => {
    const balance = this.balances().find((entry) => entry.type === this.draft().type);
    const related = this.related();
    const givenBack = this.draft().kind === 'amended' && related?.type === this.draft().type ? related.days : 0;
    return balance ? balance.entitled - balance.taken - balance.pending + givenBack : undefined;
  });
  protected readonly summaryLine = computed(() => {
    const available = this.available();
    if (this.days() === 0) {
      return 'Weekends and public holidays don’t count.';
    }
    return available === undefined ? 'Unpaid, so it doesn’t use a balance.' : `${plural(available - this.days(), 'day')} will remain after approval`;
  });
  protected readonly needsCertificate = computed(() => needsCertificate(this.selectedType(), this.days()));
  protected readonly certificateAccept = CERTIFICATE_ACCEPT;
  private readonly certificate = signal<File | undefined>(undefined);
  protected readonly certificateProblem = signal<string | undefined>(undefined);

  protected readonly leaveForm = form(this.draft, (path) => {
    required(path.type, { message: 'Pick a type of leave.' });
    required(path.from, { message: 'Pick your first day.' });
    required(path.to, { message: 'Pick your last day.' });
    required(path.reason, { message: 'Add a short reason for your manager.' });
    maxLength(path.reason, MAX_REASON, { message: `Keep it under ${MAX_REASON} characters.` });
    hidden(path.halfDay, () => !this.canHalfDay());
    hidden(path.relatedId, ({ valueOf }) => valueOf(path.kind) === 'initial');
    required(path.relatedId, { message: 'Pick the request this changes.', when: ({ valueOf }) => valueOf(path.kind) !== 'initial' });
    validate(path.from, ({ value, valueOf }) => this.fromProblem(value(), valueOf(path.kind)));
    validate(path.to, ({ value, valueOf }) => {
      const from = valueOf(path.from);
      if (!value() || !from) {
        return undefined;
      }
      if (value() < from) {
        return { kind: 'order', message: "The last day can't be before the first." };
      }
      const joinedOn = this.joinedOn();
      const yearEnds = joinedOn && leaveYearOf(joinedOn, from).end;
      if (yearEnds && value() > yearEnds) {
        return { kind: 'leave-year', message: `Your leave year ends on ${formatFullDate(yearEnds)}. Split this into two requests, one each side of it.` };
      }
      return this.days() === 0 ? { kind: 'no-working-days', message: 'Those dates are all Fridays or public holidays. Nothing to take.' } : undefined;
    });
    validate(path.type, () => {
      const available = this.available();
      return available !== undefined && this.days() > available
        ? { kind: 'balance', message: `You only have ${plural(available, 'day')} of this leave left.` }
        : undefined;
    });
  });

  protected readonly plural = plural;

  // Any day in their leave year, past or future. A first request needs the type's notice. An extension starts
  // straight after the leave it extends.
  private fromProblem(from: string, kind: LeaveKind) {
    const joinedOn = this.joinedOn();
    const yearStarted = joinedOn && leaveYearOf(joinedOn, this.today).start;
    if (from && yearStarted && from < yearStarted) {
      return { kind: 'closed-year', message: `Your leave year started on ${formatFullDate(yearStarted)}. Leave before that can't be booked now; ask HR.` };
    }
    const notice = this.selectedType()?.noticeDays;
    const earliest = notice ? addDays(this.today, notice) : undefined;
    if (from && kind === 'initial' && earliest && from < earliest) {
      return { kind: 'notice', message: `${this.selectedType()?.name} is asked for ${notice} days ahead. The earliest it can start is ${formatFullDate(earliest)}.` };
    }
    const related = this.related();
    const gap = related && countLeaveDays({ from: addDays(related.to, 1), to: addDays(from, -1), isHalfDay: false }, this.holidays());
    if (from && kind === 'extended' && related && (from <= related.to || gap)) {
      return { kind: 'follow-on', message: `An extension starts straight after the leave it extends, which ends on ${formatFullDate(related.to)}.` };
    }
    return undefined;
  }

  // Picking a request to amend copies it in to change. An extension starts on the first working day after it.
  protected prefill() {
    const related = this.related();
    if (!related || this.draft().kind === 'initial') {
      return;
    }
    const isAmendment = this.draft().kind === 'amended';
    const from = isAmendment ? related.from : returnDate(related.to, this.holidays());
    this.draft.update((draft) => ({ ...draft, type: related.type, from, to: isAmendment ? related.to : from, halfDay: isAmendment ? (related.halfDay ?? '') : '' }));
  }

  protected pickCertificate(event: Event) {
    const file = event.target instanceof HTMLInputElement ? event.target.files?.[0] : undefined;
    const problem = file && certificateProblem(file);
    this.certificateProblem.set(problem);
    this.certificate.set(problem ? undefined : file);
  }

  // The request is already in when this runs, so a failed upload doesn't undo it.
  private async attach(id: string) {
    const file = this.certificate();
    if (!file) {
      return false;
    }
    try {
      await this.api.attachCertificate(id, file);
      return true;
    } catch (error) {
      console.error('Attaching a certificate failed', error);
      return false;
    }
  }

  protected async save(event: Event) {
    event.preventDefault();
    this.submitFailed.set(false);
    await submit(this.leaveForm, async () => {
      try {
        const { kind, relatedId, type, from, to, halfDay, reason, usesFlightEntitlement, wantsSalaryAdvance } = this.draft();
        const request = await this.api.apply({
          kind,
          type,
          from,
          to,
          days: this.days(),
          reason: reason.trim(),
          usesFlightEntitlement,
          wantsSalaryAdvance,
          ...(kind !== 'initial' && { relatedRequestId: relatedId }),
          ...(this.isHalfDay() && halfDay !== '' && { halfDay }),
        });
        this.applied.emit(this.needsCertificate() && !(await this.attach(request.id)));
      } catch (error) {
        console.error('Applying for leave failed', error);
        this.submitFailed.set(true);
      }
      return undefined;
    });
  }
}
