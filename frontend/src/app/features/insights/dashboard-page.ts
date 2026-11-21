import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../shared/ui/icon';
import { ListSkeleton } from '../../shared/ui/list-skeleton';
import { StatusPill } from '../../shared/ui/status-pill';
import { formatCompactDate, formatMonth, formatShortDate } from '../../shared/utils/date-time';
import { valueOr } from '../../shared/utils/resource';
import { plural } from '../../shared/utils/text';
import { Breakdown } from './breakdown';
import { InsightsApi } from './insights-api';

const SHORT_MONTH = 3;
const PERCENT = 100;

// The executive dashboard: workforce, today's attendance, leave, compliance and people events, as the server
// counted them. Shared by HR and super admins; only the links to a person's page differ.
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

      @if (figures.error()) {
        <p class="attendance-off">The dashboard didn't load. Refresh the page to try again.</p>
      } @else if (figures.isLoading() && !data()) {
        <app-list-skeleton [count]="4" />
      } @else if (data(); as data) {
        <div class="manager-stats">
          <div class="stat-card">
            <div class="stat-icon aqua"><app-icon name="users" /></div>
            <div><span>EMPLOYEES</span><strong data-testid="kpi-total">{{ data.workforce.total }}</strong><small>{{ signed(data.workforce.growthPercent) }} since 1 January</small></div>
          </div>
          <div class="stat-card">
            <div class="stat-icon violet"><app-icon name="userCheck" /></div>
            <div><span>NEW JOINERS</span><strong data-testid="kpi-joiners">{{ data.workforce.joiners }}</strong><small>This year</small></div>
          </div>
          <div class="stat-card">
            <div class="stat-icon coral"><app-icon name="logout" /></div>
            <div><span>LEFT</span><strong data-testid="kpi-leavers">{{ data.workforce.leavers }}</strong><small>{{ data.workforce.attritionPercent }}% attrition, {{ data.workforce.retentionPercent }}% retained</small></div>
          </div>
          <div class="stat-card">
            <div class="stat-icon amber"><app-icon name="clock" /></div>
            <div><span>IN TODAY</span><strong data-testid="kpi-in">{{ data.presence.present }}</strong><small>{{ inPercent() }}% of everyone</small></div>
          </div>
        </div>

        <div class="insight-grid">
          <section class="card card-pad" data-testid="workforce">
            <div class="card-heading"><div><span class="eyebrow">WORKFORCE</span><h2>Who works here</h2></div></div>
            <h3 class="insight-label">Locals and expatriates</h3>
            <app-breakdown [shares]="data.mix.origin" label="Locals and expatriates" />
            <h3 class="insight-label">Gender</h3>
            <app-breakdown [shares]="data.mix.gender" label="Gender" />
            <h3 class="insight-label">Employment</h3>
            <app-breakdown [shares]="data.mix.employmentType" label="Employment type" />
            <h3 class="insight-label">Age</h3>
            <app-breakdown [shares]="data.mix.age" label="Age" />
          </section>

          <section class="card card-pad" data-testid="mix">
            <div class="card-heading"><div><span class="eyebrow">WORKFORCE</span><h2>Departments and nationalities</h2></div></div>
            <h3 class="insight-label">Departments</h3>
            <app-breakdown [shares]="data.mix.department" label="Departments" />
            <h3 class="insight-label">Nationalities</h3>
            <app-breakdown [shares]="data.mix.nationality" label="Nationalities" />
          </section>

          <section class="card card-pad" data-testid="attendance">
            <div class="card-heading"><div><span class="eyebrow">ATTENDANCE</span><h2>Today and this month</h2></div></div>
            <dl class="insight-figures">
              <div><dt>In</dt><dd>{{ data.presence.present }}</dd></div>
              <div><dt>Late</dt><dd>{{ data.presence.late }}</dd></div>
              <div><dt>Absent</dt><dd>{{ data.presence.absent }}</dd></div>
              <div><dt>On leave</dt><dd>{{ data.presence.onLeave }}</dd></div>
              <div><dt>From home</dt><dd>{{ data.presence.fromHome }}</dd></div>
              <div><dt>At a resort</dt><dd>{{ data.presence.atResort }}</dd></div>
            </dl>
            <p class="card-text" data-testid="month-attendance">{{ formatMonth(data.month.month) }}: {{ data.month.attendancePercent }}% attendance, {{ plural(data.month.lateCount, 'late arrival') }}, {{ data.month.onTimePercent }}% on time.</p>
          </section>

          <section class="card card-pad" data-testid="leave">
            <div class="card-heading"><div><span class="eyebrow">LEAVE</span><h2>Leave this year</h2></div></div>
            <dl class="insight-figures">
              <div><dt>Waiting for a decision</dt><dd>{{ data.leave.pending }}</dd></div>
              <div><dt>On leave today</dt><dd>{{ data.presence.onLeave }}</dd></div>
              <div><dt>Annual leave used</dt><dd>{{ data.leave.annualUsedPercent }}%</dd></div>
            </dl>
            <h3 class="insight-label">Sick leave by month</h3>
            <app-breakdown [shares]="sickTrend()" label="Sick leave days by month" unit="day" [showsPercent]="false" />
          </section>

          <section class="card card-pad" data-testid="compliance">
            <div class="card-heading"><div><span class="eyebrow">COMPLIANCE</span><h2>Papers and quota</h2></div></div>
            @for (paper of data.compliance.papers; track paper.kind) {
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
              <strong>{{ data.compliance.quotaUsed }} of {{ data.compliance.quotaSlots }} slots used</strong>
            </div>
            @if (data.compliance.quotasFull.length) {
              <p class="card-text">Full: {{ data.compliance.quotasFull.join(', ') }}.</p>
            }
            @if (data.compliance.missingVisa) {
              <p class="card-text">{{ plural(data.compliance.missingVisa, 'expatriate') }} with no visa record.</p>
            }
          </section>

          <section class="card card-pad" data-testid="performance">
            <div class="card-heading"><div><span class="eyebrow">PERFORMANCE</span><h2>{{ data.performance.cycleName ?? 'Appraisals' }}</h2></div></div>
            <dl class="insight-figures">
              <div><dt>On probation</dt><dd>{{ data.performance.onProbation }}</dd></div>
              <div><dt>Appraised</dt><dd>{{ data.performance.cycleName ? data.performance.done + ' of ' + data.performance.due : 'No cycle' }}</dd></div>
              <div><dt>Average rating</dt><dd>{{ data.performance.averageRating ?? 'None yet' }}</dd></div>
            </dl>
            <dl class="insight-figures">
              <div><dt>Rated 4 or 5</dt><dd>{{ data.performance.highPerformers }}</dd></div>
              <div><dt>Recommended for promotion</dt><dd>{{ data.performance.promotions }}</dd></div>
            </dl>
          </section>

          <section class="card card-pad" data-testid="people-events">
            <div class="card-heading"><div><span class="eyebrow">PEOPLE</span><h2>Coming up</h2></div></div>
            <h3 class="insight-label">Birthdays this month</h3>
            @for (person of data.events.birthdays; track person.id) {
              <a class="insight-row" [routerLink]="personLink(person.id)" data-testid="birthday"><span>{{ person.fullName }}</span><small>{{ formatShortDate(person.on) }}</small></a>
            } @empty {
              <p class="attendance-off">None this month.</p>
            }
            <h3 class="insight-label">Work anniversaries this month</h3>
            @for (person of data.events.anniversaries; track person.id) {
              <a class="insight-row" [routerLink]="personLink(person.id)" data-testid="anniversary"><span>{{ person.fullName }}</span><small>{{ plural(person.years ?? 0, 'year') }}, {{ formatShortDate(person.on) }}</small></a>
            } @empty {
              <p class="attendance-off">None this month.</p>
            }
            <h3 class="insight-label">Probation ending in 30 days</h3>
            @for (person of data.events.probation; track person.id) {
              <a class="insight-row" [routerLink]="personLink(person.id)" data-testid="probation"><span>{{ person.fullName }}</span><small>{{ formatCompactDate(person.on) }}</small></a>
            } @empty {
              <p class="attendance-off">Nobody.</p>
            }
            <h3 class="insight-label">Contracts ending in 60 days</h3>
            @for (person of data.events.contracts; track person.id) {
              <a class="insight-row" [routerLink]="personLink(person.id)" data-testid="contract"><span>{{ person.fullName }}</span><small>{{ formatCompactDate(person.on) }}</small></a>
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

  protected readonly figures = this.api.dashboard();
  protected readonly data = computed(() => valueOr(this.figures, undefined));
  protected readonly inPercent = computed(() => {
    const data = this.data();
    return data?.workforce.total ? Math.round((data.presence.present / data.workforce.total) * PERCENT) : 0;
  });
  // Bars scaled to the busiest month, so a quiet half year still shows its shape.
  protected readonly sickTrend = computed(() => {
    const trend = this.data()?.leave.sickByMonth ?? [];
    const most = Math.max(1, ...trend.map(({ days }) => days));
    return trend.map(({ month, days }) => ({ label: formatMonth(month).slice(0, SHORT_MONTH), count: days, percent: Math.round((days / most) * PERCENT) }));
  });

  protected readonly reportsLink = computed(() => `/${this.scope()}/reports`);
  protected readonly personLink = (id: string) => (this.scope() === 'hr' ? ['/hr/people', id] : ['/company', id]);
  protected readonly signed = (percent: number) => `${percent > 0 ? '+' : ''}${percent}%`;
  protected readonly formatMonth = formatMonth;
  protected readonly formatShortDate = formatShortDate;
  protected readonly plural = plural;
  protected readonly formatCompactDate = formatCompactDate;
}
