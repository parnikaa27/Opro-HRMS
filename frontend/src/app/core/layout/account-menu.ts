import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Session } from '../session';
import { Theme, THEME_CHOICES } from '../theme';
import { Avatar } from '../../shared/ui/avatar';
import { Icon } from '../../shared/ui/icon';

@Component({
  selector: 'app-account-menu',
  imports: [Avatar, Icon, RouterLink],
  template: `
    @if (session.user(); as user) {
      <button type="button" popovertarget="account-panel" class="grid place-items-center rounded-full" aria-label="Your account" data-testid="account-button">
        <app-avatar [name]="user.fullName" />
      </button>

      <div id="account-panel" popover #panel class="menu-panel sm:w-72">
        <p class="font-medium">{{ user.fullName }}</p>
        <p class="truncate text-sm text-soft">{{ user.email }}</p>

        <a routerLink="/profile" class="mt-4 block rounded-lg py-2 text-sm font-medium text-sea hover:underline" (click)="panel.hidePopover()">
          Your profile and ID card
        </a>

        <div class="mt-3 border-t border-line pt-3" role="group" aria-labelledby="appearance-label">
          <p id="appearance-label" class="eyebrow">Appearance</p>
          <div class="mt-2 flex rounded-full bg-canvas p-1 text-sm">
            @for (choice of themeChoices; track choice) {
              <button
                type="button"
                class="flex-1 rounded-full py-1 capitalize text-soft transition-colors aria-pressed:bg-card aria-pressed:text-ink aria-pressed:shadow-lift"
                [attr.aria-pressed]="theme.choice() === choice"
                (click)="theme.choice.set(choice)"
              >
                {{ choice }}
              </button>
            }
          </div>
        </div>

        <button type="button" class="mt-4 flex w-full items-center gap-2 border-t border-line pt-3 text-sm text-soft hover:text-ink" (click)="signOut()" data-testid="sign-out">
          <app-icon name="logout" />
          Sign out
        </button>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountMenu {
  protected readonly session = inject(Session);
  protected readonly theme = inject(Theme);
  protected readonly themeChoices = THEME_CHOICES;

  protected async signOut() {
    try {
      await this.session.signOut();
    } catch (error) {
      console.error('Sign out request failed, cleared the session locally', error);
    }
  }
}
