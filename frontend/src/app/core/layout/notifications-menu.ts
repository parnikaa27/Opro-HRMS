import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AppNotification } from '../../models/company';
import { Dismiss } from '../../shared/ui/dismiss';
import { Icon } from '../../shared/ui/icon';
import { valueOr } from '../../shared/utils/resource';
import { CompanyApi } from '../company-api';

const TITLES: Record<AppNotification['kind'], string> = {
  approval: 'Waiting for you',
  leave: 'Leave request updated',
  visa: 'Visa reminder',
  correction: 'Punch fix updated',
  holiday: 'Holiday confirmed',
  announcement: 'From HR',
  record: 'Your record changed',
  schedule: 'Working hours',
};

@Component({
  selector: 'app-notifications-menu',
  imports: [Icon],
  template: `
    <button
      type="button"
      class="icon-button"
      [attr.aria-label]="unread() ? 'Notifications, ' + unread() + ' unread' : 'Notifications'"
      [attr.aria-expanded]="isOpen()"
      (click)="isOpen.set(!isOpen())"
      data-testid="notifications-button"
    >
      <app-icon name="bell" [size]="19" />
      @if (unread()) {
        <i></i>
      }
    </button>
    @if (isOpen()) {
      <div class="notification-popover" data-testid="notifications-panel">
        <div>
          <strong>Notifications</strong>
          @if (unread()) {
            <span>{{ unread() }} new</span>
          }
        </div>
        @for (item of items(); track item.id) {
          <p [class.is-read]="item.isRead"><b>{{ titles[item.kind] }}</b>{{ item.text }}</p>
        } @empty {
          <p><b>All caught up</b>We'll tell you when something needs you.</p>
        }
        @if (unread()) {
          <button type="button" class="popover-action" (click)="markAllRead()" data-testid="mark-all-read">Mark all as read</button>
        }
        @if (markFailed()) {
          <p class="popover-error" role="alert">Couldn't mark them as read. Try again.</p>
        }
      </div>
    }
  `,
  host: { class: 'notification-wrap' },
  hostDirectives: [Dismiss],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationsMenu {
  private readonly api = inject(CompanyApi);

  protected readonly notifications = this.api.notifications();
  protected readonly items = computed(() => valueOr(this.notifications, []));
  protected readonly unread = computed(() => this.items().filter((item) => !item.isRead).length);
  protected readonly isOpen = signal(false);
  private readonly closeOnDismiss = inject(Dismiss).dismissed.subscribe(() => this.isOpen.set(false));
  protected readonly markFailed = signal(false);
  protected readonly titles = TITLES;

  protected async markAllRead() {
    this.markFailed.set(false);
    try {
      await this.api.markAllRead();
      this.notifications.reload();
    } catch (error) {
      console.error('Marking notifications read failed', error);
      this.markFailed.set(true);
    }
  }
}
