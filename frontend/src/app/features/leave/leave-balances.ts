import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LeaveBalance, LeaveType } from '../../models/leave';

const PERCENT = 100;

@Component({
  selector: 'app-leave-balances',
  template: `
    <ul class="grid gap-4 @md:grid-cols-2 @2xl:grid-cols-3">
      @for (balance of balances(); track balance.type) {
        <li class="rounded-2xl border border-line bg-card p-5 shadow-lift" data-testid="leave-balance">
          <h3 class="eyebrow">{{ nameOf(balance.type) }}</h3>
          <p class="mt-3">
            <span class="font-display text-4xl">{{ available(balance) }}</span>
            <span class="ms-1 text-sm text-soft">of {{ balance.entitled }} left</span>
          </p>
          <div class="mt-4 flex h-1.5 overflow-hidden rounded-full bg-canvas" aria-hidden="true">
            <div class="bg-sea" [style.width.%]="share(balance.taken, balance)"></div>
            <div class="bg-sea/35" [style.width.%]="share(balance.pending, balance)"></div>
          </div>
          <p class="mt-2 text-xs text-soft">{{ usage(balance) }}</p>
        </li>
      }
    </ul>
  `,
  host: { class: '@container block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeaveBalances {
  readonly balances = input.required<readonly LeaveBalance[]>();
  readonly types = input.required<readonly LeaveType[]>();

  protected readonly nameOf = (code: string) => this.types().find((type) => type.code === code)?.name ?? code;
  protected readonly available = (balance: LeaveBalance) => balance.entitled - balance.taken - balance.pending;
  protected readonly usage = ({ taken, pending }: LeaveBalance) => `${taken} taken${pending > 0 ? `, ${pending} waiting for approval` : ''}`;
  protected readonly share = (days: number, balance: LeaveBalance) => (balance.entitled > 0 ? (days / balance.entitled) * PERCENT : 0);
}
