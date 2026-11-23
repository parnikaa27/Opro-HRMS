import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { COMPANY, WEEKEND_DAYS } from '../../core/config';
import { Session } from '../../core/session';
import { Holiday } from '../../models/company';
import { Icon } from '../../shared/ui/icon';
import { addDays, addMonths, datesBetween, dayOfMonth, formatMonth, formatShortDate, formatWeekday, maldivesToday, monthOf, weekdayOf, yearOf } from '../../shared/utils/date-time';
import { valueOr } from '../../shared/utils/resource';
import { HolidaysApi } from '../holidays/holidays-api';
import { TeamApi, ViewScope } from '../team/team-api';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_PER_WEEK = 7;
const UPCOMING_COUNT = 3;
const MONTH_LETTERS = 3;
const WEEKDAYS_OFF: ReadonlySet<number> = new Set(WEEKEND_DAYS);

interface CalendarCell {
  date: string;
  isInMonth: boolean;
  labels: { text: string; kind: 'holiday' | 'event' | 'leave' | 'pending' }[];
}

@Component({
  selector: 'app-calendar-page',
  imports: [Icon],
  template: `
    <div class="page-view">
      <div class="page-title">
        <div>
          <span class="eyebrow">Company calendar</span>
          <h1>Holidays &amp; events</h1>
          <p>{{ showsTeamLeave() ? 'Public holidays, company dates and who ' + (scope() === 'company' ? 'at Opro' : 'on your team') + ' is away.' : 'Public holidays and important company dates in the Maldives.' }}</p>
        </div>
        <div class="calendar-nav">
          <button type="button" [attr.aria-label]="'Show ' + formatMonth(previous())" (click)="month.set(previous())" data-testid="previous-month"><app-icon name="chevronLeft" /></button>
          <strong aria-live="polite" data-testid="month-label">{{ formatMonth(month()) }}</strong>
          <button type="button" [attr.aria-label]="'Show ' + formatMonth(next())" (click)="month.set(next())" data-testid="next-month"><app-icon name="chevronRight" /></button>
        </div>
      </div>

      <div class="calendar-layout">
        <section class="card month-calendar" aria-label="Month calendar">
          <div class="weekdays" aria-hidden="true">
            @for (day of weekdays; track day) {
              <span>{{ day }}</span>
            }
          </div>
          <div class="calendar-days">
            @for (cell of cells(); track cell.date) {
              <div [class.muted]="!cell.isInMonth" [class.today]="cell.date === today" [attr.data-testid]="cell.isInMonth ? 'calendar-day' : null" [attr.aria-label]="formatWeekday(cell.date) + ' ' + formatShortDate(cell.date)">
                <span>{{ dayOfMonth(cell.date) }}</span>
                @for (label of cell.labels; track label.text) {
                  <small [class]="label.kind" [title]="label.kind === 'pending' ? label.text + ', waiting for approval' : label.text">{{ label.text }}</small>
                }
                @if (cell.date === today) {
                  <i aria-hidden="true"></i>
                }
              </div>
            }
          </div>
        </section>

        <aside class="calendar-side">
          <section class="card">
            <div class="card-heading">
              <div>
                <span class="eyebrow">Upcoming</span>
                <h2>Public holidays</h2>
              </div>
            </div>
            @for (holiday of upcoming(); track holiday.date) {
              <div class="holiday-list-item" data-testid="upcoming-holiday">
                <div class="date-box">
                  <b>{{ holiday.date.slice(8) }}</b>
                  <span>{{ monthShort(holiday) }}</span>
                </div>
                <div>
                  <strong>{{ holiday.name }}</strong>
                  <span>{{ formatWeekday(holiday.date) }} · {{ holiday.isTentative ? 'Tentative date' : 'Public holiday' }}</span>
                </div>
              </div>
            } @empty {
              <p class="attendance-off">No more holidays on the calendar yet.</p>
            }
          </section>
          <section class="card holiday-policy">
            <div class="policy-icon"><app-icon name="palm" /></div>
            <h3>Holiday policy</h3>
            <p>If a public holiday falls on your rest day, a replacement day will be scheduled.</p>
            <a class="text-link" [href]="company.policiesUrl">Read policy <app-icon name="arrow" [size]="15" /></a>
          </section>
        </aside>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarPage {
  private readonly api = inject(HolidaysApi);
  private readonly session = inject(Session);

  // Set from route data on the HOD's and the super admin's calendars.
  readonly showsTeamLeave = input(false);
  readonly scope = input<ViewScope>('team');

  protected readonly today = maldivesToday();
  protected readonly month = signal(monthOf(this.today));
  protected readonly previous = computed(() => addMonths(this.month(), -1));
  protected readonly next = computed(() => addMonths(this.month(), 1));

  private readonly shownYear = computed(() => String(yearOf(this.month())));
  private readonly holidays = this.api.forYear(this.shownYear);
  private readonly events = this.api.eventsForYear(this.shownYear);
  private readonly thisYearHolidays = this.api.forYear(() => String(yearOf(this.today)));
  private readonly nextYearHolidays = this.api.forYear(() => String(yearOf(this.today) + 1));
  private readonly teamLeave = inject(TeamApi).leaveRequests({
    isEnabled: () => this.showsTeamLeave() && (this.scope() === 'company' ? this.session.isSuperAdmin() : this.session.isManager()),
    scope: this.scope,
  });

  protected readonly cells = computed<CalendarCell[]>(() => {
    const first = `${this.month()}-01`;
    const last = addDays(`${this.next()}-01`, -1);
    const start = addDays(first, -weekdayOf(first));
    const end = addDays(last, DAYS_PER_WEEK - 1 - weekdayOf(last));
    const holidays = valueOr(this.holidays, []);
    const events = valueOr(this.events, []);
    const leave = valueOr(this.teamLeave, []).filter(({ status }) => status === 'approved' || status === 'pending');
    return datesBetween(start, end).map((date) => ({
      date,
      isInMonth: date >= first && date <= last,
      labels: [
        ...holidays.filter((holiday) => holiday.date === date).map(({ name }) => ({ text: name, kind: 'holiday' as const })),
        ...events.filter((event) => event.date === date).map(({ name }) => ({ text: name, kind: 'event' as const })),
        ...leave
          .filter(({ from, to }) => from <= date && to >= date && !WEEKDAYS_OFF.has(weekdayOf(date)))
          .map(({ employeeName, employeeId, status }) => ({ text: employeeName ?? employeeId, kind: status === 'pending' ? ('pending' as const) : ('leave' as const) })),
      ],
    }));
  });

  protected readonly upcoming = computed(() =>
    [...valueOr(this.thisYearHolidays, []), ...valueOr(this.nextYearHolidays, [])]
      .filter(({ date }) => date >= this.today)
      .sort((first, second) => first.date.localeCompare(second.date))
      .slice(0, UPCOMING_COUNT),
  );

  protected readonly company = COMPANY;
  protected readonly weekdays = WEEKDAYS;
  protected readonly monthShort = ({ date }: Holiday) => formatShortDate(date).split(' ')[1].slice(0, MONTH_LETTERS);
  protected readonly formatMonth = formatMonth;
  protected readonly formatWeekday = formatWeekday;
  protected readonly formatShortDate = formatShortDate;
  protected readonly dayOfMonth = dayOfMonth;
}
