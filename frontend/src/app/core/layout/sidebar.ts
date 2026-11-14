import { ChangeDetectionStrategy, Component, computed, inject, input, model } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { COMPANY } from '../config';
import { Session } from '../session';
import { Icon } from '../../shared/ui/icon';
import { Logo } from '../../shared/ui/logo';
import { NavItem } from './nav-items';

@Component({
  selector: 'app-sidebar',
  imports: [Icon, Logo, RouterLink, RouterLinkActive],
  template: `
    @if (isOpen()) {
      <button type="button" class="sidebar-backdrop" aria-label="Close navigation" (click)="isOpen.set(false)"></button>
    }
    <aside class="sidebar no-print" [class.open]="isOpen()">
      <div class="sidebar-brand">
        <app-logo />
        <button type="button" class="mobile-close" aria-label="Close navigation" (click)="isOpen.set(false)">
          <app-icon name="x" />
        </button>
      </div>
      <div class="workspace-label">WORKSPACE</div>
      <nav aria-label="Main">
        @for (item of items(); track item.path) {
          <a
            [routerLink]="item.path"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: item.isExact ?? false }"
            ariaCurrentWhenActive="page"
            (click)="isOpen.set(false)"
            [attr.data-testid]="'nav-' + item.label.toLowerCase()"
          >
            <app-icon [name]="item.icon" [size]="19" [strokeWidth]="1.8" />
            <span>{{ item.label }}</span>
            @if (item.showsPendingCount && pendingCount() > 0) {
              <b [attr.aria-label]="pendingCount() + ' waiting'">{{ pendingCount() }}</b>
            }
          </a>
        }
      </nav>
      <div class="sidebar-bottom">
        <a [href]="'mailto:' + company.hrEmail">
          <app-icon name="help" [size]="19" />
          <span>Help &amp; support</span>
        </a>
        <div class="location-card">
          <div class="location-icon"><app-icon name="mapPin" [size]="18" /></div>
          <div>
            <span>Current office</span>
            <strong>{{ office() }}</strong>
          </div>
        </div>
        <button type="button" class="signout" (click)="signOut()" data-testid="sidebar-sign-out">
          <app-icon name="logout" [size]="19" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Sidebar {
  private readonly session = inject(Session);

  readonly items = input.required<readonly NavItem[]>();
  readonly pendingCount = input(0);
  readonly isOpen = model(false);

  protected readonly company = COMPANY;
  protected readonly office = computed(() => {
    const location = this.session.user()?.workLocation ?? '';
    return location.startsWith('Hulhumalé') ? 'Hulhumalé, Maldives' : 'Malé, Maldives';
  });

  protected async signOut() {
    try {
      await this.session.signOut();
    } catch (error) {
      console.error('Sign out request failed, cleared the session locally', error);
    }
  }
}
