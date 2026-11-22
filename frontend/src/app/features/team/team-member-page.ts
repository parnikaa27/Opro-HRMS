import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../shared/ui/icon';
import { ListSkeleton } from '../../shared/ui/list-skeleton';
import { MonthPicker } from '../../shared/ui/month-picker';
import { formatMonth, maldivesToday, monthOf } from '../../shared/utils/date-time';
import { valueOr } from '../../shared/utils/resource';
import { toAttendanceRow } from '../attendance/attendance-rows';
import { AttendanceTable } from '../attendance/attendance-table';
import { VisaCard } from '../dashboard/visa-card';
import { LeaveApi } from '../leave/leave-api';
import { LeaveBalances } from '../leave/leave-balances';
import { LeaveRequests } from '../leave/leave-requests';
import { EmployeeCard } from '../profile/employee-card';
import { TeamApi, ViewScope } from './team-api';
import { TeamGrantsCard } from '../allowance/team-grants-card';

const LOG_DAYS = 7;

@Component({
  selector: 'app-team-member-page',
  imports: [AttendanceTable, EmployeeCard, Icon, LeaveBalances, LeaveRequests, ListSkeleton, MonthPicker, RouterLink, TeamGrantsCard, VisaCard],
  template: `
    <div class="page-view">
      <a [routerLink]="scope() === 'company' ? '/company' : '/team/people'" class="text-link back-link"><app-icon name="chevronLeft" [size]="15" /> People</a>

      @if (isNotFound()) {
        <div class="page-title">
          <div>
            <span class="eyebrow">{{ eyebrow() }}</span>
            <h1>{{ scope() === 'company' ? 'Nobody by that ID' : 'Not on your team' }}</h1>
            <p>{{ scope() === 'company' ? 'They may have left Opro. Find them on the People page.' : 'You can only see people who report to you.' }}</p>
          </div>
        </div>
      } @else if (member.error()) {
        <p class="attendance-off">This person's details didn't load. Refresh the page to try again.</p>
      } @else if (member.isLoading()) {
        <app-list-skeleton [count]="4" />
      } @else if (person(); as employee) {
        <div class="page-title">
          <div>
            <span class="eyebrow">{{ eyebrow() }}</span>
            <h1>{{ employee.fullName }}</h1>
            <p>{{ employee.designation }}, {{ employee.workLocation }}</p>
          </div>
        </div>

        <app-leave-balances [balances]="employee.leaveBalances" [types]="typeList()" [joinedOn]="employee.joinedOn" />

        <div class="employee-grid">
          <div class="main-column">
            <section class="card full-table">
              <div class="card-heading">
                <div>
                  <span class="eyebrow">{{ monthLabel() }}</span>
                  <h2>Attendance log</h2>
                </div>
                <app-month-picker [(month)]="month" [latest]="currentMonth" />
              </div>
              <app-attendance-table [rows]="rows()" [pageSize]="logDays" />
            </section>
            <app-leave-requests [requests]="requests()" [types]="typeList()" [isReadOnly]="true" heading="Their leave requests" />
            @if (scope() === 'team') {
              <app-team-grants-card [employeeId]="employee.id" [name]="employee.fullName" />
            }
          </div>
          <div class="side-column">
            <app-employee-card [employee]="employee" />
            <app-visa-card [employee]="employee" reader="manager" />
          </div>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamMemberPage {
  private readonly api = inject(TeamApi);
  private readonly today = maldivesToday();

  readonly employeeId = input.required<string>();
  // Set from route data: an HOD's report, or anyone for a super admin.
  readonly scope = input<ViewScope>('team');

  protected readonly currentMonth = monthOf(this.today);
  protected readonly month = signal(this.currentMonth);
  protected readonly monthLabel = computed(() => (this.month() === this.currentMonth ? 'THIS MONTH' : formatMonth(this.month()).toUpperCase()));
  protected readonly eyebrow = computed(() => (this.scope() === 'company' ? 'PEOPLE' : 'TEAM MEMBER'));
  protected readonly member = this.api.member(this.employeeId, this.scope);
  private readonly attendance = this.api.attendance(this.month, this.scope);
  private readonly leave = this.api.leaveRequests({ scope: this.scope });
  private readonly types = inject(LeaveApi).types();

  protected readonly person = computed(() => valueOr(this.member, undefined));
  protected readonly isNotFound = computed(() => {
    const error = this.member.error()?.cause ?? this.member.error();
    return error instanceof HttpErrorResponse && error.status === HttpStatusCode.NotFound;
  });
  protected readonly typeList = computed(() => valueOr(this.types, []));
  // A week at a time, so the rest of the page isn't pushed far below a month of days.
  protected readonly logDays = LOG_DAYS;
  protected readonly rows = computed(() =>
    valueOr(this.attendance, [])
      .filter((day) => day.employeeId === this.employeeId() && day.date <= this.today && day.status !== 'weekend')
      .sort((first, second) => second.date.localeCompare(first.date))
      .map((day) => toAttendanceRow(day, this.today)),
  );
  protected readonly requests = computed(() => valueOr(this.leave, []).filter(({ employeeId }) => employeeId === this.employeeId()));
}
