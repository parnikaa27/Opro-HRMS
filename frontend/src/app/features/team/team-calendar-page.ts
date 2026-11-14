import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { WEEKEND_DAYS } from '../../core/config';
import { MonthSwitcher } from '../../shared/ui/month-switcher';
import { addDays, addMonths, datesBetween, dayOfMonth, formatDayShort, maldivesToday, monthOf, weekdayOf, yearOf } from '../../shared/utils/date-time';
import { valueOr } from '../../shared/utils/resource';
import { HolidaysApi } from '../holidays/holidays-api';
import { TeamApi } from './team-api';
import { ListSkeleton } from '../../shared/ui/list-skeleton';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

@Component({
  selector: 'app-team-calendar-page',
  imports: [ListSkeleton, MonthSwitcher],
  template: `
    <header class="mb-8">
      <h1 class="font-display text-3xl tracking-tight sm:text-4xl">Team calendar</h1>
      <p class="mt-2 text-soft">Who's away and when, with public holidays. Dashed names are still waiting for your decision.</p>
    </header>

    <app-month-switcher class="mb-4 block" [(month)]="month" />

    @if (leave.error()) {
      <p class="text-sm text-danger">Team leave didn't load. Refresh the page to try again.</p>
    } @else if (leave.isLoading()) {
      <app-list-skeleton [count]="4" />
    } @else {
      <div class="@container">
        <div class="hidden grid-cols-7 gap-px pb-2 text-center text-xs text-soft @3xl:grid" aria-hidden="true">
          @for (day of weekdays; track day) {
            <span>{{ day }}</span>
          }
        </div>
        <ol class="grid grid-cols-1 gap-2 @3xl:grid-cols-7 @3xl:gap-1.5">
          @for (blank of leadingBlanks(); track $index) {
            <li class="hidden @3xl:block" aria-hidden="true"></li>
          }
          @for (cell of cells(); track cell.date) {
            <li
              class="rounded-xl border border-line p-2.5 @3xl:min-h-24"
              [class]="cell.isBusy ? 'bg-card' : 'hidden bg-transparent @3xl:block'"
              [class.ring-2]="cell.date === today"
              [class.ring-sea]="cell.date === today"
              [attr.data-testid]="cell.isBusy ? 'calendar-day' : null"
            >
              <p class="text-xs" [class.text-soft]="cell.isWeekend">
                <span class="@3xl:hidden">{{ formatDayShort(cell.date) }}</span>
                <span class="hidden @3xl:inline">{{ dayOfMonth(cell.date) }}</span>
              </p>
              @if (cell.holiday) {
                <p class="mt-1.5 rounded-md bg-sea-soft px-1.5 py-0.5 text-xs text-sea">{{ cell.holiday }}</p>
              }
              @for (person of cell.people; track person.name) {
                <p
                  class="mt-1.5 truncate rounded-md px-1.5 py-0.5 text-xs"
                  [class]="person.isPending ? 'border border-dashed border-leave text-leave' : 'bg-leave-soft text-leave'"
                  [title]="person.name + (person.isPending ? ', waiting for your decision' : '')"
                >
                  {{ person.name }}
                </p>
              }
            </li>
          }
        </ol>
        @if (!hasAnything()) {
          <p class="mt-2 text-sm text-soft @3xl:hidden">Everyone's in all month.</p>
        }
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamCalendarPage {
  protected readonly today = maldivesToday();
  protected readonly month = signal(monthOf(this.today));

  protected readonly leave = inject(TeamApi).leaveRequests();
  private readonly holidays = inject(HolidaysApi).forYear(() => String(yearOf(this.month())));

  protected readonly leadingBlanks = computed(() => Array.from({ length: weekdayOf(`${this.month()}-01`) }));

  protected readonly cells = computed(() => {
    const requests = valueOr(this.leave, []).filter(({ status }) => status === 'approved' || status === 'pending');
    const holidays = new Map(valueOr(this.holidays, []).map(({ date, name }) => [date, name]));
    const lastOfMonth = addDays(`${addMonths(this.month(), 1)}-01`, -1);
    return datesBetween(`${this.month()}-01`, lastOfMonth).map((date) => {
      const isWeekend = WEEKEND_DAYS.includes(weekdayOf(date));
      const people = isWeekend
        ? []
        : requests
            .filter(({ from, to }) => from <= date && to >= date)
            .map(({ employeeName, employeeId, status }) => ({ name: employeeName ?? employeeId, isPending: status === 'pending' }));
      const holiday = holidays.get(date);
      return { date, isWeekend, holiday, people, isBusy: !!holiday || people.length > 0 };
    });
  });

  protected readonly hasAnything = computed(() => this.cells().some(({ isBusy }) => isBusy));
  protected readonly weekdays = WEEKDAYS;
  protected readonly formatDayShort = formatDayShort;
  protected readonly dayOfMonth = dayOfMonth;
}
