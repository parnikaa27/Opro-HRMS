import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { AttendanceDay, AttendanceStatus, CorrectionRequest } from '../../models/attendance';
import { StatusPill } from '../../shared/ui/status-pill';
import { ATTENDANCE_STATUS } from '../../shared/utils/attendance-status';
import { formatDayShort, formatDuration, formatTime } from '../../shared/utils/date-time';

const QUIET: readonly AttendanceStatus[] = ['weekend', 'holiday', 'on-leave'];
const FIXABLE: Partial<Record<AttendanceStatus, CorrectionRequest['kind']>> = { incomplete: 'missed-out', absent: 'missed-in' };

export interface FixRequest {
  date: string;
  kind: CorrectionRequest['kind'];
}

@Component({
  selector: 'app-attendance-days',
  imports: [StatusPill],
  template: `
    <ol class="divide-y divide-line rounded-2xl border border-line bg-card shadow-lift">
      @for (day of days(); track day.date) {
        <li
          class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-3.5 sm:grid-cols-[7rem_8rem_minmax(0,1fr)_5rem]"
          [class.text-soft]="isQuiet(day)"
          data-testid="attendance-day"
        >
          <span class="font-medium" [class.font-normal]="isQuiet(day)">{{ formatDayShort(day.date) }}</span>
          <app-status-pill class="justify-self-end sm:justify-self-start" [tone]="statusOf(day).tone">{{ statusOf(day).label }}</app-status-pill>
          @if (!isQuiet(day)) {
            <span class="text-sm text-soft">{{ punchSummary(day) }}</span>
            <span class="text-sm sm:text-end">{{ day.workedMinutes ? formatDuration(day.workedMinutes) : '' }}</span>
          }
          @if (!isReadOnly() && fixKind(day); as kind) {
            <button type="button" class="col-span-full justify-self-start text-sm font-medium text-sea hover:underline sm:col-start-3" (click)="fix.emit({ date: day.date, kind })" data-testid="fix-day">
              Fix this day
            </button>
          }
        </li>
      } @empty {
        <li class="px-5 py-4 text-sm text-soft">Nothing recorded for this month.</li>
      }
    </ol>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AttendanceDays {
  readonly days = input.required<readonly AttendanceDay[]>();
  readonly isReadOnly = input(false);
  readonly fix = output<FixRequest>();

  protected readonly isQuiet = (day: AttendanceDay) => QUIET.includes(day.status);
  protected readonly statusOf = (day: AttendanceDay) => ATTENDANCE_STATUS[day.status];
  protected readonly fixKind = (day: AttendanceDay) => FIXABLE[day.status];
  protected readonly punchSummary = (day: AttendanceDay) =>
    day.punches.length ? day.punches.map((punch) => `${formatTime(punch.at)} ${punch.direction}`).join(', ') : 'No punches';
  protected readonly formatDayShort = formatDayShort;
  protected readonly formatDuration = formatDuration;
}
