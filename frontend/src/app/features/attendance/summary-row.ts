import { ChangeDetectionStrategy, Component, input } from '@angular/core';
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
    </div>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SummaryRow {
  readonly summary = input.required<AttendanceSummary>();
  protected readonly formatDuration = formatDuration;
  protected readonly plural = plural;
}
