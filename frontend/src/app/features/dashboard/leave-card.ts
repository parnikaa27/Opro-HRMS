import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LeaveBalance } from '../../models/leave';
import { Card } from '../../shared/ui/card';
import { Icon } from '../../shared/ui/icon';
import { plural } from '../../shared/utils/text';
import { LeaveApi } from '../leave/leave-api';
import { valueOr } from '../../shared/utils/resource';

const available = (balance: LeaveBalance) => balance.entitled - balance.taken - balance.pending;

@Component({
  selector: 'app-leave-card',
  imports: [Card, RouterLink, Icon],
  template: `
    <app-card label="Leave left" [isLoading]="balances.isLoading()" [hasError]="!!balances.error()">
      @if (annual(); as balance) {
        <p class="mt-3">
          <span class="font-display text-5xl" data-testid="annual-left">{{ available(balance) }}</span>
          <span class="ms-1 text-sm text-soft">days of annual leave</span>
        </p>
      }
      <dl class="mt-4 space-y-2 text-sm">
        @for (balance of others(); track balance.type) {
          <div class="flex justify-between gap-3">
            <dt class="text-soft">{{ typeName(balance.type) }}</dt>
            <dd>{{ available(balance) }}</dd>
          </div>
        }
      </dl>
      @if (pendingDays() > 0) {
        <p class="mt-4 text-sm text-soft">{{ plural(pendingDays(), 'day') }} waiting for approval</p>
      }
      <a routerLink="/leave" class="mt-5 inline-flex items-center gap-1 text-sm font-medium text-sea hover:underline">
        Apply for leave <app-icon name="arrow" class="size-4" />
      </a>
    </app-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeaveCard {
  private readonly api = inject(LeaveApi);

  protected readonly balances = this.api.balances();
  private readonly types = this.api.types();

  private readonly list = computed(() => valueOr(this.balances, []));
  protected readonly annual = computed(() => this.list().find((balance) => balance.type === 'annual'));
  protected readonly others = computed(() => this.list().filter((balance) => balance.type !== 'annual'));
  protected readonly pendingDays = computed(() => this.list().reduce((total, balance) => total + balance.pending, 0));

  protected readonly typeName = (code: string) => valueOr(this.types, []).find((type) => type.code === code)?.name ?? code;
  protected readonly available = available;
  protected readonly plural = plural;
}
