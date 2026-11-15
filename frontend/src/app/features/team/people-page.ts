import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Avatar } from '../../shared/ui/avatar';
import { Icon } from '../../shared/ui/icon';
import { ListSkeleton } from '../../shared/ui/list-skeleton';
import { StatusPill } from '../../shared/ui/status-pill';
import { statusToday } from '../../shared/utils/attendance-status';
import { formatCompactDate, maldivesToday } from '../../shared/utils/date-time';
import { valueOr } from '../../shared/utils/resource';
import { HrApi } from '../hr/hr-api';
import { RequestScope, TeamApi, TeamMember } from './team-api';

@Component({
  selector: 'app-people-page',
  imports: [Avatar, Icon, ListSkeleton, RouterLink, StatusPill],
  template: `
    <div class="page-view">
      <div class="page-title">
        <div>
          <span class="eyebrow">DIRECTORY</span>
          <h1>People</h1>
          <p>{{ scope() === 'team' ? 'Your team members and their current work status.' : 'Everyone at Opro and where they are today.' }}</p>
        </div>
        <div class="title-actions">
          <div class="header-search people-search">
            <app-icon name="search" [size]="17" />
            <input #box placeholder="Search employee" aria-label="Search employee" [value]="query()" (input)="query.set(box.value)" data-testid="people-search" />
          </div>
          @if (scope() === 'hr') {
            <a class="primary-button compact" routerLink="/hr/people/new" data-testid="add-person"><app-icon name="plus" [size]="17" /> Add person</a>
          }
        </div>
      </div>
      @if (scope() === 'hr') {
        <label class="filter-check"><input #former type="checkbox" [checked]="showsFormer()" (change)="showsFormer.set(former.checked)" data-testid="show-former" /> Show people who've left</label>
      }
      @if (scope() === 'company' && whereToday(); as places) {
        <p class="where-today" data-testid="where-today">
          @for (place of places; track place.label) {
            <app-status-pill [tone]="place.tone">{{ place.count }} {{ place.label }}</app-status-pill>
          }
        </p>
      }
      @if (members().error()) {
        <p class="attendance-off">Your team didn't load. Refresh the page to try again.</p>
      } @else if (members().isLoading() && list().length === 0) {
        <app-list-skeleton [count]="4" />
      } @else {
        <div class="people-grid">
          @for (person of shown(); track person.id) {
            <div class="card person-card" data-testid="person-card">
              <app-avatar [name]="person.fullName" [photoUrl]="person.photoUrl" [isLarge]="true" />
              <app-status-pill [tone]="statusOf(person).tone">{{ statusOf(person).label }}</app-status-pill>
              <h3>{{ person.fullName }}</h3>
              <p>{{ person.designation }}</p>
              <div>
                <span><app-icon name="mail" [size]="14" />{{ person.email }}</span>
                <span><app-icon name="mapPin" [size]="14" />{{ person.workLocation }}</span>
              </div>
              <a class="secondary-button" [routerLink]="profileLink(person.id)">View profile</a>
            </div>
          } @empty {
            <p class="attendance-off">{{ query() ? 'Nobody matches “' + query() + '”.' : scope() === 'team' ? 'Nobody reports to you yet.' : 'Nobody here yet.' }}</p>
          }
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PeoplePage {
  // Set from route data: an HOD sees their reports, HR and super admins see everyone.
  readonly scope = input<RequestScope>('team');

  private readonly team = inject(TeamApi).members({ isEnabled: () => this.scope() !== 'hr', scope: () => (this.scope() === 'company' ? 'company' : 'team') });
  protected readonly showsFormer = signal(false);
  private readonly everyone = inject(HrApi).employees({ isEnabled: () => this.scope() === 'hr', includesFormer: this.showsFormer });
  private readonly today = maldivesToday();
  protected readonly members = computed(() => (this.scope() === 'hr' ? this.everyone : this.team));
  protected readonly query = signal('');
  protected readonly list = computed(() => [...valueOr(this.members(), [])].sort((first, second) => first.fullName.localeCompare(second.fullName)));
  protected readonly profileLink = (id: string) => ({ hr: ['/hr/people', id], team: ['/team', id], company: ['/company', id] })[this.scope()];
  // Where everyone is today, for a super admin: in, from home, at a resort, on leave, not in.
  protected readonly whereToday = computed(() => {
    const days = this.list().map(({ today }) => today);
    const count = (isThere: (day: TeamMember['today']) => boolean) => days.filter(isThere).length;
    // A declined day from home has punches but counts as absent.
    const isIn = (day: TeamMember['today']) => day !== undefined && day.punches.length > 0 && day.status !== 'absent';
    return [
      { label: 'at the office', tone: 'ok' as const, count: count((day) => isIn(day) && (day?.workMode ?? 'office') === 'office') },
      { label: 'from home', tone: 'sea' as const, count: count((day) => isIn(day) && day?.workMode === 'home') },
      { label: 'at a resort', tone: 'sea' as const, count: count((day) => isIn(day) && day?.workMode === 'resort') },
      { label: 'on leave', tone: 'leave' as const, count: count((day) => day?.status === 'on-leave') },
      { label: 'not in', tone: 'neutral' as const, count: count((day) => !isIn(day) && day?.status !== 'on-leave') },
    ];
  });
  protected readonly shown = computed(() => {
    const needle = this.query().trim().toLowerCase();
    return this.list().filter(({ fullName, designation }) => `${fullName} ${designation}`.toLowerCase().includes(needle));
  });

  protected readonly statusOf = (person: TeamMember) =>
    person.lastDay && person.lastDay < this.today ? { label: `Left ${formatCompactDate(person.lastDay)}`, tone: 'neutral' as const } : statusToday(person.today);
}
