import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PortalView, Session } from '../session';
import { AccountMenu } from './account-menu';
import { NotificationsMenu } from './notifications-menu';

const VIEW_OPTIONS: readonly { value: PortalView; short: string; long: string }[] = [
  { value: 'mine', short: 'Me', long: 'My view' },
  { value: 'team', short: 'Team', long: 'Team view' },
];

@Component({
  selector: 'app-top-bar',
  imports: [RouterLink, AccountMenu, NotificationsMenu],
  template: `
    <header class="sticky top-0 z-30 border-b border-line bg-canvas/85 backdrop-blur no-print">
      <div class="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:px-8">
        <a routerLink="/" class="me-auto flex items-baseline gap-1.5" aria-label="Opro HRMS home">
          <span class="font-display text-2xl font-medium tracking-tight">opro</span>
          <span class="text-xs text-soft">people</span>
        </a>

        @if (session.isManager()) {
          <div role="group" aria-label="Switch view" class="flex rounded-full bg-sea-soft p-1 text-sm">
            @for (option of viewOptions; track option.value) {
              <button
                type="button"
                class="rounded-full px-3 py-1 text-sea transition-colors duration-300 ease-spring aria-pressed:bg-sea aria-pressed:text-on-sea"
                [attr.aria-pressed]="view() === option.value"
                [attr.data-testid]="'view-' + option.value"
                (click)="session.switchView(option.value)"
              >
                <span class="sm:hidden">{{ option.short }}</span>
                <span class="hidden sm:inline">{{ option.long }}</span>
              </button>
            }
          </div>
        }

        <app-notifications-menu />
        <app-account-menu />
      </div>
    </header>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopBar {
  protected readonly session = inject(Session);
  protected readonly viewOptions = VIEW_OPTIONS;
  readonly view = input.required<PortalView>();
}
