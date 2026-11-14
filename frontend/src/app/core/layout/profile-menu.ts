import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Avatar } from '../../shared/ui/avatar';
import { Dismiss } from '../../shared/ui/dismiss';
import { Icon } from '../../shared/ui/icon';
import { PortalView, Session } from '../session';

@Component({
  selector: 'app-profile-menu',
  imports: [Avatar, Icon, RouterLink],
  template: `
    @if (session.user(); as user) {
      <button type="button" class="profile-button" [attr.aria-expanded]="isOpen()" aria-label="Your account" (click)="isOpen.set(!isOpen())" data-testid="account-button">
        <app-avatar [name]="user.fullName" />
        <span>
          <strong>{{ user.fullName }}</strong>
          <small>{{ subtitle() }}</small>
        </span>
        <app-icon name="chevronDown" [size]="15" />
      </button>
      @if (isOpen()) {
        <div class="notification-popover profile-popover">
          <a routerLink="/profile" (click)="isOpen.set(false)">Your profile and ID card</a>
          <button type="button" (click)="signOut()" data-testid="sign-out">Sign out</button>
        </div>
      }
    }
  `,
  host: { class: 'notification-wrap' },
  hostDirectives: [Dismiss],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileMenu {
  protected readonly session = inject(Session);
  readonly view = input.required<PortalView>();
  protected readonly isOpen = signal(false);
  private readonly closeOnDismiss = inject(Dismiss).dismissed.subscribe(() => this.isOpen.set(false));

  protected readonly subtitle = computed(() => {
    const user = this.session.user();
    return this.view() === 'team' ? (user?.designation ?? '') : `Employee · ${user?.id ?? ''}`;
  });

  protected async signOut() {
    this.isOpen.set(false);
    try {
      await this.session.signOut();
    } catch (error) {
      console.error('Sign out request failed, cleared the session locally', error);
    }
  }
}
