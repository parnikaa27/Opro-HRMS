import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CorrectionRequest } from '../../models/attendance';
import { StatusPill, Tone } from '../../shared/ui/status-pill';
import { formatShortDate } from '../../shared/utils/date-time';

const STATUS: Record<CorrectionRequest['status'], { label: string; tone: Tone }> = {
  pending: { label: 'Waiting', tone: 'late' },
  approved: { label: 'Fixed', tone: 'ok' },
  rejected: { label: 'Not approved', tone: 'danger' },
};

@Component({
  selector: 'app-correction-list',
  imports: [StatusPill],
  template: `
    <ul class="divide-y divide-line rounded-2xl border border-line bg-card shadow-lift">
      @for (item of sorted(); track item.id) {
        <li class="flex flex-wrap items-start justify-between gap-3 p-5" data-testid="correction">
          <div>
            <p class="font-medium">{{ formatShortDate(item.date) }}, punch {{ item.kind === 'missed-in' ? 'in' : 'out' }} at {{ item.requestedTime }}</p>
            <p class="mt-1 text-sm text-soft">{{ item.reason }}</p>
          </div>
          <app-status-pill [tone]="status[item.status].tone">{{ status[item.status].label }}</app-status-pill>
        </li>
      } @empty {
        <li class="p-5 text-sm text-soft">No fixes requested. If the device misses a punch, ask for a fix and it shows up here.</li>
      }
    </ul>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CorrectionList {
  readonly corrections = input.required<readonly CorrectionRequest[]>();
  protected readonly sorted = computed(() => [...this.corrections()].sort((first, second) => second.date.localeCompare(first.date)));
  protected readonly status = STATUS;
  protected readonly formatShortDate = formatShortDate;
}
