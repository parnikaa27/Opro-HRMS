import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { WEEKEND_DAYS } from '../../core/config';
import { Session } from '../../core/session';
import { AttendanceStatus } from '../../models/attendance';
import { LeaveRequest } from '../../models/leave';
import { Avatar } from '../../shared/ui/avatar';
import { Dialog } from '../../shared/ui/dialog';
import { Icon } from '../../shared/ui/icon';
import { StatusPill } from '../../shared/ui/status-pill';
import { WelcomeBanner } from '../../shared/ui/welcome-banner';
import { ATTENDANCE_STATUS } from '../../shared/utils/attendance-status';
import { downloadCsv } from '../../shared/utils/csv';
import { addDays, addMonths, datesBetween, formatBannerDate, formatClock, formatShortDate, maldivesHour, maldivesToday, monthOf, weekdayOf } from '../../shared/utils/date-time';
import { valueOr } from '../../shared/utils/resource';
import { plural } from '../../shared/utils/text';
import { summarise } from '../attendance/attendance-summary';
import { greetingFor } from '../dashboard/dashboard-page';
import { LeaveApi } from '../leave/leave-api';
import { describeDates, describeLength } from '../leave/leave-format';
import { DecisionState } from './decision-state';
import { DeclineForm } from './decline-form';
import { TeamApi, TeamMember } from './team-api';
import { visaAlertsFor } from './visa-alerts';

const PREVIEW_COUNT = 3;
const TEAM_PREVIEW = 4;
const PERCENT = 100;
const CHART_SECTIONS = 3;
const IN_OFFICE: readonly AttendanceStatus[] = ['present', 'late', 'half-day', 'incomplete'];
const OFF: readonly AttendanceStatus[] = ['weekend', 'holiday'];

const statusOf = (member: TeamMember): AttendanceStatus => member.today?.status ?? 'not-in-yet';

