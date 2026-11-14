import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AttendanceStatus } from '../../models/attendance';
import { Avatar } from '../../shared/ui/avatar';
import { Icon } from '../../shared/ui/icon';
import { StatusPill } from '../../shared/ui/status-pill';
import { ATTENDANCE_STATUS } from '../../shared/utils/attendance-status';
import { formatFullDate, formatLongDate, formatTime, maldivesToday } from '../../shared/utils/date-time';
import { expiryStatus } from '../../shared/utils/expiry';
import { valueOr } from '../../shared/utils/resource';
import { plural } from '../../shared/utils/text';
import { TeamApi, TeamMember } from './team-api';
import { ListSkeleton } from '../../shared/ui/list-skeleton';

const OFF_DAYS: readonly AttendanceStatus[] = ['weekend', 'holiday'];
const IN_OFFICE: readonly AttendanceStatus[] = ['present', 'late', 'half-day', 'incomplete'];

const statusOf = (member: TeamMember): AttendanceStatus => member.today?.status ?? 'not-in-yet';

const visaWarnings = (member: TeamMember, today: string) => {
  const visa = member.visa;
  if (!visa) {
    return [];
  }
  return [
    { document: 'visa', expiry: visa.visaExpiry },
    { document: 'passport', expiry: visa.passportExpiry },
  ]
    .map(({ document, expiry }) => ({ document, expiry, status: expiryStatus(expiry, today) }))
    .filter(({ status }) => status !== 'valid')
    .map(({ document, expiry, status }) => ({
      id: `${member.id}-${document}`,
      memberId: member.id,
      text: `${member.fullName}'s ${document} ${status === 'expired' ? 'expired' : 'expires'} on ${formatFullDate(expiry)}`,
    }));
};

@Component({
  selector: 'app-team-today-page',
  imports: [ListSkeleton, Avatar, Icon, RouterLink, StatusPill],
  template: `
    <header class="mb-8">
      <h1 class="font-display text-3xl tracking-tight sm:text-4xl">Your team today</h1>
      <p class="mt-2 text-soft">{{ longDate }}.@if (!members.isLoading()) { {{ headcount() }}}</p>
    </header>

    @if (waitingCount() > 0) {
      <a routerLink="/team/approvals" class="mb-6 flex items-center justify-between gap-4 rounded-2xl bg-coral-soft px-5 py-4 text-coral transition-[filter] hover:brightness-95" data-testid="waiting-banner">
        <span class="font-medium">{{ waitingText() }}</span>
        <app-icon name="arrow" />
      </a>
    }

    @if (members.error()) {
      <p class="text-sm text-danger">Your team didn't load. Refresh the page to try again.</p>
    } @else if (members.isLoading() && list().length === 0) {
      <app-list-skeleton [count]="5" />
    } @else {
      @if (isDayOff()) {
        <p class="mb-6 rounded-2xl bg-sea-soft px-5 py-4 text-sea" data-testid="day-off">Nobody's expected in today. Enjoy the quiet.</p>
      } @else {
        <dl class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          @for (stat of stats(); track stat.key) {
            <div class="rounded-2xl bg-card px-4 py-3 shadow-lift">
              <dt class="eyebrow">{{ stat.label }}</dt>
              <dd class="mt-1 text-2xl font-medium" [attr.data-testid]="'today-' + stat.key">{{ stat.value }}</dd>
            </div>
          }
        </dl>
      }

      <ul class="divide-y divide-line rounded-2xl border border-line bg-card shadow-lift">
        @for (member of sorted(); track member.id) {
          <li data-testid="team-member">
            <a [routerLink]="['/team', member.id]" class="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-canvas">
              <app-avatar [name]="member.fullName" />
              <span class="min-w-0 flex-1">
                <span class="block truncate font-medium">{{ member.fullName }}</span>
                <span class="block truncate text-sm text-soft">{{ member.designation }}</span>
              </span>
              <span class="hidden text-sm text-soft sm:inline">{{ timeNote(member) }}</span>
              <app-status-pill [tone]="info(member).tone">{{ info(member).label }}</app-status-pill>
            </a>
          </li>
        } @empty {
          <li class="px-5 py-4 text-sm text-soft">Nobody reports to you yet.</li>
        }
      </ul>

      @if (warnings().length > 0) {
        <section class="mt-10" aria-labelledby="visa-watch-heading">
          <h2 id="visa-watch-heading" class="eyebrow mb-3">Visa watch</h2>
          <ul class="divide-y divide-line rounded-2xl border border-line bg-card shadow-lift">
            @for (warning of warnings(); track warning.id) {
              <li class="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-sm" data-testid="visa-warning">
                <span>{{ warning.text }}</span>
                <a [routerLink]="['/team', warning.memberId]" class="font-medium text-sea hover:underline">See details</a>
              </li>
            }
          </ul>
        </section>
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamTodayPage {
  private readonly api = inject(TeamApi);
  private readonly today = maldivesToday();

  protected readonly longDate = formatLongDate(this.today);
  protected readonly members = this.api.members();
  private readonly pendingLeave = this.api.leaveRequests({ status: 'pending' });
  private readonly pendingFixes = this.api.corrections({ status: 'pending' });

  protected readonly list = computed(() => valueOr(this.members, []));
  protected readonly sorted = computed(() => [...this.list()].sort((first, second) => first.fullName.localeCompare(second.fullName)));
  protected readonly headcount = computed(() => `${plural(this.list().length, 'person', 'people')} ${this.list().length === 1 ? 'reports' : 'report'} to you.`);
  protected readonly isDayOff = computed(() => this.list().length > 0 && this.list().every((member) => OFF_DAYS.includes(statusOf(member))));

  protected readonly stats = computed(() => {
    const count = (statuses: readonly AttendanceStatus[]) => this.list().filter((member) => statuses.includes(statusOf(member))).length;
    return [
      { key: 'in', label: 'In', value: count(IN_OFFICE) },
      { key: 'late', label: 'Late', value: count(['late', 'half-day']) },
      { key: 'not-in', label: 'Not in yet', value: count(['not-in-yet', 'absent']) },
      { key: 'leave', label: 'On leave', value: count(['on-leave']) },
    ];
  });

  protected readonly waitingCount = computed(() => valueOr(this.pendingLeave, []).length + valueOr(this.pendingFixes, []).length);
  protected readonly waitingText = computed(() => {
    const parts = [
      plural(valueOr(this.pendingLeave, []).length, 'leave request'),
      plural(valueOr(this.pendingFixes, []).length, 'punch fix', 'punch fixes'),
    ].filter((part) => !part.startsWith('0 '));
    return `${parts.join(' and ')} waiting for you`;
  });

  protected readonly warnings = computed(() => this.sorted().flatMap((member) => visaWarnings(member, this.today)));

  protected readonly info = (member: TeamMember) => ATTENDANCE_STATUS[statusOf(member)];
  protected readonly timeNote = ({ today }: TeamMember) => {
    const last = today?.punches.at(-1);
    if (!last) {
      return '';
    }
    return last.direction === 'in' ? `In since ${formatTime(today?.punches[0]?.at ?? last.at)}` : `Left at ${formatTime(last.at)}`;
  };
}
