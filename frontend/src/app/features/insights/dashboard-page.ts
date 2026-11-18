import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../shared/ui/icon';
import { ListSkeleton } from '../../shared/ui/list-skeleton';
import { StatusPill } from '../../shared/ui/status-pill';
import { formatCompactDate, formatMonth, formatShortDate, inYearOf, monthOf, yearOf } from '../../shared/utils/date-time';
import { valueOr } from '../../shared/utils/resource';
import { plural } from '../../shared/utils/text';
import { summarise } from '../attendance/attendance-summary';
import { Breakdown } from './breakdown';
import { ageBand, compliance, genderLabel, isExpatriate, leaveSummary, peopleEvents, percentOf, presence, shares, workforce } from './insights';
import { InsightsApi } from './insights-api';

const SHORT_MONTH = 3;

// The executive dashboard: workforce, today's attendance, leave, compliance and people events, from the facts
// the server gathers. Shared by HR and super admins; only the links to a person's page differ.
@Component({
  selector: 'app-dashboard-page',
  imports: [Breakdown, Icon, ListSkeleton, RouterLink, StatusPill],
  template: `
    <div class="page-view">
      <div class="page-title">
        <div>
          <span class="eyebrow">EXECUTIVE DASHBOARD</span>
          <h1>Opro at a glance</h1>
          <p>Who works here, who's in today, leave, papers and what's coming up. Every number comes from the records behind it.</p>
        </div>
        <a class="secondary-button" [routerLink]="reportsLink()" data-testid="open-reports"><app-icon name="download" [size]="17" /> Reports</a>
      </div>

      @if (facts.error()) {
        <p class="attendance-off">The dashboard didn't load. Refresh the page to try again.</p>
      } @else if (facts.isLoading() && !data()) {
        <app-list-skeleton [count]="4" />
      } @else if (data(); as data) {
        <div class="manager-stats">
          <div class="stat-card">
            <div class="stat-icon aqua"><app-icon name="users" /></div>
            <div><span>EMPLOYEES</span><strong data-testid="kpi-total">{{ staff().total }}</strong><small>{{ signed(staff().growthPercent) }} since 1 January</small></div>
          </div>
          <div class="stat-card">
            <div class="stat-icon violet"><app-icon name="userCheck" /></div>
            <div><span>NEW JOINERS</span><strong data-testid="kpi-joiners">{{ staff().joiners.length }}</strong><small>This year</small></div>
          </div>
          <div class="stat-card">
            <div class="stat-icon coral"><app-icon name="logout" /></div>
            <div><span>LEFT</span><strong data-testid="kpi-leavers">{{ staff().leavers.length }}</strong><small>{{ staff().attritionPercent }}% attrition, {{ staff().retentionPercent }}% retained</small></div>
          </div>
          <div class="stat-card">
            <div class="stat-icon amber"><app-icon name="clock" /></div>
            <div><span>IN TODAY</span><strong data-testid="kpi-in">{{ now().present }}</strong><small>{{ percentOf(now().present, staff().total) }}% of everyone</small></div>
          </div>
        </div>

        <div class="insight-grid">
          <section class="card card-pad" data-testid="workforce">
            <div class="card-heading"><div><span class="eyebrow">WORKFORCE</span><h2>Who works here</h2></div></div>
            <h3 class="insight-label">Locals and expatriates</h3>
            <app-breakdown [shares]="origin()" label="Locals and expatriates" />
            <h3 class="insight-label">Gender</h3>
            <app-breakdown [shares]="genders()" label="Gender" />
            <h3 class="insight-label">Employment</h3>
            <app-breakdown [shares]="types()" label="Employment type" />
            <h3 class="insight-label">Age</h3>
            <app-breakdown [shares]="ages()" label="Age" />
          </section>

          <section class="card card-pad" data-testid="mix">
            <div class="card-heading"><div><span class="eyebrow">WORKFORCE</span><h2>Departments and nationalities</h2></div></div>
            <h3 class="insight-label">Departments</h3>
            <app-breakdown [shares]="departments()" label="Departments" />
            <h3 class="insight-label">Nationalities</h3>
            <app-breakdown [shares]="nationalities()" label="Nationalities" />
          </section>

          <section class="card card-pad" data-testid="attendance">
            <div class="card-heading"><div><span class="eyebrow">ATTENDANCE</span><h2>Today and this month</h2></div></div>
            <dl class="insight-figures">
              <div><dt>In</dt><dd>{{ now().present }}</dd></div>
              <div><dt>Late</dt><dd>{{ now().late }}</dd></div>
              <div><dt>Absent</dt><dd>{{ now().absent }}</dd></div>
              <div><dt>On leave</dt><dd>{{ now().onLeave }}</dd></div>
              <div><dt>From home</dt><dd>{{ now().fromHome }}</dd></div>
              <div><dt>At a resort</dt><dd>{{ now().atResort }}</dd></div>
            </dl>
            <p class="card-text" data-testid="month-attendance">{{ monthLabel() }}: {{ month().attendancePercent }}% attendance, {{ plural(month().lateCount, 'late arrival') }}, {{ month().onTimePercent }}% on time.</p>
          </section>

          <section class="card card-pad" data-testid="leave">
            <div class="card-heading"><div><span class="eyebrow">LEAVE</span><h2>Leave this year</h2></div></div>
            <dl class="insight-figures">
              <div><dt>Waiting for a decision</dt><dd>{{ leave().pending }}</dd></div>
              <div><dt>On leave today</dt><dd>{{ now().onLeave }}</dd></div>
              <div><dt>Annual leave used</dt><dd>{{ leave().annualUsedPercent }}%</dd></div>
            </dl>
            <h3 class="insight-label">Sick leave by month</h3>
            <app-breakdown [shares]="sickTrend()" label="Sick leave days by month" unit="day" [showsPercent]="false" />
          </section>

          <section class="card card-pad" data-testid="compliance">
            <div class="card-heading"><div><span class="eyebrow">COMPLIANCE</span><h2>Papers and quota</h2></div></div>
            @for (paper of papers().papers; track paper.kind) {
              <div class="insight-row" data-testid="paper">
                <span>{{ paper.label }}</span>
                @if (paper.expired) {
                  <app-status-pill tone="danger">{{ paper.expired }} expired</app-status-pill>
                }
                @if (paper.expiring) {
                  <app-status-pill tone="late">{{ paper.expiring }} within 60 days</app-status-pill>
                }
                @if (!paper.expired && !paper.expiring) {
                  <app-status-pill tone="ok">All in date</app-status-pill>
                }
              </div>
            }
            <div class="insight-row" data-testid="quota-use">
              <span>Expatriate quota</span>
              <strong>{{ papers().quotaUsed }} of {{ papers().quotaSlots }} slots used</strong>
            </div>
            @if (papers().quotasFull.length) {
              <p class="card-text">Full: {{ papers().quotasFull.join(', ') }}.</p>
            }
            @if (papers().missingVisa) {
              <p class="card-text">{{ plural(papers().missingVisa, 'expatriate') }} with no visa record.</p>
            }
          </section>

          <section class="card card-pad" data-testid="people-events">
            <div class="card-heading"><div><span class="eyebrow">PEOPLE</span><h2>Coming up</h2></div></div>
            <h3 class="insight-label">Birthdays this month</h3>
            @for (person of events().birthdays; track person.id) {
              <a class="insight-row" [routerLink]="personLink(person.id)" data-testid="birthday"><span>{{ person.fullName }}</span><small>{{ dayOf(person.dateOfBirth ?? '') }}</small></a>
            } @empty {
              <p class="attendance-off">None this month.</p>
            }
            <h3 class="insight-label">Work anniversaries this month</h3>
            @for (person of events().anniversaries; track person.id) {
              <a class="insight-row" [routerLink]="personLink(person.id)" data-testid="anniversary"><span>{{ person.fullName }}</span><small>{{ plural(yearsAt(person.joinedOn), 'year') }}, {{ dayOf(person.joinedOn) }}</small></a>
            } @empty {
              <p class="attendance-off">None this month.</p>
            }
            <h3 class="insight-label">Probation ending in 30 days</h3>
            @for (person of events().probation; track person.id) {
              <a class="insight-row" [routerLink]="personLink(person.id)" data-testid="probation"><span>{{ person.fullName }}</span><small>{{ formatCompactDate(person.probationEndsOn ?? '') }}</small></a>
            } @empty {
              <p class="attendance-off">Nobody.</p>
            }
            <h3 class="insight-label">Contracts ending in 60 days</h3>
            @for (person of events().contracts; track person.id) {
              <a class="insight-row" [routerLink]="personLink(person.id)" data-testid="contract"><span>{{ person.fullName }}</span><small>{{ formatCompactDate(person.contractEndsOn ?? '') }}</small></a>
            } @empty {
              <p class="attendance-off">Nobody.</p>
            }
          </section>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  private readonly api = inject(InsightsApi);
  // Set from route data: links go to HR's person page or the super admin's.
  readonly scope = input<'hr' | 'company'>('hr');

  protected readonly facts = this.api.insights();
  protected readonly data = computed(() => valueOr(this.facts, undefined));
  private readonly day = computed(() => this.data()?.today ?? '');
  // This month, by the server's date.
  private readonly attendance = this.api.attendance(() => (this.day() ? monthOf(this.day()) : undefined));
  protected readonly monthLabel = computed(() => (this.day() ? formatMonth(monthOf(this.day())) : ''));

  protected readonly staff = computed(() => workforce(this.data()?.people ?? [], this.day()));
  protected readonly now = computed(() => presence(this.staff().active));
  protected readonly month = computed(() => summarise(valueOr(this.attendance, []).filter(({ date }) => date <= this.day())));
  protected readonly leave = computed(() => leaveSummary(this.data()?.leave ?? [], this.data()?.balances ?? [], this.day()));
  protected readonly papers = computed(() => compliance(this.staff().active, this.data()?.quotas ?? [], this.day()));
  protected readonly events = computed(() => peopleEvents(this.staff().active, this.day()));

  protected readonly origin = computed(() => shares(this.staff().active, (person) => (isExpatriate(person) ? 'Expatriates' : 'Maldivians')));
  protected readonly genders = computed(() => shares(this.staff().active, genderLabel));
  protected readonly types = computed(() => shares(this.staff().active, ({ employmentType }) => employmentType));
  protected readonly ages = computed(() => shares(this.staff().active, ({ dateOfBirth }) => ageBand(dateOfBirth, this.day())));
  protected readonly departments = computed(() => shares(this.staff().active, ({ department }) => department));
  protected readonly nationalities = computed(() => shares(this.staff().active, ({ nationality }) => nationality));
  protected readonly sickTrend = computed(() => {
    const trend = this.leave().sickByMonth;
    const most = Math.max(1, ...trend.map(({ days }) => days));
    return trend.map(({ month, days }) => ({ label: formatMonth(month).slice(0, SHORT_MONTH), count: days, percent: percentOf(days, most) }));
  });

  protected readonly reportsLink = computed(() => `/${this.scope()}/reports`);
  protected readonly personLink = (id: string) => (this.scope() === 'hr' ? ['/hr/people', id] : ['/company', id]);
  protected readonly yearsAt = (joinedOn: string) => yearOf(this.day()) - yearOf(joinedOn);
  protected readonly dayOf = (date: string) => formatShortDate(inYearOf(date, this.day()));
  protected readonly signed = (percent: number) => `${percent > 0 ? '+' : ''}${percent}%`;
  protected readonly percentOf = percentOf;
  protected readonly plural = plural;
  protected readonly formatCompactDate = formatCompactDate;
}
