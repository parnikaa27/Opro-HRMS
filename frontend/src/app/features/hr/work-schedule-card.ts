import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { WorkSchedule } from '../../models/attendance';
import { ConfirmButton } from '../../shared/ui/confirm-button';
import { Dialog } from '../../shared/ui/dialog';
import { Icon } from '../../shared/ui/icon';
import { ListSkeleton } from '../../shared/ui/list-skeleton';
import { StatusPill, Tone } from '../../shared/ui/status-pill';
import { formatCompactDate, formatShortDate, formatTimeOfDay, maldivesToday } from '../../shared/utils/date-time';
import { valueOr } from '../../shared/utils/resource';
import { plural } from '../../shared/utils/text';
import { DecisionState } from '../team/decision-state';
import { ScheduleForm } from './forms/schedule-form';
import { HrApi } from './hr-api';

const MINUTES_PER_HOUR = 60;
const PAST_SHOWN = 3;

// Shift rules as dated versions: one in force, maybe one coming, and the ones before for the record.
@Component({
  selector: 'app-work-schedule-card',
  imports: [ConfirmButton, Dialog, Icon, ListSkeleton, ScheduleForm, StatusPill],
  template: `
    <section class="card request-history">
      <div class="card-heading">
        <div><span class="eyebrow">ATTENDANCE RULES</span><h2>Work schedule</h2></div>
        <!-- The form starts from the rules in force, so it waits for them rather than resetting under someone's typing. -->
        <button type="button" class="secondary-button" [disabled]="versions.isLoading()" (click)="isEditing.set(true)" data-testid="change-schedule">Change from a date</button>
      </div>
      @if (versions.error()) {
        <p class="attendance-off">The work schedule didn't load. Refresh the page to try again.</p>
      } @else if (versions.isLoading() && list().length === 0) {
        <app-list-skeleton [count]="2" />
      } @else {
        @for (version of shown(); track version.id) {
          <div class="history-row" data-testid="schedule-row">
            <div class="leave-type-icon"><app-icon name="clock" [size]="18" /></div>
            <div>
              <strong>{{ formatTimeOfDay(version.shiftStart) }} to {{ formatTimeOfDay(version.shiftEnd) }}, late after {{ plural(version.graceMinutes, 'minute') }}</strong>
              <span>Half day under {{ plural(version.halfDayMinutes / minutesPerHour, 'hour') }} · Ramadan {{ formatTimeOfDay(version.ramadanStart) }} to {{ formatTimeOfDay(version.ramadanEnd) }}</span>
              <span>{{ version.reason }} · {{ version.setByName ?? version.setBy }}, {{ formatCompactDate(version.setOn) }}</span>
              @if (version.effectiveFrom > today) {
                <div class="row-actions">
                  <app-confirm-button label="Cancel this change" question="Cancel the change?" yes="Yes, cancel it" testId="cancel-schedule" (confirmed)="cancel(version.id)" />
                </div>
                @if (rows.failedId() === version.id) {
                  <p class="row-error" role="alert">That didn't save. Try again in a moment.</p>
                }
              }
            </div>
            <span></span>
            <app-status-pill [tone]="stateOf(version).tone">{{ stateOf(version).label }}</app-status-pill>
          </div>
        }
      }
    </section>

    <app-dialog heading="Work schedule" [isOpen]="isEditing()" (isOpenChange)="isEditing.set($event)">
      <app-schedule-form [current]="current()" (saved)="saved()" (cancelled)="isEditing.set(false)" />
    </app-dialog>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkScheduleCard {
  private readonly api = inject(HrApi);
  protected readonly today = maldivesToday();
  protected readonly versions = this.api.schedules();
  protected readonly rows = new DecisionState();
  protected readonly isEditing = signal(false);
  protected readonly minutesPerHour = MINUTES_PER_HOUR;

  // Newest first from the API. Upcoming ones, the one in force, then the last three for context.
  protected readonly list = computed(() => valueOr(this.versions, []));
  protected readonly current = computed(() => this.list().find(({ effectiveFrom }) => effectiveFrom <= this.today));
  protected readonly shown = computed(() => {
    const currentIndex = this.list().findIndex(({ id }) => id === this.current()?.id);
    return this.list().slice(0, currentIndex + PAST_SHOWN + 1);
  });

  // A pill, not a column: the design hides the middle column on phones, and this is the one fact that matters.
  protected readonly stateOf = ({ id, effectiveFrom }: WorkSchedule): { label: string; tone: Tone } =>
    effectiveFrom > this.today
      ? { label: `Starts ${formatShortDate(effectiveFrom)}`, tone: 'late' }
      : id === this.current()?.id
        ? { label: 'In force', tone: 'ok' }
        : { label: `From ${formatCompactDate(effectiveFrom)}`, tone: 'neutral' };
  protected readonly formatTimeOfDay = formatTimeOfDay;
  protected readonly formatCompactDate = formatCompactDate;
  protected readonly plural = plural;

  protected cancel(id: string) {
    return this.rows.run(id, () => this.api.cancelSchedule(id), () => this.versions.reload());
  }

  protected saved() {
    this.isEditing.set(false);
    this.versions.reload();
  }
}