@Component({
  selector: 'app-team-overview-page',
  imports: [Avatar, DeclineForm, Dialog, Icon, RouterLink, StatusPill, WelcomeBanner],
  template: `
    <app-welcome-banner [dateLabel]="dateLabel" [heading]="greeting + ', ' + firstName() + '.'" [line]="line()" />

    <div class="manager-stats">
      <div class="stat-card">
        <div class="stat-icon aqua"><app-icon name="users" /></div>
        <div>
          <span>TEAM MEMBERS</span>
          <strong data-testid="stat-members">{{ members().length }}</strong>
          <small><i></i> {{ checkedIn() }} checked in</small>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon amber"><app-icon name="clock" /></div>
        <div>
          <span>PENDING REQUESTS</span>
          <strong data-testid="stat-pending">{{ pendingCount() }}</strong>
          <small>{{ pendingCount() ? 'Needs your review' : 'All caught up' }}</small>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon violet"><app-icon name="fingerprint" /></div>
        <div>
          <span>AVG. ATTENDANCE</span>
          <strong data-testid="stat-attendance">{{ thisMonthPercent() }}%</strong>
          <small><i></i> {{ changeLabel() }}</small>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon coral"><app-icon name="plane" /></div>
        <div>
          <span>OUT OF OFFICE</span>
          <strong data-testid="stat-away">{{ awayCount() }}</strong>
          <small>Today</small>
        </div>
      </div>
    </div>

    <div class="manager-grid">
      <section class="card requests-section">
        <div class="card-heading">
          <div>
            <span class="eyebrow">ACTION NEEDED</span>
            <h2>Leave requests</h2>
          </div>
          <a routerLink="/team/approvals" class="text-link">View all <app-icon name="arrow" [size]="15" /></a>
        </div>
        <div class="request-list">
          @for (request of preview(); track request.id) {
            <div class="request-item" data-testid="pending-leave">
              <app-avatar [name]="request.employeeName ?? ''" />
              <div class="request-person">
                <strong>{{ request.employeeName }}</strong>
                <span>{{ typeName(request.type) }} · {{ request.reason }}</span>
              </div>
              <div class="request-dates">
                <strong>{{ describeDates(request) }}</strong>
                <span>{{ describeLength(request) }}</span>
              </div>
              <div class="request-actions">
                <button type="button" class="decline" title="Decline" [attr.aria-label]="'Decline ' + request.employeeName + '’s request'" [disabled]="decisions.busyId() === request.id" (click)="declining.set(request)" data-testid="reject"><app-icon name="x" [size]="17" /></button>
                <button type="button" class="approve" title="Approve" [attr.aria-label]="'Approve ' + request.employeeName + '’s request'" [disabled]="decisions.busyId() === request.id" (click)="approve(request)" data-testid="approve"><app-icon name="check" [size]="17" /></button>
              </div>
            </div>
            @if (decisions.failedId() === request.id) {
              <p class="row-error" role="alert">That didn't save. Try again in a moment.</p>
            }
          } @empty {
            <p class="attendance-off">Nothing waiting for you. Enjoy the quiet.</p>
          }
        </div>
      </section>

      <section class="card team-section">
        <div class="card-heading">
          <div>
            <span class="eyebrow">LIVE STATUS</span>
            <h2>Team today</h2>
          </div>
          <span class="live-dot"><i></i> Live</span>
        </div>
        <div class="team-list">
          @for (member of teamPreview(); track member.id) {
            <div data-testid="team-member">
              <app-avatar [name]="member.fullName" />
              <div>
                <strong>{{ member.fullName }}</strong>
                <span>{{ member.designation }}</span>
              </div>
              <div class="team-status">
                <app-status-pill [tone]="info(member).tone">{{ info(member).label }}</app-status-pill>
                <small>{{ timeNote(member) }}</small>
              </div>
            </div>
          } @empty {
            <p class="attendance-off">Nobody reports to you yet.</p>
          }
        </div>
        <a routerLink="/team/people" class="secondary-button">View all team members</a>
      </section>
    </div>

    <div class="manager-grid bottom">
      <section class="card team-attendance">
        <div class="card-heading">
          <div>
            <span class="eyebrow">THIS MONTH</span>
            <h2>Attendance overview</h2>
          </div>
          <button type="button" class="download-button" (click)="exportReport()" data-testid="export-report"><app-icon name="download" [size]="16" /> Export report</button>
        </div>
        <div class="chart-area" role="img" [attr.aria-label]="'Daily attendance this month, averaging ' + thisMonthPercent() + '%'">
          @for (bar of bars(); track bar.date) {
            <i [style.height.%]="bar.isFuture ? 4 : bar.percent" [class.today]="bar.date === today" [class.future]="bar.isFuture" [title]="formatShortDate(bar.date) + (bar.isFuture ? '' : ': ' + bar.percent + '%')"></i>
          }
        </div>
        <div class="chart-labels" aria-hidden="true">
          @for (label of chartLabels(); track $index) {
            <span>{{ label }}</span>
          }
        </div>
      </section>

      <section class="card visa-alerts">
        <div class="card-heading">
          <div>
            <span class="eyebrow">COMPLIANCE</span>
            <h2>Visa alerts</h2>
          </div>
          @if (visaAlerts().length) {
            <span class="alert-count">{{ visaAlerts().length }}</span>
          }
        </div>
        @for (alert of visaAlerts(); track alert.id) {
          <div class="visa-alert" data-testid="visa-alert">
            <app-avatar [name]="alert.name" />
            <div>
              <strong>{{ alert.name }}</strong>
              <span>{{ alert.detail }}</span>
            </div>
            <b>{{ alert.days }}</b>
          </div>
        } @empty {
          <p class="attendance-off">No visas or passports need attention.</p>
        }
        <a routerLink="/team/people" class="text-link">View visa records <app-icon name="arrow" [size]="15" /></a>
      </section>
    </div>

    <app-dialog heading="Decline request" [isOpen]="declining() !== undefined" (isOpenChange)="$event || declining.set(undefined)">
      @if (declining(); as request) {
        <app-decline-form [name]="request.employeeName ?? ''" (declined)="decline(request, $event)" (cancelled)="declining.set(undefined)" />
      }
    </app-dialog>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamOverviewPage {
  private readonly session = inject(Session);
  private readonly api = inject(TeamApi);
  protected readonly today = maldivesToday();

  private readonly team = this.api.members();
  private readonly pendingLeave = this.api.leaveRequests({ status: 'pending' });
  private readonly pendingFixes = this.api.corrections({ status: 'pending' });
  private readonly thisMonth = this.api.attendance(() => monthOf(this.today));
  private readonly lastMonth = this.api.attendance(() => addMonths(monthOf(this.today), -1));
  private readonly types = inject(LeaveApi).types();
  protected readonly decisions = new DecisionState();
  protected readonly declining = signal<LeaveRequest | undefined>(undefined);

  protected readonly greeting = greetingFor(maldivesHour());
  protected readonly dateLabel = formatBannerDate(this.today).toUpperCase();
  protected readonly firstName = computed(() => this.session.user()?.fullName.split(' ')[0] ?? '');

  protected readonly members = computed(() => [...valueOr(this.team, [])].sort((first, second) => first.fullName.localeCompare(second.fullName)));
  protected readonly checkedIn = computed(() => this.members().filter((member) => IN_OFFICE.includes(statusOf(member))).length);
  protected readonly awayCount = computed(() => this.members().filter((member) => statusOf(member) === 'on-leave').length);
  protected readonly line = computed(() => {
    const total = this.members().length;
    if (total > 0 && this.members().every((member) => OFF.includes(statusOf(member)))) {
      return 'Nobody’s expected in today. Here’s what’s waiting for you.';
    }
    const opener = total > 0 && this.checkedIn() === total ? 'Your whole team is in.' : 'Your team is looking good today.';
    return `${opener} ${this.checkedIn()} of ${plural(total, 'person', 'people')} are checked in.`;
  });

  private readonly leaveWaiting = computed(() =>
    [...valueOr(this.pendingLeave, [])].sort((first, second) => first.appliedOn.localeCompare(second.appliedOn)),
  );
  protected readonly preview = computed(() => this.leaveWaiting().slice(0, PREVIEW_COUNT));
  protected readonly pendingCount = computed(() => this.leaveWaiting().length + valueOr(this.pendingFixes, []).length);
  protected readonly teamPreview = computed(() => this.members().slice(0, TEAM_PREVIEW));

  protected readonly thisMonthPercent = computed(
    () => summarise(valueOr(this.thisMonth, []).filter(({ date }) => date <= this.today)).attendancePercent,
  );
  protected readonly changeLabel = computed(() => {
    const change = this.thisMonthPercent() - summarise(valueOr(this.lastMonth, [])).attendancePercent;
    return `${change >= 0 ? '+' : ''}${change} pts on last month`;
  });

  // Every working day of the month, so the labels line up. Days still to come are faint placeholders.
  protected readonly bars = computed(() => {
    const total = this.members().length;
    const month = monthOf(this.today);
    const workdays = datesBetween(`${month}-01`, addDays(`${addMonths(month, 1)}-01`, -1)).filter((date) => !WEEKEND_DAYS.includes(weekdayOf(date)));
    const days = valueOr(this.thisMonth, []);
    return workdays.map((date) => {
      const present = days.filter((day) => day.date === date && IN_OFFICE.includes(day.status)).length;
      const isHoliday = days.some((day) => day.date === date && day.status === 'holiday');
      return { date, present, isFuture: date > this.today || isHoliday, percent: total > 0 && date <= this.today ? Math.round((present / total) * PERCENT) : 0 };
    });
  });
  protected readonly chartLabels = computed(() => {
    const bars = this.bars();
    const step = Math.floor(bars.length / CHART_SECTIONS);
    const last = bars.at(-1);
    return last ? [...Array.from({ length: CHART_SECTIONS }, (_, index) => bars[index * step]), last].map(({ date }) => formatShortDate(date)) : [];
  });

  protected readonly visaAlerts = computed(() => visaAlertsFor(this.members(), this.today));

  protected readonly info = (member: TeamMember) => ATTENDANCE_STATUS[statusOf(member)];
  protected readonly timeNote = ({ today }: TeamMember) => {
    if (today?.status === 'on-leave') {
      return 'All day';
    }
    const first = today?.punches[0];
    return first ? formatClock(first.at) : '';
  };
  protected readonly typeName = (code: string) => valueOr(this.types, []).find((type) => type.code === code)?.name ?? code;
  protected readonly describeDates = describeDates;
  protected readonly describeLength = describeLength;
  protected readonly formatShortDate = formatShortDate;

  protected approve({ id }: LeaveRequest) {
    return this.decisions.run(id, () => this.api.decideLeave(id, { decision: 'approved' }), () => this.pendingLeave.reload());
  }

  protected decline({ id }: LeaveRequest, note: string) {
    this.declining.set(undefined);
    return this.decisions.run(id, () => this.api.decideLeave(id, { decision: 'rejected', note }), () => this.pendingLeave.reload());
  }

  protected exportReport() {
    downloadCsv(`team-attendance-${monthOf(this.today)}.csv`, [
      ['Date', 'People in', 'Team size', 'Attendance %'],
      ...this.bars()
        .filter(({ isFuture }) => !isFuture)
        .map(({ date, present, percent }) => [date, present, this.members().length, percent]),
    ]);
  }
}
