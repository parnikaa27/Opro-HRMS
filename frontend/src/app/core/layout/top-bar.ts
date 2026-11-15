import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { Icon } from '../../shared/ui/icon';
import { PortalView, Session } from '../session';
import { NavItem } from './nav-items';
import { NotificationsMenu } from './notifications-menu';
import { PortalSearch } from './portal-search';
import { ProfileMenu } from './profile-menu';

const VIEW_OPTIONS: readonly { value: PortalView; label: string }[] = [
  { value: 'mine', label: 'Employee' },
  { value: 'team', label: 'HOD' },
  { value: 'hr', label: 'HR' },
  { value: 'company', label: 'Super admin' },
];

@Component({
  selector: 'app-top-bar',
  imports: [Icon, NotificationsMenu, PortalSearch, ProfileMenu],
  template: `
    <header class="topbar no-print">
      <button type="button" class="mobile-menu" aria-label="Open navigation" (click)="menuOpened.emit()" data-testid="open-menu">
        <app-icon name="menu" [size]="22" />
      </button>
      <app-portal-search [items]="navItems()" [view]="view()" />
      <div class="top-actions">
        @if (viewOptions().length > 1) {
          <div class="role-switch" role="group" aria-label="Switch view">
            @for (option of viewOptions(); track option.value) {
              <button
                type="button"
                [class.active]="view() === option.value"
                [attr.aria-pressed]="view() === option.value"
                (click)="session.switchView(option.value)"
                [attr.data-testid]="'view-' + option.value"
              >
                {{ option.label }}
              </button>
            }
          </div>
        }
        <app-notifications-menu />
        <app-profile-menu [view]="view()" />
      </div>
    </header>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopBar {
  protected readonly session = inject(Session);
  // Everyone has their own view. HODs, HR and super admins get theirs on top.
  private readonly hasView: Record<PortalView, () => boolean> = {
    mine: () => true,
    team: this.session.isManager,
    hr: this.session.isHr,
    company: this.session.isSuperAdmin,
  };
  protected readonly viewOptions = computed(() => VIEW_OPTIONS.filter(({ value }) => this.hasView[value]()));
  readonly view = input.required<PortalView>();
  readonly navItems = input.required<readonly NavItem[]>();
  readonly menuOpened = output();
}
