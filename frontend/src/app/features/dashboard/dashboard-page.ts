import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Session } from '../../core/session';
import { AttendanceStatus } from '../../models/attendance';
import { Icon } from '../../shared/ui/icon';
import { ListSkeleton } from '../../shared/ui/list-skeleton';
import { WelcomeBanner } from '../../shared/ui/welcome-banner';
import { addMonths, formatBannerDate, maldivesHour, maldivesToday, monthOf } from '../../shared/utils/date-time';
import { valueOr } from '../../shared/utils/resource';
import { AttendanceApi } from '../attendance/attendance-api';
import { toAttendanceRow } from '../attendance/attendance-rows';
import { AttendanceTable } from '../attendance/attendance-table';
import { EmployeeCard } from '../profile/employee-card';
import { LatestRequestCard } from './latest-request-card';
import { LeaveBalanceCard } from './leave-balance-card';
import { NextHolidayCard } from './next-holiday-card';
import { TodayAttendanceCard } from './today-attendance-card';
import { VisaCard } from './visa-card';
import { WelcomeCard } from '../onboarding/welcome-card';

const NOON = 12;
const EVENING = 17;
const RECENT_DAYS = 4;

export const greetingFor = (hour: number) => (hour < NOON ? 'Good morning' : hour < EVENING ? 'Good afternoon' : 'Good evening');

const LINES: Partial<Record<AttendanceStatus, string>> = {
  present: 'You’re right on time. Here’s everything you need for the day.',
  late: 'You came in a little late today. Here’s everything you need for the day.',
  'half-day': 'Short day today. Here’s everything you need.',
  weekend: 'Enjoy the weekend. Here’s what’s coming up.',
  holiday: 'Enjoy the holiday. Here’s what’s coming up.',
  'on-leave': 'You’re on leave today. Enjoy the break.',
};
const DEFAULT_LINE = 'Here’s everything you need for the day.';

@Component({
  selector: 'app-dashboard-page',
  imports: [AttendanceTable, EmployeeCard, Icon, LatestRequestCard, LeaveBalanceCard, ListSkeleton, NextHolidayCard, RouterLink, TodayAttendanceCard, VisaCard, WelcomeBanner, WelcomeCard],
  template: `
    @if (session.user(); as user) {
      <app-welcome-banner [dateLabel]="dateLabel" [heading]="greeting + ', ' + firstName() + '.'" [line]="line()" />
      <div class="employee-grid">
        <div class="main-column">
          <app-welcome-card />
          <app-today-attendance-card [day]="today()" [isLoading]="thisMonth.isLoading()" [hasFailed]="!!thisMonth.error()" (punched)="thisMonth.reload()" />
          <div class="balance-grid">
            <app-leave-balance-card />
            <app-visa-card [employee]="user" />
          </div>
          <section class="card recent-section">
            <div class="card-heading">
              <div>
                <span class="eyebrow">THIS WEEK</span>
                <h2>Recent attendance</h2>
              </div>
              <a routerLink="/attendance" class="text-link">View report <app-icon name="arrow" [size]="15" /></a>
            </div>
            @if (thisMonth.error()) {
              <p class="attendance-off">Your recent attendance didn't load. Refresh the page to try again.</p>
            } @else if (thisMonth.isLoading() && recentRows().length === 0) {
              <app-list-skeleton [count]="4" />
            } @else {
              <app-attendance-table [rows]="recentRows()" />
            }
          </section>
        </div>
        <div class="side-column">
          <app-employee-card [employee]="user" />
          <app-next-holiday-card />
          <app-latest-request-card />
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  protected readonly session = inject(Session);
  private readonly api = inject(AttendanceApi);
  private readonly todayDate = maldivesToday();

  protected readonly thisMonth = this.api.month(() => monthOf(this.todayDate));
  // The week can start last month, so the recent table needs both.
  private readonly lastMonth = this.api.month(() => addMonths(monthOf(this.todayDate), -1));

  protected readonly greeting = greetingFor(maldivesHour());
  protected readonly dateLabel = formatBannerDate(this.todayDate).toUpperCase();
  protected readonly firstName = computed(() => this.session.user()?.fullName.split(' ')[0] ?? '');

  private readonly days = computed(() => [...valueOr(this.lastMonth, []), ...valueOr(this.thisMonth, [])]);
  protected readonly today = computed(() => this.days().find(({ date }) => date === this.todayDate));
  protected readonly line = computed(() => {
    const status = this.today()?.status;
    return (status && LINES[status]) ?? DEFAULT_LINE;
  });
  protected readonly recentRows = computed(() =>
    this.days()
      .filter(({ date, status }) => date <= this.todayDate && status !== 'weekend')
      .sort((first, second) => second.date.localeCompare(first.date))
      .slice(0, RECENT_DAYS)
      .map((day) => toAttendanceRow(day, this.todayDate)),
  );
}
