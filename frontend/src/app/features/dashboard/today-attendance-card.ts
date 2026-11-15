import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { interval, map } from 'rxjs';
import { AttendanceDay, AttendanceStatus, WorkMode } from '../../models/attendance';
import { CircleProgress } from '../../shared/ui/circle-progress';
import { Icon } from '../../shared/ui/icon';
import { ListSkeleton } from '../../shared/ui/list-skeleton';
import { formatClock, formatDuration, minutesAgo, minutesWorkedSoFar } from '../../shared/utils/date-time';
import { plural } from '../../shared/utils/text';
import { PunchButton } from '../attendance/punch-button';

const TICK_MS = 60_000;
const PERCENT = 100;
const MINUTES_PER_HOUR = 60;

const OFF_DAY: Partial<Record<AttendanceStatus, { title: string; body: string }>> = {
  weekend: { title: 'Enjoy your Friday', body: 'Friday is the day off. See you on Saturday.' },
  holiday: { title: 'Public holiday today', body: 'The office is closed. Enjoy it.' },
  'on-leave': { title: "You're on leave today", body: 'Nothing to punch. Rest up.' },
  absent: { title: 'No punches today', body: 'If you forgot to punch, ask for a punch fix.' },
};

const WHERE: Record<WorkMode, string> = {
  office: 'You’re in the office',
  resort: 'You’re at a resort',
  home: 'You’re working from home',
};

const HOME_NOTE = {
  pending: 'Working from home. Waiting for your manager to approve the day.',
  approved: 'Working from home. Your manager approved the day.',
  rejected: 'Your manager didn’t approve working from home today, so it counts as absent.',
};

@Component({
  selector: 'app-today-attendance-card',
  imports: [CircleProgress, Icon, ListSkeleton, PunchButton, RouterLink],
  template: `
    <section class="attendance-hero card" data-testid="today-card">
      <div class="card-heading">
        <div>
          <span class="eyebrow">TODAY’S ATTENDANCE</span>
          <h2 data-testid="today-heading">{{ heading() }}</h2>
        </div>
        @if (day() && !hasFailed()) {
          <app-punch-button [day]="day()" (punched)="punched.emit($event)" />
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
              <small>{{ first.device ?? 'Added by hand' }}</small>
            </div>
            @if (lastOut(); as out) {
              <div>
                <span>PUNCH OUT</span>
                <strong>{{ formatClock(out.at) }}</strong>
                <small>{{ out.device ?? 'Added by hand' }}</small>
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
        <p class="attendance-off"><strong>Not punched in yet</strong>Punch in when you start. From the office, the portal checks you're there.</p>
      }
      @if (homeNote(); as note) {
        <p class="home-note" data-testid="home-note"><app-icon name="house" [size]="16" /> {{ note }}</p>
      }

      <a routerLink="/attendance" class="text-link">View attendance details <app-icon name="arrow" [size]="15" /></a>
    </section>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TodayAttendanceCard {
  readonly day = input<AttendanceDay>();
  // Without these, a failed or slow load would read as "you haven't punched in yet", which isn't true.
  readonly isLoading = input(false);
  readonly hasFailed = input(false);
  readonly punched = output<AttendanceDay>();

  private readonly now = toSignal(interval(TICK_MS).pipe(map(() => new Date())), { initialValue: new Date() });
  // Punches on a weekend or a holiday still show. A declined home day has punches but counts as absent.
  protected readonly offDay = computed(() => {
    const day = this.day();
    return day && day.punches.length === 0 ? OFF_DAY[day.status] : undefined;
  });
  protected readonly homeNote = computed(() => {
    const status = this.day()?.homeStatus;
    return status ? HOME_NOTE[status] : undefined;
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
    if (this.lastOut()) {
      return 'You’ve finished for the day';
    }
    return WHERE[this.day()?.workMode ?? 'office'];
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

  protected readonly formatClock = formatClock;
  protected readonly formatDuration = formatDuration;
}
