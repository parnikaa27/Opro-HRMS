import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { interval, map } from 'rxjs';
import { AttendanceStatus } from '../../models/attendance';
import { Card } from '../../shared/ui/card';
import { Icon } from '../../shared/ui/icon';
import { StatusPill } from '../../shared/ui/status-pill';
import { ATTENDANCE_STATUS } from '../../shared/utils/attendance-status';
import { formatDuration, formatTime, maldivesToday, minuteOfDay, minutesWorkedSoFar, monthOf } from '../../shared/utils/date-time';
import { AttendanceApi } from '../attendance/attendance-api';
import { valueOr } from '../../shared/utils/resource';

const TICK_MS = 60_000;
const AXIS_START = 420; // 07:00
const AXIS_END = 1140; // 19:00
const PERCENT = 100;
const AXIS_LABELS = ['07:00', '13:00', '19:00'];

const OFF_DAY: Partial<Record<AttendanceStatus, { title: string; body: string }>> = {
  weekend: { title: "It's the weekend", body: 'Friday and Saturday are off. See you on Sunday.' },
  holiday: { title: 'Public holiday', body: 'The office is closed today. Enjoy it.' },
  'on-leave': { title: "You're on leave today", body: 'Nothing to punch. Rest up.' },
  'not-in-yet': { title: 'Not in yet', body: 'Your punches show up here as soon as the device sends them.' },
};

const toAxis = (minute: number) => ((Math.min(Math.max(minute, AXIS_START), AXIS_END) - AXIS_START) / (AXIS_END - AXIS_START)) * PERCENT;

@Component({
  selector: 'app-today-card',
  imports: [Card, StatusPill, RouterLink, Icon],
  template: `
    <app-card label="Today" [isLoading]="attendance.isLoading()" [hasError]="!!attendance.error()">
      @if (record(); as day) {
        <app-status-pill cardAside [tone]="statusInfo(day.status).tone" data-testid="today-status">{{ statusInfo(day.status).label }}</app-status-pill>
      }

      @if (offDay(); as message) {
        <p class="mt-4 font-display text-2xl">{{ message.title }}</p>
        <p class="mt-1 text-sm text-soft">{{ message.body }}</p>
      } @else if (firstPunch(); as first) {
        <p class="mt-3 text-4xl font-medium tracking-tight" data-testid="today-worked">{{ formatDuration(worked()) }}</p>
        <p class="text-sm text-soft">
          @if (isInOffice()) {
            in the office so far, since {{ formatTime(first.at) }}
          } @else {
            worked today, last out at {{ formatTime(lastPunchAt()) }}
          }
        </p>

        <div class="relative mt-5 h-2 rounded-full bg-canvas" role="img" [attr.aria-label]="timelineLabel()">
          @for (segment of segments(); track segment.left) {
            <div class="absolute h-2 rounded-full bg-sea" [style.inset-inline-start.%]="segment.left" [style.width.%]="segment.width"></div>
          }
        </div>
        <div class="mt-1.5 flex justify-between text-xs text-soft" aria-hidden="true">
          @for (label of axisLabels; track label) {
            <span>{{ label }}</span>
          }
        </div>
      } @else {
        <p class="mt-4 font-display text-2xl">No punches yet</p>
        <p class="mt-1 text-sm text-soft">Your punches show up here as soon as the device sends them.</p>
      }

      <div class="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4 text-sm">
        <p class="text-soft" data-testid="month-summary">
          This month: {{ summary().onTime }} on time, {{ summary().late }} late, {{ summary().missed }} missed
        </p>
        <a routerLink="/attendance" class="inline-flex items-center gap-1 font-medium text-sea hover:underline">
          See attendance <app-icon name="arrow" class="size-4" />
        </a>
      </div>
    </app-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TodayCard {
  private readonly today = maldivesToday();
  private readonly now = toSignal(interval(TICK_MS).pipe(map(() => new Date())), { initialValue: new Date() });

  protected readonly attendance = inject(AttendanceApi).month(() => monthOf(this.today));
  protected readonly record = computed(() => valueOr(this.attendance, []).find((day) => day.date === this.today));
  protected readonly offDay = computed(() => {
    const status = this.record()?.status;
    return status ? OFF_DAY[status] : undefined;
  });
  protected readonly worked = computed(() => minutesWorkedSoFar(this.record()?.punches ?? [], this.now()));
  protected readonly firstPunch = computed(() => this.record()?.punches[0]);
  protected readonly lastPunchAt = computed(() => this.record()?.punches.at(-1)?.at ?? '');
  protected readonly isInOffice = computed(() => this.record()?.punches.at(-1)?.direction === 'in');

  protected readonly segments = computed(() => {
    const punches = this.record()?.punches ?? [];
    return punches.flatMap((punch, index) => {
      if (punch.direction !== 'in') {
        return [];
      }
      const end = punches[index + 1]?.at ?? this.now().toISOString();
      const left = toAxis(minuteOfDay(punch.at));
      return [{ left, width: toAxis(minuteOfDay(end)) - left }];
    });
  });

  protected readonly timelineLabel = computed(() =>
    `Punches today: ${(this.record()?.punches ?? []).map((punch) => `${punch.direction} at ${formatTime(punch.at)}`).join(', ')}`,
  );

  protected readonly summary = computed(() => {
    const days = valueOr(this.attendance, []);
    const count = (statuses: AttendanceStatus[]) => days.filter((day) => statuses.includes(day.status)).length;
    return { onTime: count(['present']), late: count(['late', 'half-day']), missed: count(['absent', 'incomplete']) };
  });

  protected readonly axisLabels = AXIS_LABELS;
  protected readonly statusInfo = (status: AttendanceStatus) => ATTENDANCE_STATUS[status];
  protected readonly formatDuration = formatDuration;
  protected readonly formatTime = formatTime;
}
