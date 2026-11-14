import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Holiday } from '../../models/company';
import { Icon } from '../../shared/ui/icon';
import { addDays, daysUntil, formatShortDate, formatWeekday, maldivesToday, weekdayOf, yearOf } from '../../shared/utils/date-time';
import { valueOr } from '../../shared/utils/resource';
import { plural } from '../../shared/utils/text';
import { HolidaysApi } from '../holidays/holidays-api';

const THURSDAY = 4;
const SUNDAY = 0;
const DAYS_BEFORE_SUNDAY_WEEKEND = -2;
const DAY_DIGITS = -2;
const MONTH_LETTERS = 3;

// A holiday next to the Friday and Saturday weekend makes a long weekend. Returns the day it starts.
const longWeekendStart = ({ date }: Holiday) =>
  weekdayOf(date) === THURSDAY ? date : weekdayOf(date) === SUNDAY ? addDays(date, DAYS_BEFORE_SUNDAY_WEEKEND) : undefined;

@Component({
  selector: 'app-next-holiday-card',
  imports: [Icon, RouterLink],
  template: `
    <section class="card holiday-card">
      <div class="card-heading">
        <div>
          <span class="eyebrow">UP NEXT</span>
          <h2>Holiday calendar</h2>
        </div>
        <a routerLink="/calendar" class="small-calendar" aria-label="Open the holiday calendar"><app-icon name="calendar" [size]="18" /></a>
      </div>
      @if (next(); as holiday) {
        <div class="next-holiday" data-testid="next-holiday">
          <div class="date-box">
            <b>{{ dayNumber(holiday) }}</b>
            <span>{{ monthShort(holiday) }}</span>
          </div>
          <div>
            <strong>{{ holiday.name }}</strong>
            <span>{{ weekday(holiday) }} · {{ holiday.isTentative ? 'Tentative' : 'Public holiday' }}</span>
          </div>
        </div>
      } @else {
        <p class="attendance-off">No more holidays on the calendar yet.</p>
      }
      @if (longWeekendIn(); as days) {
        <div class="holiday-countdown">
          <app-icon name="plane" [size]="17" />
          <span>Your next long weekend is in <b>{{ days }}</b></span>
        </div>
      }
      <a routerLink="/calendar" class="text-link">See all holidays <app-icon name="arrow" [size]="15" /></a>
    </section>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NextHolidayCard {
  private readonly api = inject(HolidaysApi);
  private readonly today = maldivesToday();
  private readonly thisYear = this.api.forYear(() => String(yearOf(this.today)));
  private readonly nextYear = this.api.forYear(() => String(yearOf(this.today) + 1));

  private readonly upcoming = computed(() =>
    [...valueOr(this.thisYear, []), ...valueOr(this.nextYear, [])]
      .filter(({ date }) => date >= this.today)
      .sort((first, second) => first.date.localeCompare(second.date)),
  );
  protected readonly next = computed(() => this.upcoming()[0]);
  protected readonly longWeekendIn = computed(() => {
    const start = this.upcoming().map(longWeekendStart).find((date) => date !== undefined && date >= this.today);
    return start ? plural(daysUntil(start, this.today), 'day') : undefined;
  });

  protected readonly dayNumber = ({ date }: Holiday) => date.slice(DAY_DIGITS);
  protected readonly monthShort = ({ date }: Holiday) => formatShortDate(date).split(' ')[1].slice(0, MONTH_LETTERS).toUpperCase();
  protected readonly weekday = ({ date }: Holiday) => formatWeekday(date);
}
