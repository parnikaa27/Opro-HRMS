import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { PortalView } from '../session';
import { MY_NAV, TEAM_NAV } from './nav-items';
import { PortalNav } from './portal-nav';
import { SiteFooter } from './site-footer';
import { TopBar } from './top-bar';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, TopBar, PortalNav, SiteFooter],
  template: `
    <button type="button" class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-card focus:px-4 focus:py-2" (click)="main.focus()">
      Skip to content
    </button>
    <app-top-bar [view]="view()" />
    <div class="mx-auto flex w-full max-w-7xl flex-1 gap-10 px-4 sm:px-6 lg:px-8">
      <app-portal-nav layout="rail" [items]="navItems()" class="hidden w-48 shrink-0 py-10 lg:block" />
      <main #main id="main" tabindex="-1" class="min-w-0 flex-1 py-6 outline-none lg:py-10">
        <router-outlet />
      </main>
    </div>
    <app-site-footer />
    <app-portal-nav layout="bar" [items]="navItems()" class="lg:hidden" />
  `,
  host: { class: 'flex min-h-dvh flex-col pb-20 lg:pb-0 print:pb-0' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  private readonly router = inject(Router);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  protected readonly view = computed<PortalView>(() => (this.url().startsWith('/team') ? 'team' : 'mine'));
  protected readonly navItems = computed(() => (this.view() === 'team' ? TEAM_NAV : MY_NAV));
}
