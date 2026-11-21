import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { OvertimeClaim } from '../../models/attendance';
import { formatDuration } from '../../shared/utils/date-time';
import { plural } from '../../shared/utils/text';
import { AttendanceSummary } from './attendance-summary';

@Component({
  selector: 'app-summary-row',
  template: `
    <div class="summary-row">
      <div class="card metric">
        <span>Days present</span>
        <strong data-testid="metric-present">{{ summary().present }} <small>/ {{ summary().workingDays }}</small></strong>
        <p><i></i> {{ summary().attendancePercent }}% attendance</p>
      </div>
      <div class="card metric">
        <span>Total work hours</span>
        <strong data-testid="metric-hours">{{ formatDuration(summary().workedMinutes) }}</strong>
        <p>{{ formatDuration(summary().averageMinutes) }} daily average</p>
      </div>
      <div class="card metric">
        <span>On time arrival</span>
        <strong data-testid="metric-on-time">{{ summary().onTimePercent }}%</strong>
        <p>{{ plural(summary().lateCount, 'late arrival') }}</p>
      </div>
      <div class="card metric">
        <span>Overtime</span>
        <strong data-testid="metric-overtime">{{ formatDuration(overtime().minutes) }}</strong>
        <p data-testid="metric-overtime-line">{{ overtime().line }}</p>
      </div>
    </div>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SummaryRow {
  readonly summary = input.required<AttendanceSummary>();
  // Someone's own overtime that month, with where each day stands. Left out, the card shows what the punches say.
  readonly overtimeClaims = input<readonly OvertimeClaim[]>();

  // Declined days don't count. Approved and waiting are told apart.
  protected readonly overtime = computed(() => {
    const claims = this.overtimeClaims();
    if (!claims) {
      return { minutes: this.summary().overtimeMinutes, line: `Across ${plural(this.summary().overtimeDays, 'workday')}` };
    }
    const minutesOf = (status: OvertimeClaim['status']) => claims.filter((claim) => claim.status === status).reduce((sum, { minutes }) => sum + minutes, 0);
    const approved = minutesOf('approved');
    const waiting = minutesOf('pending');
    return { minutes: approved + waiting, line: `${formatDuration(approved)} approved, ${formatDuration(waiting)} waiting` };
  });
  protected readonly formatDuration = formatDuration;
  protected readonly plural = plural;
}
