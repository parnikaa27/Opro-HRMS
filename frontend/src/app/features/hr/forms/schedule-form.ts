import { ChangeDetectionStrategy, Component, inject, input, linkedSignal, output, signal } from '@angular/core';
import { FormField, form, max, maxLength, min, required, validate } from '@angular/forms/signals';
import { WorkSchedule } from '../../../models/attendance';
import { FieldError } from '../../../shared/ui/field-error';
import { ModalHeading } from '../../../shared/ui/modal-heading';
import { addDays, maldivesToday } from '../../../shared/utils/date-time';
import { submitForm } from '../../../shared/utils/form-submit';
import { HrApi } from '../hr-api';

const MAX_GRACE_MINUTES = 60;
const MAX_REASON = 300;
const MINUTES_PER_HOUR = 60;
const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * MINUTES_PER_HOUR + minutes;
};

@Component({
  selector: 'app-schedule-form',
  imports: [FieldError, FormField, ModalHeading],
  template: `
    <app-modal-heading eyebrow="WORK SCHEDULE" heading="Change the schedule" intro="Starts on the date you pick. Days already worked keep the rules they were worked under." />
    <form novalidate (submit)="save($event)">
      <label>Starts on <input type="date" [formField]="scheduleForm.effectiveFrom" [min]="tomorrow" data-testid="schedule-from" aria-describedby="schedule-from-error" /></label>
      <app-field-error id="schedule-from-error" [errors]="scheduleForm.effectiveFrom().errors()" [isTouched]="scheduleForm.effectiveFrom().touched()" />
      <div class="form-row">
        <label>Shift starts <input type="time" [formField]="scheduleForm.shiftStart" data-testid="schedule-start" /></label>
        <label>Shift ends <input type="time" [formField]="scheduleForm.shiftEnd" data-testid="schedule-end" aria-describedby="schedule-end-error" /></label>
      </div>
      <app-field-error id="schedule-end-error" [errors]="scheduleForm.shiftEnd().errors()" [isTouched]="scheduleForm.shiftEnd().touched()" />
      <div class="form-row">
        <label>Grace before late, minutes <input type="number" [formField]="scheduleForm.graceMinutes" data-testid="schedule-grace" aria-describedby="schedule-grace-error" /></label>
        <label>Half day under, hours <input type="number" step="0.5" [formField]="scheduleForm.halfDayHours" data-testid="schedule-half" aria-describedby="schedule-half-error" /></label>
      </div>
      <app-field-error id="schedule-grace-error" [errors]="scheduleForm.graceMinutes().errors()" [isTouched]="scheduleForm.graceMinutes().touched()" />
      <app-field-error id="schedule-half-error" [errors]="scheduleForm.halfDayHours().errors()" [isTouched]="scheduleForm.halfDayHours().touched()" />
      <label>Reason <textarea [formField]="scheduleForm.reason" placeholder="New site hours agreed with the board" data-testid="schedule-reason" aria-describedby="schedule-reason-error"></textarea></label>
      <app-field-error id="schedule-reason-error" [errors]="scheduleForm.reason().errors()" [isTouched]="scheduleForm.reason().touched()" />
      @if (failed()) {
        <p role="alert">That didn't save. Try again in a moment.</p>
      }
      <div class="modal-actions">
        <button type="button" class="secondary-button" (click)="cancelled.emit()">Cancel</button>
        <button type="submit" class="primary-button" [disabled]="scheduleForm().submitting()" data-testid="schedule-submit">Save change</button>
      </div>
    </form>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScheduleForm {
  private readonly api = inject(HrApi);
  // The rules in force now, so HR only edits what changes.
  readonly current = input<WorkSchedule>();
  readonly saved = output();
  readonly cancelled = output();

  protected readonly tomorrow = addDays(maldivesToday(), 1);
  protected readonly failed = signal(false);
  protected readonly draft = linkedSignal(() => {
    const current = this.current();
    return {
      effectiveFrom: '',
      shiftStart: current?.shiftStart ?? '09:00',
      shiftEnd: current?.shiftEnd ?? '17:00',
      graceMinutes: current?.graceMinutes ?? 0,
      halfDayHours: (current?.halfDayMinutes ?? 0) / MINUTES_PER_HOUR,
      reason: '',
    };
  });
  protected readonly scheduleForm = form(this.draft, (path) => {
    required(path.effectiveFrom, { message: 'Pick the first day it applies.' });
    [path.shiftStart, path.shiftEnd].forEach((time) => required(time, { message: 'Enter a time.' }));
    validate(path.effectiveFrom, ({ value }) => (value() && value() < this.tomorrow ? { kind: 'past', message: 'Changes can only start after today.' } : undefined));
    validate(path.shiftEnd, ({ value, valueOf }) => (toMinutes(value()) <= toMinutes(valueOf(path.shiftStart)) ? { kind: 'order', message: 'The shift has to end after it starts.' } : undefined));
    min(path.graceMinutes, 0, { message: 'Grace can’t be negative.' });
    max(path.graceMinutes, MAX_GRACE_MINUTES, { message: `Keep grace to ${MAX_GRACE_MINUTES} minutes or less.` });
    validate(path.halfDayHours, ({ value, valueOf }) => {
      const shift = toMinutes(valueOf(path.shiftEnd)) - toMinutes(valueOf(path.shiftStart));
      return value() <= 0 || value() * MINUTES_PER_HOUR >= shift ? { kind: 'range', message: 'A half day has to be shorter than the shift.' } : undefined;
    });
    required(path.reason, { message: 'Say why, so the change makes sense later.' });
    maxLength(path.reason, MAX_REASON, { message: `Keep it under ${MAX_REASON} characters.` });
  });

  protected save(event: Event) {
    return submitForm(event, this.scheduleForm, this.failed, async () => {
      const { halfDayHours, reason, ...rules } = this.draft();
      await this.api.saveSchedule({ ...rules, graceMinutes: Math.round(rules.graceMinutes), halfDayMinutes: Math.round(halfDayHours * MINUTES_PER_HOUR), reason: reason.trim() });
      this.saved.emit();
    });
  }
}
