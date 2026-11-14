import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { valueOr } from '../../shared/utils/resource';
import { TeamApi } from '../../features/team/team-api';
import { PortalView, Session } from '../session';
import { EMPLOYEE_NAV, MANAGER_NAV } from './nav-items';
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
      <app-sidebar [items]="navItems()" [pendingCount]="pendingCount()" [(isOpen)]="isNavOpen" />
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

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  protected readonly view = computed<PortalView>(() => (this.url().startsWith('/team') ? 'team' : 'mine'));
  protected readonly navItems = computed(() => (this.view() === 'team' ? MANAGER_NAV : EMPLOYEE_NAV));
  protected readonly isNavOpen = signal(false);

  private readonly pendingLeave = this.team.leaveRequests({ status: 'pending', isEnabled: this.session.isManager });
  private readonly pendingFixes = this.team.corrections({ status: 'pending', isEnabled: this.session.isManager });
  protected readonly pendingCount = computed(() => valueOr(this.pendingLeave, []).length + valueOr(this.pendingFixes, []).length);
}
