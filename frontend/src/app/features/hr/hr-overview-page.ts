import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Session } from '../../core/session';
import { AttendanceStatus } from '../../models/attendance';
import { Avatar } from '../../shared/ui/avatar';
import { Icon } from '../../shared/ui/icon';
import { WelcomeBanner } from '../../shared/ui/welcome-banner';
import { addDays, daysUntil, formatBannerDate, formatShortDate, maldivesHour, maldivesToday, yearOf } from '../../shared/utils/date-time';
import { valueOr } from '../../shared/utils/resource';
import { plural } from '../../shared/utils/text';
import { greetingFor } from '../dashboard/dashboard-page';
import { HolidaysApi } from '../holidays/holidays-api';
import { visaAlertsFor } from '../team/visa-alerts';
import { DocumentsToCollect } from './documents-to-collect';
import { HrApi } from './hr-api';
import { inboxCount } from './inbox-count';
import { OnboardingProgressCard } from '../onboarding/onboarding-progress-card';

const PREVIEW = 4;
const CONFIRM_WINDOW_DAYS = 60;
const IN_OFFICE: readonly AttendanceStatus[] = ['present', 'late', 'half-day', 'incomplete'];

@Component({
  selector: 'app-hr-overview-page',
  imports: [Avatar, DocumentsToCollect, Icon, OnboardingProgressCard, RouterLink, WelcomeBanner],
  template: `
    <app-welcome-banner [dateLabel]="dateLabel" [heading]="greeting + ', ' + firstName() + '.'" [line]="line()" />

    <div class="manager-stats">
      <a class="stat-card" routerLink="/hr/people">
        <div class="stat-icon aqua"><app-icon name="users" /></div>
        <div>
          <span>PEOPLE</span>
          <strong data-testid="stat-people">{{ people().length }}</strong>
          <small><i></i> {{ inToday() }} in today</small>
        </div>
      </a>
      <a class="stat-card" routerLink="/hr/people">
        <div class="stat-icon amber"><app-icon name="palm" /></div>
        <div>
          <span>ON LEAVE TODAY</span>
          <strong data-testid="stat-on-leave">{{ onLeave().length }}</strong>
          <small>Approved by their HODs</small>
        </div>
      </a>
      <a class="stat-card" routerLink="/hr/visas">
        <div class="stat-icon coral"><app-icon name="globe" /></div>
        <div>
          <span>VISAS TO ACT ON</span>
          <strong data-testid="stat-visas">{{ visaAlerts().length }}</strong>
          <small>Expiring or expired</small>
        </div>
      </a>
      <a class="stat-card" routerLink="/hr/inbox">
        <div class="stat-icon violet"><app-icon name="mail" /></div>
        <div>
          <span>INBOX</span>
          <strong data-testid="stat-inbox">{{ inbox.count() }}</strong>
          <small>Waiting for you</small>
        </div>
      </a>
    </div>

    <div class="manager-grid">
      <section class="card requests-section">
        <div class="card-heading">
          <div>
            <span class="eyebrow">ACROSS OPRO</span>
            <h2>On leave today</h2>
          </div>
          <a routerLink="/hr/people" class="text-link">People <app-icon name="arrow" [size]="15" /></a>
        </div>
        <div class="request-list">
          @for (person of onLeave().slice(0, preview); track person.id) {
            <a class="request-item" [routerLink]="['/hr/people', person.id]" data-testid="on-leave">
              <app-avatar [name]="person.fullName" [photoUrl]="person.photoUrl" />
              <div class="request-person">
                <strong>{{ person.fullName }}</strong>
                <span>{{ person.designation }}</span>
              </div>
            </a>
          } @empty {
            <p class="attendance-off">Nobody's on leave today.</p>
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
        @for (alert of visaAlerts().slice(0, preview); track alert.id) {
          <a class="visa-alert" [routerLink]="['/hr/people', alert.employeeId]" data-testid="visa-alert">
            <app-avatar [name]="alert.name" />
            <div>
              <strong>{{ alert.name }}</strong>
              <span>{{ alert.detail }}</span>
            </div>
            <b>{{ alert.days }}</b>
          </a>
        } @empty {
          <p class="attendance-off">Every visa and passport is in date.</p>
        }
        <a routerLink="/hr/visas" class="text-link">All visas <app-icon name="arrow" [size]="15" /></a>
      </section>
    </div>

    <section class="card card-pad hr-confirm">
      <div class="card-heading">
        <div>
          <span class="eyebrow">COMING UP</span>
          <h2>Holiday dates to confirm</h2>
        </div>
        <a routerLink="/hr/calendar" class="text-link">Holiday calendar <app-icon name="arrow" [size]="15" /></a>
      </div>
      @for (holiday of toConfirm(); track holiday.id) {
        <div class="history-row" data-testid="to-confirm">
          <div class="leave-type-icon"><app-icon name="calendar" [size]="18" /></div>
          <div>
            <strong>{{ holiday.name }}</strong>
            <span>Tentatively {{ formatShortDate(holiday.date) }}</span>
          </div>
          <span>in {{ plural(daysUntil(holiday.date, today), 'day') }}</span>
          <span></span>
        </div>
      } @empty {
        <p class="attendance-off">No tentative holidays in the next two months.</p>
      }
    </section>

    <app-onboarding-progress-card />
    <app-documents-to-collect />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HrOverviewPage {
  private readonly session = inject(Session);
  private readonly hr = inject(HrApi);
  private readonly holidaysApi = inject(HolidaysApi);
  protected readonly today = maldivesToday();

  private readonly everyone = this.hr.employees();
  private readonly thisYear = this.holidaysApi.forYear(() => String(yearOf(this.today)));
  private readonly nextYear = this.holidaysApi.forYear(() => String(yearOf(this.today) + 1));

  protected readonly greeting = greetingFor(maldivesHour());
  protected readonly dateLabel = formatBannerDate(this.today).toUpperCase();
  protected readonly firstName = computed(() => this.session.user()?.fullName.split(' ')[0] ?? '');
  protected readonly preview = PREVIEW;

  protected readonly people = computed(() => valueOr(this.everyone, []));
  protected readonly inToday = computed(() => this.people().filter(({ today }) => today && IN_OFFICE.includes(today.status)).length);
  protected readonly line = computed(() => `${plural(this.people().length, 'person', 'people')} at Opro. ${this.inToday()} in today.`);
  protected readonly onLeave = computed(() => this.people().filter(({ today }) => today?.status === 'on-leave'));
  protected readonly inbox = inboxCount();
  protected readonly visaAlerts = computed(() => visaAlertsFor(this.people(), this.today));
  protected readonly toConfirm = computed(() => {
    const until = addDays(this.today, CONFIRM_WINDOW_DAYS);
    return [...valueOr(this.thisYear, []), ...valueOr(this.nextYear, [])]
      .filter(({ isTentative, date }) => isTentative && date >= this.today && date <= until)
      .sort((first, second) => first.date.localeCompare(second.date));
  });

  protected readonly formatShortDate = formatShortDate;
  protected readonly daysUntil = daysUntil;
  protected readonly plural = plural;
}
