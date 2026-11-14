import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Avatar } from '../../shared/ui/avatar';
import { Icon } from '../../shared/ui/icon';
import { ListSkeleton } from '../../shared/ui/list-skeleton';
import { StatusPill } from '../../shared/ui/status-pill';
import { ATTENDANCE_STATUS } from '../../shared/utils/attendance-status';
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
          <p>{{ scope() === 'hr' ? 'Everyone at Opro and where they are today.' : 'Your team members and their current work status.' }}</p>
        </div>
        <div class="header-search people-search">
          <app-icon name="search" [size]="17" />
          <input #box placeholder="Search employee" aria-label="Search employee" [value]="query()" (input)="query.set(box.value)" data-testid="people-search" />
        </div>
      </div>
      @if (members().error()) {
        <p class="attendance-off">Your team didn't load. Refresh the page to try again.</p>
      } @else if (members().isLoading() && list().length === 0) {
        <app-list-skeleton [count]="4" />
      } @else {
        <div class="people-grid">
          @for (person of shown(); track person.id) {
            <div class="card person-card" data-testid="person-card">
              <app-avatar [name]="person.fullName" [isLarge]="true" />
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
            <p class="attendance-off">{{ query() ? 'Nobody matches “' + query() + '”.' : 'Nobody reports to you yet.' }}</p>
          }
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PeoplePage {
  // Set from route data: managers see their reports, HR sees everyone.
  readonly scope = input<RequestScope>('team');

  private readonly team = inject(TeamApi).members({ isEnabled: () => this.scope() === 'team' });
  private readonly everyone = inject(HrApi).employees({ isEnabled: () => this.scope() === 'hr' });
  protected readonly members = computed(() => (this.scope() === 'hr' ? this.everyone : this.team));
  protected readonly query = signal('');
  protected readonly list = computed(() => [...valueOr(this.members(), [])].sort((first, second) => first.fullName.localeCompare(second.fullName)));
  protected readonly profileLink = (id: string) => (this.scope() === 'hr' ? ['/hr/people', id] : ['/team', id]);
  protected readonly shown = computed(() => {
    const needle = this.query().trim().toLowerCase();
    return this.list().filter(({ fullName, designation }) => `${fullName} ${designation}`.toLowerCase().includes(needle));
  });

  protected readonly statusOf = (person: TeamMember) => ATTENDANCE_STATUS[person.today?.status ?? 'not-in-yet'];
}
