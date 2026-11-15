import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Avatar } from '../../shared/ui/avatar';
import { Icon } from '../../shared/ui/icon';
import { ListSkeleton } from '../../shared/ui/list-skeleton';
import { MonthPicker } from '../../shared/ui/month-picker';
import { StatusPill } from '../../shared/ui/status-pill';
import { statusToday } from '../../shared/utils/attendance-status';
import { downloadCsv } from '../../shared/utils/csv';
import { formatHours, formatMonth, maldivesToday, monthOf } from '../../shared/utils/date-time';
import { valueOr } from '../../shared/utils/resource';
import { summarise } from '../attendance/attendance-summary';
import { SummaryRow } from '../attendance/summary-row';
import { TeamApi, ViewScope } from './team-api';

@Component({
  selector: 'app-team-attendance-page',
  imports: [Avatar, Icon, ListSkeleton, MonthPicker, RouterLink, StatusPill, SummaryRow],
  template: `
    <div class="page-view">
      <div class="page-title">
        <div>
          <span class="eyebrow">ATTENDANCE RECORDS</span>
          <h1>{{ scope() === 'company' ? 'Company attendance' : 'Team attendance' }}</h1>
          <p>Monitor attendance, work hours and anomalies across {{ scope() === 'company' ? 'Opro' : 'your team' }}.</p>
        </div>
        <button type="button" class="download-button" (click)="exportReport()" data-testid="export-report"><app-icon name="download" [size]="17" /> Export report</button>
      </div>

      @if (attendance.error()) {
        <p class="attendance-off">Attendance didn't load. Refresh the page to try again.</p>
      } @else {
        <app-summary-row [summary]="teamSummary()" />
        <section class="card full-table">
          <div class="card-heading">
            <div>
              <span class="eyebrow">{{ monthLabel() }}</span>
              <h2>Attendance log</h2>
            </div>
            <app-month-picker [(month)]="month" [latest]="currentMonth" />
          </div>
          @if (attendance.isLoading() && rows().length === 0) {
            <app-list-skeleton [count]="5" />
          } @else {
            <div class="table-wrap">
              <table class="stacks">
                <thead>
                  <tr>
                    <th scope="col">PERSON</th>
                    <th scope="col">DAYS PRESENT</th>
                    <th scope="col">LATE</th>
                    <th scope="col">MISSED</th>
                    <th scope="col">WORK HOURS</th>
                    <th scope="col">{{ isCurrentMonth() ? 'TODAY' : 'ON TIME' }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of rows(); track row.id) {
                    <tr data-testid="team-attendance-row">
                      <td>
                        <a [routerLink]="['/' + scope(), row.id]" class="person-cell">
                          <app-avatar [name]="row.name" />
                          <span><strong>{{ row.name }}</strong></span>
                        </a>
                      </td>
                      <td data-label="DAYS PRESENT">{{ row.present }} / {{ row.workingDays }}</td>
                      <td data-label="LATE">{{ row.late }}</td>
                      <td data-label="MISSED">{{ row.missed }}</td>
                      <td data-label="WORK HOURS"><b>{{ row.hours }}</b></td>
                      <td [attr.data-label]="isCurrentMonth() ? 'TODAY' : 'ON TIME'">
                        @if (isCurrentMonth() && row.today; as today) {
                          <app-status-pill [tone]="status(today).tone">{{ status(today).label }}</app-status-pill>
                        } @else {
                          {{ row.onTime }}%
                        }
                      </td>
                    </tr>
                  } @empty {
                    <tr><td colspan="6">Nothing recorded for this month.</td></tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamAttendancePage {
  // Set from route data: an HOD's reports, or everyone for a super admin.
  readonly scope = input<ViewScope>('team');

  private readonly today = maldivesToday();
  protected readonly currentMonth = monthOf(this.today);
  protected readonly month = signal(this.currentMonth);
  protected readonly isCurrentMonth = computed(() => this.month() === this.currentMonth);
  protected readonly monthLabel = computed(() => formatMonth(this.month()).toUpperCase());
  protected readonly attendance = inject(TeamApi).attendance(this.month, this.scope);

  private readonly days = computed(() => valueOr(this.attendance, []).filter(({ date }) => date <= this.today));
  protected readonly teamSummary = computed(() => summarise(this.days()));

  protected readonly rows = computed(() => {
    const days = this.days();
    return [...new Set(days.map(({ employeeId }) => employeeId))]
      .map((id) => {
        const own = days.filter(({ employeeId }) => employeeId === id);
        const summary = summarise(own);
        return {
          id,
          name: own[0]?.employeeName ?? id,
          workingDays: summary.workingDays,
          present: summary.present,
          late: summary.lateCount,
          missed: own.filter(({ status }) => status === 'absent' || status === 'incomplete').length,
          hours: formatHours(summary.workedMinutes),
          onTime: summary.onTimePercent,
          today: own.find(({ date }) => date === this.today),
        };
      })
      .sort((first, second) => first.name.localeCompare(second.name));
  });

  protected readonly status = statusToday;

  protected exportReport() {
    downloadCsv(`${this.scope()}-attendance-${this.month()}.csv`, [
      ['Person', 'Days present', 'Working days', 'Late', 'Missed', 'Work hours', 'On time %'],
      ...this.rows().map((row) => [row.name, row.present, row.workingDays, row.late, row.missed, row.hours, row.onTime]),
    ]);
  }
}
