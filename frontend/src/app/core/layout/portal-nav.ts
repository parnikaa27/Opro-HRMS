import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Icon } from '../../shared/ui/icon';
import { NavItem } from './nav-items';

// One nav, two shapes: a side rail on wide screens and a bottom tab bar on phones.
@Component({
  selector: 'app-portal-nav',
  imports: [RouterLink, RouterLinkActive, Icon],
  template: `
    <nav aria-label="Main">
      @if (layout() === 'rail') {
        <ul class="sticky top-24 space-y-1">
          @for (item of items(); track item.path) {
            <li>
              <a
                [routerLink]="item.path"
                routerLinkActive=""
                [routerLinkActiveOptions]="{ exact: true }"
                ariaCurrentWhenActive="page"
                class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-soft transition-colors hover:bg-card hover:text-ink aria-[current=page]:bg-card aria-[current=page]:font-medium aria-[current=page]:text-ink aria-[current=page]:shadow-lift"
              >
                <app-icon [name]="item.icon" />
                {{ item.label }}
              </a>
            </li>
          }
        </ul>
      } @else {
        <ul class="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur no-print">
          @for (item of items(); track item.path) {
            <li class="flex-1">
              <a
                [routerLink]="item.path"
                routerLinkActive=""
                [routerLinkActiveOptions]="{ exact: true }"
                ariaCurrentWhenActive="page"
                class="flex flex-col items-center gap-1 py-2.5 text-[11px] text-soft aria-[current=page]:font-medium aria-[current=page]:text-sea"
              >
                <app-icon [name]="item.icon" />
                {{ item.label }}
              </a>
            </li>
          }
        </ul>
      }
    </nav>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortalNav {
  readonly items = input.required<readonly NavItem[]>();
  readonly layout = input<'rail' | 'bar'>('rail');
}
