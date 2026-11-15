import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { FlightClaim, FlightYear } from '../../models/flight';
import { Icon } from '../../shared/ui/icon';
import { StatusPill, Tone } from '../../shared/ui/status-pill';
import { formatShortDate } from '../../shared/utils/date-time';
import { CURRENCIES, formatMoney, fromUsd } from '../../shared/utils/money';
import { CurrencyChoice } from './currency-choice';

const STATUS: Record<FlightClaim['status'], { label: string; tone: Tone }> = {
  pending: { label: 'Waiting for HR', tone: 'late' },
  approved: { label: 'Approved', tone: 'ok' },
  rejected: { label: 'Declined', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};

// The year's allowance, what's used and left, and every claim, in whichever currency the reader picks.
@Component({
  selector: 'app-flight-summary',
  imports: [Icon, StatusPill],
  template: `
    <div class="currency-switch" role="group" aria-label="Show amounts in">
      @for (option of currencies; track option) {
        <button type="button" [attr.aria-pressed]="choice.currency() === option" (click)="choice.choose(option)" [attr.data-testid]="'currency-' + option">{{ option }}</button>
      }
    </div>
    <dl class="flight-stats" data-testid="flight-stats">
      <div><dt>Allowance {{ year().year }}</dt><dd>{{ money(year().allowanceUsd ?? 0) }}</dd></div>
      <div><dt>Used</dt><dd>{{ money(year().usedUsd) }}</dd></div>
      <div><dt>Waiting</dt><dd>{{ money(year().pendingUsd) }}</dd></div>
      <div><dt>Left</dt><dd data-testid="flight-left">{{ money(left()) }}</dd></div>
    </dl>
    @for (claim of year().claims; track claim.id) {
      <div class="history-row" data-testid="flight-claim">
        <div class="leave-type-icon"><app-icon name="plane" [size]="18" /></div>
        <div>
          <strong>{{ claim.route }}</strong>
          <span>
            {{ formatShortDate(claim.flightDate) }} · {{ formatMoney(claim.amount, claim.currency) }}{{ claim.currency === 'USD' ? '' : ' (' + formatMoney(claim.amountUsd, 'USD') + ')' }}
            @if (claim.decisionNote) {
              · {{ claim.decisionNote }}
            }
          </span>
        </div>
        <app-status-pill [tone]="status[claim.status].tone">{{ status[claim.status].label }}</app-status-pill>
        <span class="row-actions">
          @if (claim.hasReceipt) {
            <a [href]="receiptPath() + '/' + claim.id + '/receipt'" target="_blank" rel="noopener" class="text-link">Receipt</a>
          }
          @if (canCancel() && claim.status === 'pending') {
            <button type="button" class="text-link" (click)="cancelled.emit(claim)" data-testid="cancel-claim">Cancel</button>
          }
        </span>
      </div>
    } @empty {
      <p class="attendance-off">No flights claimed yet.</p>
    }
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FlightSummary {
  protected readonly choice = inject(CurrencyChoice);

  readonly year = input.required<FlightYear>();
  // Where receipts open from: the person's own path, or HR's.
  readonly receiptPath = input.required<string>();
  readonly canCancel = input(false);
  readonly cancelled = output<FlightClaim>();

  protected readonly currencies = CURRENCIES;
  protected readonly status = STATUS;
  protected readonly left = computed(() => (this.year().allowanceUsd ?? 0) - this.year().usedUsd - this.year().pendingUsd);
  protected readonly money = (usd: number) => formatMoney(fromUsd(usd, this.choice.currency(), this.year().ratesPerUsd), this.choice.currency());
  protected readonly formatMoney = formatMoney;
  protected readonly formatShortDate = formatShortDate;
}
