import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Quota } from '../../models/record';
import { ConfirmButton } from '../../shared/ui/confirm-button';
import { Dialog } from '../../shared/ui/dialog';
import { ListSkeleton } from '../../shared/ui/list-skeleton';
import { StatusPill, Tone } from '../../shared/ui/status-pill';
import { formatCompactDate, maldivesToday } from '../../shared/utils/date-time';
import { expiryStatus } from '../../shared/utils/expiry';
import { valueOr } from '../../shared/utils/resource';
import { QuotaForm } from './forms/quota-form';
import { HrApi } from './hr-api';

// Editing means a quota is open in the form. "new" means adding one.
type Editing = Quota | 'new' | undefined;

// The expatriate quota on the Visas page: slots granted per job category, how many are used, and when each runs out.
@Component({
  selector: 'app-quota-card',
  imports: [ConfirmButton, Dialog, ListSkeleton, QuotaForm, StatusPill],
  template: `
    <section class="card full-table" data-testid="quota-card">
      <div class="card-heading">
        <div>
          <span class="eyebrow">Expatriate quota</span>
          <h2>Quota approvals</h2>
        </div>
        <button type="button" class="primary-button compact" (click)="editing.set('new')" data-testid="add-quota">Add quota</button>
      </div>
      @if (quotas.error()) {
        <p class="attendance-off">The quota didn't load. Refresh the page to try again.</p>
      } @else if (quotas.isLoading() && list().length === 0) {
        <app-list-skeleton [count]="3" />
      } @else {
        <div class="table-wrap">
          <table class="stacks">
            <thead>
              <tr><th scope="col">Job category</th><th scope="col">Slots used</th><th scope="col">Approval</th><th scope="col">Expires</th><th scope="col"><span class="sr-only">Actions</span></th></tr>
            </thead>
            <tbody>
              @for (quota of list(); track quota.id) {
                <tr data-testid="quota-row">
                  <td><strong>{{ quota.jobCategory }}</strong></td>
                  <td data-label="Slots used">{{ quota.used }} of {{ quota.slots }} <app-status-pill [tone]="usage(quota).tone">{{ usage(quota).label }}</app-status-pill></td>
                  <td data-label="Approval">{{ quota.approvalNumber }}</td>
                  <td data-label="Expires">{{ formatCompactDate(quota.expiresOn) }} <app-status-pill [tone]="expiry(quota).tone">{{ expiry(quota).label }}</app-status-pill></td>
                  <td class="row-actions">
                    <button type="button" class="text-link" (click)="editing.set(quota)" data-testid="edit-quota">Edit</button>
                    <app-confirm-button label="Remove" [question]="'Remove the ' + quota.jobCategory + ' quota?'" yes="Yes, remove it" testId="remove-quota" (confirmed)="remove(quota)" />
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="5">No quota approvals yet. Add each one the Ministry grants.</td></tr>
              }
            </tbody>
          </table>
        </div>
        @if (uncovered().length) {
          <p class="table-note" data-testid="uncovered">No quota on file for: {{ uncovered().join(', ') }}.</p>
        }
        @if (removeFailed()) {
          <p class="row-error" role="alert">That didn't remove. Try again in a moment.</p>
        }
      }
    </section>

    <app-dialog heading="Quota" [isOpen]="editing() !== undefined" (isOpenChange)="$event || editing.set(undefined)">
      @if (editing(); as open) {
        <app-quota-form [quota]="open === 'new' ? undefined : open" [categories]="categories()" (saved)="saved()" (cancelled)="editing.set(undefined)" />
      }
    </app-dialog>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuotaCard {
  private readonly api = inject(HrApi);
  private readonly today = maldivesToday();
  // The job categories on expatriates' records, to spot any without a quota.
  readonly categories = input<readonly string[]>([]);

  protected readonly quotas = this.api.quotas();
  protected readonly list = computed(() => valueOr(this.quotas, []));
  protected readonly uncovered = computed(() => {
    const covered = new Set(this.list().map(({ jobCategory }) => jobCategory.trim().toLowerCase()));
    return this.categories().filter((category) => !covered.has(category.trim().toLowerCase()));
  });
  protected readonly editing = signal<Editing>(undefined);
  protected readonly removeFailed = signal(false);
  protected readonly formatCompactDate = formatCompactDate;

  protected readonly usage = ({ used, slots }: Quota): { label: string; tone: Tone } =>
    used > slots ? { label: 'Over quota', tone: 'danger' } : used === slots ? { label: 'Full', tone: 'late' } : { label: `${slots - used} free`, tone: 'ok' };
  protected readonly expiry = ({ expiresOn }: Quota): { label: string; tone: Tone } =>
    ({ valid: { label: 'Valid', tone: 'ok' as const }, expiring: { label: 'Expires soon', tone: 'late' as const }, expired: { label: 'Expired', tone: 'danger' as const } })[
      expiryStatus(expiresOn, this.today)
    ];

  protected saved() {
    this.editing.set(undefined);
    this.quotas.reload();
  }

  protected async remove({ id }: Quota) {
    this.removeFailed.set(false);
    try {
      await this.api.removeQuota(id);
      this.quotas.reload();
    } catch (error) {
      console.error('Removing a quota failed', error);
      this.removeFailed.set(true);
    }
  }
}
