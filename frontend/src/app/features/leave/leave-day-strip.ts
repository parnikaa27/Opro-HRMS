import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { dayOfMonth, formatFullDate, formatWeekday } from '../../shared/utils/date-time';
import { dayCodes, returnDate } from './leave-days';

// Longer requests show the date they're back instead of a strip too long to read.
const MAX_DAYS_SHOWN = 31;

// The paper form's month grid: each day of the leave with its code, and the day they're back at work.
@Component({
  selector: 'app-leave-day-strip',
  template: `
    @if (days().length <= maxDays) {
      <ol class="day-strip" aria-label="Your days off" data-testid="day-strip">
        @for (day of days(); track day.date) {
          <li [class.off]="day.code === 'OFF' || day.code === 'PH'" [attr.aria-label]="formatWeekday(day.date) + ' ' + dayOfMonth(day.date) + ', ' + meaning(day.code)">
            <small aria-hidden="true">{{ formatWeekday(day.date).slice(0, 2) }}</small>
            <strong aria-hidden="true">{{ dayOfMonth(day.date) }}</strong>
            <span aria-hidden="true">{{ day.code }}</span>
          </li>
        }
      </ol>
    }
    <p class="card-note" data-testid="return-date">Back at work on {{ formatFullDate(backOn()) }}. PH is a public holiday, OFF a Friday.</p>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeaveDayStrip {
  readonly from = input.required<string>();
  readonly to = input.required<string>();
  // The leave type's short code, like AL.
  readonly code = input.required<string>();
  readonly holidays = input.required<ReadonlySet<string>>();

  protected readonly maxDays = MAX_DAYS_SHOWN;
  protected readonly days = computed(() => dayCodes(this.from(), this.to(), this.code(), this.holidays()));
  protected readonly backOn = computed(() => returnDate(this.to(), this.holidays()));
  protected readonly meaning = (code: string) => (code === 'PH' ? 'public holiday' : code === 'OFF' ? 'day off' : 'leave');
  protected readonly formatWeekday = formatWeekday;
  protected readonly formatFullDate = formatFullDate;
  protected readonly dayOfMonth = dayOfMonth;
}
