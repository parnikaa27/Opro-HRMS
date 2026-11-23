import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Announcement } from '../../models/company';
import { ConfirmButton } from '../../shared/ui/confirm-button';
import { Dialog } from '../../shared/ui/dialog';
import { Icon } from '../../shared/ui/icon';
import { ListSkeleton } from '../../shared/ui/list-skeleton';
import { formatShortDate } from '../../shared/utils/date-time';
import { valueOr } from '../../shared/utils/resource';
import { DecisionState } from '../team/decision-state';
import { AnnouncementForm } from './forms/announcement-form';
import { HrApi } from './hr-api';

@Component({
  selector: 'app-hr-announcements-page',
  imports: [AnnouncementForm, ConfirmButton, Dialog, Icon, ListSkeleton],
  template: `
    <div class="page-view">
      <div class="page-title">
        <div>
          <span class="eyebrow">From HR</span>
          <h1>Announcements</h1>
          <p>Short notes everyone sees on their overview. A new one also lands in their notifications.</p>
        </div>
        <button type="button" class="primary-button" (click)="editing.set({})" data-testid="new-announcement"><app-icon name="plus" [size]="17" /> New announcement</button>
      </div>

      <section class="card request-history">
        @if (announcements.error()) {
          <p class="attendance-off">Announcements didn't load. Refresh the page to try again.</p>
        } @else if (announcements.isLoading() && list().length === 0) {
          <app-list-skeleton [count]="3" />
        } @else {
          @for (note of list(); track note.id) {
            <div class="history-row" data-testid="announcement-row">
              <div class="leave-type-icon"><app-icon name="megaphone" [size]="18" /></div>
              <div>
                <strong>{{ note.title }}</strong>
                <span>{{ note.body }}</span>
                <div class="row-actions">
                  Posted {{ formatShortDate(note.publishedOn) }}
                  <button type="button" class="text-link" (click)="editing.set({ item: note })" data-testid="edit-announcement">Edit</button>
                  <app-confirm-button label="Delete" question="Take this down for everyone?" yes="Yes, take it down" (confirmed)="remove(note.id)" />
                </div>
                @if (rows.failedId() === note.id) {
                  <p class="row-error" role="alert">That didn't save. Try again in a moment.</p>
                }
              </div>
              <span></span>
              <span></span>
            </div>
          } @empty {
            <p class="attendance-off">Nothing posted. Overviews show no HR note until you add one.</p>
          }
        }
      </section>
    </div>

    <app-dialog heading="Announcement" [isOpen]="editing() !== undefined" (isOpenChange)="$event || editing.set(undefined)">
      @if (editing(); as target) {
        <app-announcement-form [announcement]="target.item" (saved)="saved()" (cancelled)="editing.set(undefined)" />
      }
    </app-dialog>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HrAnnouncementsPage {
  private readonly api = inject(HrApi);
  protected readonly announcements = this.api.announcements();
  protected readonly rows = new DecisionState();
  protected readonly editing = signal<{ item?: Announcement } | undefined>(undefined);
  protected readonly list = computed(() => [...valueOr(this.announcements, [])].sort((first, second) => second.publishedOn.localeCompare(first.publishedOn)));
  protected readonly formatShortDate = formatShortDate;

  protected remove(id: string) {
    return this.rows.run(id, () => this.api.deleteAnnouncement(id), () => this.announcements.reload());
  }

  protected saved() {
    this.editing.set(undefined);
    this.announcements.reload();
  }
}
