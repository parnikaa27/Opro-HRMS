import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { valueOr } from '../../shared/utils/resource';
import { HrApi, NOTHING_WAITING } from '../../features/hr/hr-api';
import { isWaitingForHr } from '../../shared/utils/approval-step';
import { TeamApi, ViewScope } from '../../features/team/team-api';
import { SavedChanges } from '../saved-changes';
import { PortalView, Session } from '../session';
import { BadgeKey, COMPANY_NAV, EMPLOYEE_NAV, HR_NAV, MANAGER_NAV } from './nav-items';
import { Sidebar } from './sidebar';
import { SiteFooter } from './site-footer';
import { TopBar } from './top-bar';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, Sidebar, SiteFooter, TopBar],
  template: `
    <button type="button" class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2" (click)="main.focus()">
      Skip to content
    </button>
    <div class="app-shell">
      <app-sidebar [items]="navItems()" [badges]="badges()" [(isOpen)]="isNavOpen" />
      <div class="app-content">
        <app-top-bar [view]="view()" [navItems]="navItems()" (menuOpened)="isNavOpen.set(true)" />
        <main #main id="main" tabindex="-1" class="outline-none">
          <router-outlet />
        </main>
        <app-site-footer />
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  private readonly router = inject(Router);
  private readonly session = inject(Session);
  private readonly team = inject(TeamApi);
  private readonly hr = inject(HrApi);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  protected readonly view = computed<PortalView>(() => (['team', 'hr', 'company'] as const).find((view) => this.url().startsWith(`/${view}`)) ?? 'mine');
  protected readonly navItems = computed(() => ({ mine: EMPLOYEE_NAV, team: MANAGER_NAV, hr: HR_NAV, company: COMPANY_NAV })[this.view()]);
  protected readonly isNavOpen = signal(false);

  // What's waiting: an HOD's team, everyone for a super admin, and HR's inbox.
  private readonly scope = computed<ViewScope>(() => (this.view() === 'company' ? 'company' : 'team'));
  private readonly countsWaiting = computed(() => (this.view() === 'company' ? this.session.isSuperAdmin() : this.view() === 'team' && this.session.isManager()));
  private readonly pendingLeave = this.team.leaveRequests({ status: 'pending', isEnabled: this.countsWaiting, scope: this.scope });
  private readonly pendingFixes = this.team.corrections({ status: 'pending', isEnabled: this.countsWaiting, scope: this.scope });
  private readonly pendingHomeDays = this.team.homeDays({ status: 'pending', isEnabled: this.countsWaiting, scope: this.scope });
  private readonly pendingCompOffs = this.team.compOffs({ status: 'pending', isEnabled: this.countsWaiting, scope: this.scope });
  private readonly pendingOvertime = this.team.overtime({ status: 'pending', isEnabled: this.countsWaiting, scope: this.scope });
  private readonly changeRequests = this.hr.changeRequests({ isEnabled: () => this.view() === 'hr' && this.session.isHr() });
  private readonly waitingDocuments = this.hr.waitingDocuments({ isEnabled: () => this.view() === 'hr' && this.session.isHr() });
  private readonly waitingBanks = this.hr.waitingBanks({ isEnabled: () => this.view() === 'hr' && this.session.isHr() });
  private readonly waitingApprovals = this.hr.approvals({ isEnabled: () => this.view() === 'hr' && this.session.isHr() });
  protected readonly badges = computed<Partial<Record<BadgeKey, number>>>(() => ({
    approvals: [valueOr(this.pendingLeave, []), valueOr(this.pendingFixes, []), valueOr(this.pendingHomeDays, []), valueOr(this.pendingCompOffs, []), valueOr(this.pendingOvertime, [])].reduce(
      (total, list) => total + list.filter((item) => !isWaitingForHr(item)).length,
      0,
    ),
    inbox: valueOr(this.changeRequests, []).filter(({ status }) => status === 'open').length + valueOr(this.waitingDocuments, []).length + valueOr(this.waitingBanks, []).length +
      Object.values(valueOr(this.waitingApprovals, NOTHING_WAITING)).reduce((total, list) => total + list.length, 0),
  }));

  constructor() {
    const saves = inject(SavedChanges).count;
    const seen = saves();
    effect(() => {
      if (saves() !== seen) {
        untracked(() => [this.pendingLeave, this.pendingFixes, this.pendingHomeDays, this.pendingCompOffs, this.pendingOvertime, this.changeRequests, this.waitingDocuments, this.waitingBanks, this.waitingApprovals].forEach((counts) => counts.reload()));
      }
    });
  }
}
