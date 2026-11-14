import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CorrectionRequest } from '../../models/attendance';
import { Icon } from '../../shared/ui/icon';
import { StatusPill, Tone } from '../../shared/ui/status-pill';
import { formatShortDate } from '../../shared/utils/date-time';

const STATUS: Record<CorrectionRequest['status'], { label: string; tone: Tone }> = {
  pending: { label: 'Pending', tone: 'late' },
  approved: { label: 'Fixed', tone: 'ok' },
  rejected: { label: 'Declined', tone: 'danger' },
};

@Component({
  selector: 'app-correction-list',
  imports: [Icon, StatusPill],
  template: `
    <section class="card request-history">
      <div class="card-heading">
        <div>
          <span class="eyebrow">PUNCH FIXES</span>
          <h2>Fixes you asked for</h2>
        </div>
      </div>
      @for (item of sorted(); track item.id) {
        <div class="history-row" data-testid="correction">
          <div class="leave-type-icon"><app-icon name="fingerprint" [size]="18" /></div>
          <div>
            <strong>Punch {{ item.kind === 'missed-in' ? 'in' : 'out' }} at {{ item.requestedTime }}</strong>
            <span>{{ formatShortDate(item.date) }} · {{ item.reason }}@if (item.decisionNote) { · “{{ item.decisionNote }}”}</span>
          </div>
          <span></span>
          <app-status-pill [tone]="status[item.status].tone">{{ status[item.status].label }}</app-status-pill>
        </div>
      } @empty {
        <p class="attendance-off">No fixes requested. If the device misses a punch, ask for a fix and it shows up here.</p>
      }
    </section>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CorrectionList {
  readonly corrections = input.required<readonly CorrectionRequest[]>();
  protected readonly sorted = computed(() => [...this.corrections()].sort((first, second) => second.date.localeCompare(first.date)));
  protected readonly status = STATUS;
  protected readonly formatShortDate = formatShortDate;
}
