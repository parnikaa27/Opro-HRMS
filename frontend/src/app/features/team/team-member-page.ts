import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Avatar } from '../../shared/ui/avatar';
import { maldivesToday, monthOf } from '../../shared/utils/date-time';
import { valueOr } from '../../shared/utils/resource';
import { AttendanceDays } from '../attendance/attendance-days';
import { LeaveApi } from '../leave/leave-api';
import { LeaveBalances } from '../leave/leave-balances';
import { LeaveRequests } from '../leave/leave-requests';
import { IdCard } from '../profile/id-card';
import { VisaDetails } from '../profile/visa-details';
import { TeamApi } from './team-api';
import { ListSkeleton } from '../../shared/ui/list-skeleton';

@Component({
  selector: 'app-team-member-page',
  imports: [ListSkeleton, Avatar, AttendanceDays, IdCard, LeaveBalances, LeaveRequests, RouterLink, VisaDetails],
  template: `
    <a routerLink="/team" class="mb-6 inline-block text-sm font-medium text-sea hover:underline">‹ Your team</a>

    @if (isNotFound()) {
      <h1 class="font-display text-3xl">Not on your team</h1>
      <p class="mt-2 text-soft">You can only see people who report to you.</p>
    } @else if (member.error()) {
      <p class="text-sm text-danger">This person's details didn't load. Refresh the page to try again.</p>
    } @else if (member.isLoading()) {
      <app-list-skeleton [count]="4" />
    } @else if (person(); as employee) {
      <header class="mb-8 flex items-center gap-4">
        <app-avatar [name]="employee.fullName" [isLarge]="true" />
        <div>
          <h1 class="font-display text-3xl tracking-tight sm:text-4xl">{{ employee.fullName }}</h1>
          <p class="mt-1 text-soft">{{ employee.designation }}, {{ employee.workLocation }}</p>
        </div>
      </header>

      <section aria-labelledby="member-leave-heading">
        <h2 id="member-leave-heading" class="eyebrow mb-3">Leave left</h2>
        <app-leave-balances [balances]="employee.leaveBalances" [types]="typeList()" />
      </section>

      <section class="mt-10" aria-labelledby="member-month-heading">
        <h2 id="member-month-heading" class="eyebrow mb-3">This month so far</h2>
        <app-attendance-days [days]="days()" [isReadOnly]="true" />
      </section>

      <section class="mt-10" aria-labelledby="member-requests-heading">
        <h2 id="member-requests-heading" class="eyebrow mb-3">Leave requests</h2>
        <app-leave-requests [requests]="requests()" [types]="typeList()" [isReadOnly]="true" />
      </section>

      <section class="mt-10 max-w-2xl" aria-labelledby="member-visa-heading">
        <h2 id="member-visa-heading" class="eyebrow mb-3">Visa and work permit</h2>
        <app-visa-details [visa]="employee.visa" [nationality]="employee.nationality" />
      </section>

      <section class="mt-10" aria-labelledby="member-card-heading">
        <h2 id="member-card-heading" class="eyebrow mb-3">Contact card</h2>
        <app-id-card [employee]="employee" />
      </section>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamMemberPage {
  private readonly api = inject(TeamApi);
  private readonly today = maldivesToday();

  readonly employeeId = input.required<string>();

  protected readonly member = this.api.member(this.employeeId);
  private readonly attendance = this.api.attendance(() => monthOf(this.today));
  private readonly leave = this.api.leaveRequests();
  private readonly types = inject(LeaveApi).types();

  protected readonly person = computed(() => valueOr(this.member, undefined));
  protected readonly isNotFound = computed(() => {
    const error = this.member.error()?.cause ?? this.member.error();
    return error instanceof HttpErrorResponse && error.status === HttpStatusCode.NotFound;
  });
  protected readonly typeList = computed(() => valueOr(this.types, []));
  protected readonly days = computed(() =>
    valueOr(this.attendance, [])
      .filter((day) => day.employeeId === this.employeeId() && day.date <= this.today)
      .sort((first, second) => second.date.localeCompare(first.date)),
  );
  protected readonly requests = computed(() => valueOr(this.leave, []).filter(({ employeeId }) => employeeId === this.employeeId()));
}
