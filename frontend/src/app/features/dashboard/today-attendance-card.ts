import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { interval, map } from 'rxjs';
import { CompanyApi } from '../../core/company-api';
import { AttendanceDay, AttendanceStatus } from '../../models/attendance';
import { CircleProgress } from '../../shared/ui/circle-progress';
import { Icon } from '../../shared/ui/icon';
import { ListSkeleton } from '../../shared/ui/list-skeleton';
import { formatClock, formatDuration, minutesAgo, minutesWorkedSoFar } from '../../shared/utils/date-time';
import { valueOr } from '../../shared/utils/resource';
import { plural } from '../../shared/utils/text';

const TICK_MS = 60_000;
const PERCENT = 100;
const MINUTES_PER_HOUR = 60;

const OFF_DAY: Partial<Record<AttendanceStatus, { title: string; body: string }>> = {
  weekend: { title: 'Enjoy your weekend', body: 'Friday and Saturday are off. See you on Sunday.' },
  holiday: { title: 'Public holiday today', body: 'The office is closed. Enjoy it.' },
  'on-leave': { title: "You're on leave today", body: 'Nothing to punch. Rest up.' },
  absent: { title: 'No punches today', body: 'If the device missed you, ask for a punch fix.' },
};

@Component({
  selector: 'app-today-attendance-card',
  imports: [CircleProgress, Icon, ListSkeleton, RouterLink],
  template: `
    <section class="attendance-hero card" data-testid="today-card">
      <div class="card-heading">
        <div>
          <span class="eyebrow">TODAY’S ATTENDANCE</span>
          <h2 data-testid="today-heading">{{ heading() }}</h2>
        </div>
        @if (syncLabel(); as label) {
          <div class="synced"><i></i>{{ label }}</div>
        }
      </div>

      @if (hasFailed()) {
        <p class="attendance-off"><strong>Today's punches didn't load</strong>Refresh the page to try again.</p>
      } @else if (isLoading() && !day()) {
        <app-list-skeleton [count]="1" />
      } @else if (offDay(); as message) {
        <p class="attendance-off"><strong>{{ message.title }}</strong>{{ message.body }}</p>
      } @else if (firstIn(); as first) {
        <div class="attendance-body">
          <app-circle-progress [percent]="percent()" [label]="formatDuration(elapsed())" [sub]="shiftLabel()" />
          <div class="punch-timeline">
            <div class="timeline-line"><i></i><i></i></div>
            <div>
              <span>PUNCH IN</span>
              <strong data-testid="punch-in">{{ formatClock(first.at) }}</strong>
              <small>{{ first.device ?? 'Biometric' }} device</small>
            </div>
            @if (lastOut(); as out) {
              <div>
                <span>PUNCH OUT</span>
                <strong>{{ formatClock(out.at) }}</strong>
                <small>{{ out.device ?? 'Biometric' }} device</small>
              </div>
            } @else if (day()?.expectedOut; as expected) {
              <div>
                <span>EXPECTED OUT</span>
                <strong>{{ formatClock(expected) }}</strong>
                <small>{{ remainingLabel() }}</small>
              </div>
            }
          </div>
          <div class="work-metric">
            <app-icon name="timer" />
            <div>
              <span>Effective hours</span>
              <strong data-testid="effective-hours">{{ formatDuration(effective()) }}</strong>
            </div>
          </div>
        </div>
      } @else {
        <p class="attendance-off"><strong>Not punched in yet</strong>Your punches show up here as soon as the device sends them.</p>
      }

      <a routerLink="/attendance" class="text-link">View attendance details <app-icon name="arrow" [size]="15" /></a>
    </section>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TodayAttendanceCard {
  readonly day = input<AttendanceDay>();
  readonly workLocation = input.required<string>();
  // Without these, a failed or slow load would read as "you haven't punched in yet", which isn't true.
  readonly isLoading = input(false);
  readonly hasFailed = input(false);

  private readonly now = toSignal(interval(TICK_MS).pipe(map(() => new Date())), { initialValue: new Date() });
  private readonly devices = inject(CompanyApi).devices();

  protected readonly offDay = computed(() => {
    const status = this.day()?.status;
    return status ? OFF_DAY[status] : undefined;
  });
  protected readonly firstIn = computed(() => this.day()?.punches[0]);
  protected readonly lastOut = computed(() => {
    const last = this.day()?.punches.at(-1);
    return last?.direction === 'out' ? last : undefined;
  });

  protected readonly heading = computed(() => {
    if (this.hasFailed() || (this.isLoading() && !this.day())) {
      return 'Today';
    }
    const status = this.day()?.status;
    if (status === 'weekend' || status === 'holiday' || status === 'on-leave') {
      return 'Not a working day';
    }
    if (!this.firstIn()) {
      return 'You haven’t punched in yet';
    }
    return this.lastOut() ? 'You’ve finished for the day' : 'You’re in the office';
  });

  protected readonly elapsed = computed(() => {
    const first = this.firstIn();
    const end = this.lastOut()?.at;
    return first ? minutesAgo(first.at, end ? new Date(end) : this.now()) : 0;
  });
  protected readonly effective = computed(() => minutesWorkedSoFar(this.day()?.punches ?? [], this.now()));
  // The backend sends the shift that applied that day, so a schedule change shows up without a frontend release.
  private readonly shiftMinutes = computed(() => this.day()?.scheduledMinutes ?? 0);
  protected readonly percent = computed(() => (this.shiftMinutes() ? (this.elapsed() / this.shiftMinutes()) * PERCENT : 0));
  protected readonly shiftLabel = computed(() => (this.shiftMinutes() ? `of ${plural(this.shiftMinutes() / MINUTES_PER_HOUR, 'hour')}` : ''));
  protected readonly remainingLabel = computed(() => {
    const left = Math.round((new Date(this.day()?.expectedOut ?? this.now()).getTime() - this.now().getTime()) / TICK_MS);
    return left > 0 ? `${formatDuration(left)} remaining` : `${formatDuration(-left)} past your shift`;
  });

  protected readonly syncLabel = computed(() => {
    const device = valueOr(this.devices, []).find(({ location }) => location === this.workLocation());
    if (!device) {
      return undefined;
    }
    return device.isOnline ? `Biometric synced · ${minutesAgo(device.lastSyncAt, this.now())} min ago` : 'Biometric device offline';
  });

  protected readonly formatClock = formatClock;
  protected readonly formatDuration = formatDuration;
}
