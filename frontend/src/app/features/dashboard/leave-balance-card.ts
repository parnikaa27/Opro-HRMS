import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LeaveBalance } from '../../models/leave';
import { Icon } from '../../shared/ui/icon';
import { valueOr } from '../../shared/utils/resource';
import { plural } from '../../shared/utils/text';
import { LeaveApi } from '../leave/leave-api';

const SHOWN_TYPES = 2;
const available = ({ entitled, taken, pending }: LeaveBalance) => entitled - taken - pending;

@Component({
  selector: 'app-leave-balance-card',
  imports: [Icon, RouterLink],
  template: `
    <section class="card balance-card" [attr.aria-busy]="balances.isLoading()">
      <div class="card-heading">
        <div>
          <span class="eyebrow">LEAVE BALANCE</span>
          <h2>Your time off</h2>
        </div>
        <a routerLink="/leave" class="more" aria-label="All leave balances"><app-icon name="more" /></a>
      </div>
      @if (balances.error()) {
        <p class="attendance-off">Your balance didn't load. Refresh the page to try again.</p>
      } @else {
        <div class="leave-stats">
          <div class="big-stat">
            <strong data-testid="days-available">{{ total() }}</strong>
            <span>days available</span>
          </div>
          <div class="mini-stats">
            @for (balance of shown(); track balance.type; let index = $index) {
              <div>
                <i [class.sick]="index === 1"></i>
                <span>{{ nameOf(balance.type) }}<b>{{ plural(available(balance), 'day') }}</b></span>
              </div>
            }
          </div>
        </div>
      }
      <a routerLink="/leave" [queryParams]="{ apply: 1 }" class="primary-button" data-testid="request-leave">
        <app-icon name="plus" [size]="17" /> Request leave
      </a>
    </section>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeaveBalanceCard {
  private readonly api = inject(LeaveApi);
  protected readonly balances = this.api.balances();
  private readonly types = this.api.types();

  private readonly list = computed(() => valueOr(this.balances, []));
  protected readonly total = computed(() => this.list().reduce((sum, balance) => sum + available(balance), 0));
  protected readonly shown = computed(() => this.list().slice(0, SHOWN_TYPES));

  protected readonly nameOf = (code: string) => valueOr(this.types, []).find((type) => type.code === code)?.name ?? code;
  protected readonly available = available;
  protected readonly plural = plural;
}
