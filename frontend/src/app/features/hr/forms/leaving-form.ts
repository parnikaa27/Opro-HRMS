import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { FormField, form, maxLength, required, validate } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { Employee } from '../../../models/employee';
import { FieldError } from '../../../shared/ui/field-error';
import { ModalHeading } from '../../../shared/ui/modal-heading';
import { serverReason, submitForm } from '../../../shared/utils/form-submit';
import { plural } from '../../../shared/utils/text';
import { HrApi } from '../hr-api';

const MAX_REASON = 300;

@Component({
  selector: 'app-leaving-form',
  imports: [FieldError, FormField, ModalHeading, RouterLink],
  template: `
    <app-modal-heading eyebrow="Leaving Opro" [heading]="firstName() + ' is leaving'" intro="Their records stay. After their last day they can't sign in, and leave booked after it is cancelled." />
    @if (reports().length) {
      <div class="attendance-off" data-testid="move-reports">
        <strong>Move their reports first</strong>
        {{ reportsLine() }} Give each of them a new manager from their page, then come back.
        <ul>
          @for (report of reports(); track report.id) {
            <li><a [routerLink]="['/hr/people', report.id, 'edit']" class="text-link">{{ report.fullName }}</a></li>
          }
        </ul>
      </div>
      <div class="modal-actions">
        <button type="button" class="secondary-button" (click)="cancelled.emit()">Close</button>
      </div>
    } @else {
      <form novalidate (submit)="save($event)">
        <label>Last working day <input type="date" [formField]="leavingForm.lastDay" [min]="joinedOn()" data-testid="leaving-date" aria-describedby="leaving-date-error" /></label>
        <app-field-error id="leaving-date-error" [errors]="leavingForm.lastDay().errors()" [isTouched]="leavingForm.lastDay().touched()" />
        <label>Reason <textarea [formField]="leavingForm.reason" placeholder="Resigned, moving back home" data-testid="leaving-reason" aria-describedby="leaving-reason-error"></textarea></label>
        <app-field-error id="leaving-reason-error" [errors]="leavingForm.reason().errors()" [isTouched]="leavingForm.reason().touched()" />
        @if (failed()) {
          <p role="alert">{{ problem() ?? "That didn't save. Try again in a moment." }}</p>
        }
        <div class="modal-actions">
          <button type="button" class="secondary-button" (click)="cancelled.emit()">Cancel</button>
          <button type="submit" class="primary-button danger" [disabled]="leavingForm().submitting()" data-testid="leaving-submit">Confirm last day</button>
        </div>
      </form>
    }
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeavingForm {
  private readonly api = inject(HrApi);
  readonly employeeId = input.required<string>();
  readonly name = input.required<string>();
  readonly joinedOn = input.required<string>();
  readonly reports = input.required<readonly Employee[]>();
  readonly exitOn = input<string>();
  readonly resignationReason = input<string>();
  readonly saved = output();
  readonly cancelled = output();

  protected readonly firstName = computed(() => this.name().split(' ')[0]);
  protected readonly reportsLine = computed(() => {
    const count = this.reports().length;
    return `${plural(count, 'person', 'people')} ${count === 1 ? 'reports' : 'report'} to ${this.firstName()}.`;
  });
  protected readonly failed = signal(false);
  protected readonly problem = signal<string | undefined>(undefined);
  // Someone who resigned starts with their exit date and why they went.
  protected readonly draft = linkedSignal(() => ({ lastDay: this.exitOn() ?? '', reason: this.resignationReason() ? `Resigned: ${this.resignationReason()}` : '' }));
  protected readonly leavingForm = form(this.draft, (path) => {
    required(path.lastDay, { message: 'Pick their last working day.' });
    validate(path.lastDay, ({ value }) => (value() && value() < this.joinedOn() ? { kind: 'early', message: 'That’s before they joined.' } : undefined));
    required(path.reason, { message: 'Say why, for their record.' });
    maxLength(path.reason, MAX_REASON, { message: `Keep it under ${MAX_REASON} characters.` });
  });

  protected save(event: Event) {
    this.problem.set(undefined);
    return submitForm(event, this.leavingForm, this.failed, async () => {
      try {
        await this.api.markLeaving(this.employeeId(), { lastDay: this.draft().lastDay, reason: this.draft().reason.trim() });
        this.saved.emit();
      } catch (error) {
        this.problem.set(serverReason(error));
        throw error;
      }
    });
  }
}
