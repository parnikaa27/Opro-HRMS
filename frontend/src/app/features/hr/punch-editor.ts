import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { FormField, form, maxLength, required } from '@angular/forms/signals';
import { AttendanceDay, PunchEdit } from '../../models/attendance';
import { FieldError } from '../../shared/ui/field-error';
import { ModalHeading } from '../../shared/ui/modal-heading';
import { formatClock, formatDayShort, formatShortDate, formatTimeOfDay } from '../../shared/utils/date-time';
import { submitForm } from '../../shared/utils/form-submit';
import { HrApi } from './hr-api';

const MAX_REASON = 300;
const TIME_START = 11;
const TIME_END = 16;
const timeOf = (iso: string) => iso.slice(TIME_START, TIME_END);

// One change per save, so every line in the log says exactly what moved and why.
@Component({
  selector: 'app-punch-editor',
  imports: [FieldError, FormField, ModalHeading],
  template: `
    <app-modal-heading eyebrow="ATTENDANCE" [heading]="'Fix punches for ' + firstName()" [intro]="formatDayShort(day().date) + '. Punches are never overwritten. Voided ones stay in the log below.'" />
    <ul class="punch-list" data-testid="punch-list">
      @for (punch of day().punches; track punch.at) {
        <li>{{ formatClock(punch.at) }} <span>{{ punch.direction === 'in' ? 'In' : 'Out' }}</span></li>
      } @empty {
        <li>No punches on this day.</li>
      }
    </ul>
    <form novalidate (submit)="save($event)">
      <div class="form-row">
        <label>
          Change
          <select [formField]="punchForm.action" data-testid="punch-action">
            <option value="add" [selected]="draft().action === 'add'">Add a missing punch</option>
            <option value="void" [selected]="draft().action === 'void'" [disabled]="day().punches.length === 0">Void a wrong punch</option>
          </select>
        </label>
        @if (draft().action === 'add') {
          <label>Time <input type="time" [formField]="punchForm.time" data-testid="punch-time" aria-describedby="punch-time-error" /></label>
        } @else {
          <label>
            Punch
            <select [formField]="punchForm.time" data-testid="punch-void" aria-describedby="punch-time-error">
              <option value="" [selected]="draft().time === ''">Pick one</option>
              @for (time of times(); track time) {
                <option [value]="time" [selected]="draft().time === time">{{ formatTimeOfDay(time) }}</option>
              }
            </select>
          </label>
        }
      </div>
      <app-field-error id="punch-time-error" [errors]="punchForm.time().errors()" [isTouched]="punchForm.time().touched()" />
      <label>Reason <textarea [formField]="punchForm.reason" placeholder="Fingerprint didn't read, confirmed with the site lead" data-testid="punch-reason" aria-describedby="punch-reason-error"></textarea></label>
      <app-field-error id="punch-reason-error" [errors]="punchForm.reason().errors()" [isTouched]="punchForm.reason().touched()" />
      @if (failed()) {
        <p role="alert">That didn't save. There may already be a punch at that time.</p>
      }
      <div class="modal-actions">
        <button type="button" class="secondary-button" (click)="closed.emit()">Done</button>
        <button type="submit" class="primary-button" [disabled]="punchForm().submitting()" data-testid="punch-submit">Save change</button>
      </div>
    </form>
    @if (edits().length) {
      <ul class="punch-log" aria-label="Changes to this day" data-testid="punch-log">
        @for (change of edits(); track change.id) {
          <li>{{ change.action === 'add' ? 'Added' : 'Voided' }} {{ formatTimeOfDay(change.time) }} · {{ change.reason }} · {{ change.byName ?? change.by }}, {{ formatShortDate(change.on) }}</li>
        }
      </ul>
    }
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PunchEditor {
  private readonly api = inject(HrApi);
  readonly day = input.required<AttendanceDay>();
  readonly name = input.required<string>();
  readonly edits = input.required<readonly PunchEdit[]>();
  readonly saved = output();
  readonly closed = output();

  protected readonly firstName = computed(() => this.name().split(' ')[0]);
  protected readonly times = computed(() => this.day().punches.map(({ at }) => timeOf(at)));
  protected readonly failed = signal(false);
  // Starts fresh for each day, and again after every save.
  protected readonly draft = linkedSignal(() => ({ date: this.day().date, action: 'add' as 'add' | 'void', time: '', reason: '' }));
  protected readonly punchForm = form(this.draft, (path) => {
    required(path.time, { message: 'Pick the time.' });
    required(path.reason, { message: 'Say why, so the change makes sense later.' });
    maxLength(path.reason, MAX_REASON, { message: `Keep it under ${MAX_REASON} characters.` });
  });

  protected readonly formatClock = formatClock;
  protected readonly formatDayShort = formatDayShort;
  protected readonly formatShortDate = formatShortDate;
  protected readonly formatTimeOfDay = formatTimeOfDay;

  protected save(event: Event) {
    return submitForm(event, this.punchForm, this.failed, async () => {
      const { date, action, time, reason } = this.draft();
      await this.api.editPunch({ employeeId: this.day().employeeId, date, action, time, reason: reason.trim() });
      // Ready for the next change: the values reset with the reloaded day, the touched state here.
      this.punchForm().reset();
      this.saved.emit();
    });
  }
}
