import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { WEEKEND_DAYS } from '../../core/config';
import { AttendanceDay, AttendanceStatus } from '../../models/attendance';
import { MonthSwitcher } from '../../shared/ui/month-switcher';
import { Tone } from '../../shared/ui/status-pill';
import { ATTENDANCE_STATUS } from '../../shared/utils/attendance-status';
import { addDays, addMonths, datesBetween, dayOfMonth, formatDayShort, maldivesToday, monthOf, weekdayOf } from '../../shared/utils/date-time';
import { valueOr } from '../../shared/utils/resource';
import { TeamApi } from './team-api';
import { ListSkeleton } from '../../shared/ui/list-skeleton';

const DOT: Record<Tone, string> = {
  ok: 'bg-ok',
  late: 'bg-late',
  danger: 'bg-danger',
  leave: 'bg-leave',
  sea: 'bg-sea/40',
  neutral: 'bg-line',
};

const LEGEND: readonly { tone: Tone; label: string }[] = [
  { tone: 'ok', label: 'On time' },
  { tone: 'late', label: 'Late or half day' },
  { tone: 'danger', label: 'Absent or missing punch' },
  { tone: 'leave', label: 'On leave' },
  { tone: 'sea', label: 'Holiday' },
  { tone: 'neutral', label: 'Weekend' },
];

const LATE: ReadonlySet<AttendanceStatus> = new Set(['late', 'half-day']);
const MISSED: ReadonlySet<AttendanceStatus> = new Set(['absent', 'incomplete']);

interface Row {
  id: string;
  name: string;
  days: Map<string, AttendanceDay>;
  late: number;
  missed: number;
}

@Component({
  selector: 'app-team-attendance-page',
  imports: [ListSkeleton, MonthSwitcher, RouterLink],
  template: `
    <header class="mb-8">
      <h1 class="font-display text-3xl tracking-tight sm:text-4xl">Team attendance</h1>
      <p class="mt-2 text-soft">One row per person, one dot per day. Hover a dot for the details.</p>
    </header>

    <app-month-switcher class="mb-4 block" [(month)]="month" [latest]="currentMonth" />

    @if (attendance.error()) {
      <p class="text-sm text-danger">Team attendance didn't load. Refresh the page to try again.</p>
    } @else if (attendance.isLoading() && rows().length === 0) {
      <app-list-skeleton [count]="5" />
    } @else {
      <div class="overflow-x-auto rounded-2xl border border-line bg-card shadow-lift">
        <table class="w-full border-collapse text-sm" [attr.aria-busy]="attendance.isLoading()">
          <caption class="sr-only">Attendance for each person by day</caption>
          <thead>
            <tr class="text-xs text-soft">
              <th scope="col" class="sticky start-0 bg-card px-4 py-3 text-start font-medium">Person</th>
              @for (date of dates(); track date) {
                <th scope="col" class="px-1 py-3 text-center font-normal" [class.text-line]="isWeekend(date)" [attr.aria-label]="formatDayShort(date)">
                  {{ dayOfMonth(date) }}
                </th>
              }
              <th scope="col" class="px-3 py-3 text-end font-medium">Late</th>
              <th scope="col" class="px-4 py-3 text-end font-medium">Missed</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.id) {
              <tr class="border-t border-line" data-testid="team-attendance-row">
                <th scope="row" class="sticky start-0 bg-card px-4 py-2.5 text-start font-medium whitespace-nowrap">
                  <a [routerLink]="['/team', row.id]" class="hover:underline">{{ row.name }}</a>
                </th>
                @for (date of dates(); track date) {
                  <td class="px-1 py-2.5 text-center">
                    @if (row.days.get(date); as day) {
                      <span class="mx-auto block size-3 rounded-[3px]" [class]="dotFor(day)" [title]="formatDayShort(date) + ': ' + labelFor(day)"></span>
                      <span class="sr-only">{{ formatDayShort(date) }}: {{ labelFor(day) }}</span>
                    }
                  </td>
                }
                <td class="px-3 py-2.5 text-end" [class.text-late]="row.late > 0">{{ row.late }}</td>
                <td class="px-4 py-2.5 text-end" [class.text-danger]="row.missed > 0">{{ row.missed }}</td>
              </tr>
            } @empty {
              <tr>
                <td class="px-4 py-4 text-soft" [attr.colspan]="dates().length + 3">Nothing recorded for this month.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <ul class="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-soft" aria-label="Legend">
        @for (item of legend; track item.tone) {
          <li class="flex items-center gap-2"><span class="size-3 rounded-[3px]" [class]="dot[item.tone]"></span>{{ item.label }}</li>
        }
      </ul>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamAttendancePage {
  private readonly today = maldivesToday();
  protected readonly currentMonth = monthOf(this.today);
  protected readonly month = signal(this.currentMonth);
  protected readonly attendance = inject(TeamApi).attendance(this.month);

  protected readonly dates = computed(() => {
    const lastOfMonth = addDays(`${addMonths(this.month(), 1)}-01`, -1);
    return datesBetween(`${this.month()}-01`, lastOfMonth < this.today ? lastOfMonth : this.today);
  });

  protected readonly rows = computed<Row[]>(() => {
    const records = valueOr(this.attendance, []);
    const ids = [...new Set(records.map(({ employeeId }) => employeeId))];
    return ids
      .map((id) => {
        const days = records.filter(({ employeeId }) => employeeId === id);
        return {
          id,
          name: days[0]?.employeeName ?? id,
          days: new Map(days.map((day) => [day.date, day])),
          late: days.filter(({ status }) => LATE.has(status)).length,
          missed: days.filter(({ status }) => MISSED.has(status)).length,
        };
      })
      .sort((first, second) => first.name.localeCompare(second.name));
  });

  protected readonly dot = DOT;
  protected readonly legend = LEGEND;
  protected readonly dotFor = (day: AttendanceDay) => DOT[ATTENDANCE_STATUS[day.status].tone];
  protected readonly labelFor = (day: AttendanceDay) => ATTENDANCE_STATUS[day.status].label;
  protected readonly isWeekend = (date: string) => WEEKEND_DAYS.includes(weekdayOf(date));
  protected readonly formatDayShort = formatDayShort;
  protected readonly dayOfMonth = dayOfMonth;
}
