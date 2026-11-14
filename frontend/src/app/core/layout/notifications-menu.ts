import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CompanyApi } from '../company-api';
import { Icon } from '../../shared/ui/icon';
import { formatShortDate } from '../../shared/utils/date-time';
import { valueOr } from '../../shared/utils/resource';

@Component({
  selector: 'app-notifications-menu',
  imports: [Icon],
  template: `
    <button
      type="button"
      popovertarget="notifications-panel"
      class="relative grid size-10 place-items-center rounded-full text-soft transition-colors hover:bg-card hover:text-ink"
      [attr.aria-label]="unread() ? 'Notifications, ' + unread() + ' unread' : 'Notifications'"
      data-testid="notifications-button"
    >
      <app-icon name="bell" />
      @if (unread()) {
        <span class="absolute top-1 right-1 min-w-4 rounded-full bg-coral px-1 text-center text-[10px] leading-4 font-medium text-on-sea" aria-hidden="true">
          {{ unread() }}
        </span>
      }
    </button>

    <div id="notifications-panel" popover class="menu-panel" data-testid="notifications-panel">
      <div class="flex items-center justify-between gap-3">
        <h2 class="eyebrow">Notifications</h2>
        @if (unread()) {
          <button type="button" class="text-sm font-medium text-sea hover:underline" (click)="markAllRead()" data-testid="mark-all-read">Mark all as read</button>
        }
      </div>
      @if (markFailed()) {
        <p class="mt-2 text-sm text-danger" role="alert">Couldn't mark them as read. Try again.</p>
      }
      <ul class="mt-2">
        @for (item of items(); track item.id) {
          <li class="border-t border-line py-3 first:border-t-0">
            <p class="text-sm" [class.font-medium]="!item.isRead">{{ item.text }}</p>
            <p class="mt-0.5 text-xs text-soft">{{ formatShortDate(item.createdOn) }}</p>
          </li>
        } @empty {
          <li class="py-3 text-sm text-soft">Nothing new. We'll tell you when something needs you.</li>
        }
      </ul>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationsMenu {
  private readonly api = inject(CompanyApi);

  protected readonly notifications = this.api.notifications();
  protected readonly items = computed(() => valueOr(this.notifications, []));
  protected readonly unread = computed(() => this.items().filter((item) => !item.isRead).length);
  protected readonly markFailed = signal(false);
  protected readonly formatShortDate = formatShortDate;

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
