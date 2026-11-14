import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Dialog } from '../../shared/ui/dialog';
import { maldivesToday, yearOf } from '../../shared/utils/date-time';
import { valueOr } from '../../shared/utils/resource';
import { HolidaysApi } from '../holidays/holidays-api';
import { LeaveApi } from './leave-api';
import { LeaveBalances } from './leave-balances';
import { LeaveForm } from './leave-form';
import { LeaveRequests } from './leave-requests';

@Component({
  selector: 'app-leave-page',
  imports: [Dialog, LeaveBalances, LeaveForm, LeaveRequests],
  template: `
    <header class="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="font-display text-3xl tracking-tight sm:text-4xl">Leave</h1>
        <p class="mt-2 text-soft">What you have left for {{ year }}, and every request you've made.</p>
      </div>
      <button type="button" class="btn-primary" (click)="isApplying.set(true)" data-testid="apply-leave">Apply for leave</button>
    </header>

    <section aria-labelledby="balances-heading">
      <h2 id="balances-heading" class="eyebrow mb-3">Balances</h2>
      @if (balances.error()) {
        <p class="text-sm text-danger">Your balances didn't load. Refresh the page to try again.</p>
      } @else {
        <app-leave-balances [balances]="balanceList()" [types]="typeList()" />
      }
    </section>

    <section class="mt-10" aria-labelledby="requests-heading">
      <h2 id="requests-heading" class="eyebrow mb-3">Your requests</h2>
      @if (requests.error()) {
        <p class="text-sm text-danger">Your requests didn't load. Refresh the page to try again.</p>
      } @else {
        <app-leave-requests [requests]="requestList()" [types]="typeList()" (changed)="refresh()" />
      }
    </section>

    <app-dialog heading="Apply for leave" [(isOpen)]="isApplying">
      <app-leave-form [types]="typeList()" [balances]="balanceList()" [holidays]="holidayDates()" (applied)="onApplied()" />
    </app-dialog>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeavePage {
  private readonly leaveApi = inject(LeaveApi);
  private readonly holidaysApi = inject(HolidaysApi);

  protected readonly year = yearOf(maldivesToday());
  protected readonly isApplying = signal(false);

  protected readonly balances = this.leaveApi.balances();
  protected readonly requests = this.leaveApi.requests();
  private readonly types = this.leaveApi.types();
  private readonly thisYearHolidays = this.holidaysApi.forYear(() => String(this.year));
  private readonly nextYearHolidays = this.holidaysApi.forYear(() => String(this.year + 1));

  protected readonly balanceList = computed(() => valueOr(this.balances, []));
  protected readonly requestList = computed(() => valueOr(this.requests, []));
  protected readonly typeList = computed(() => valueOr(this.types, []));
  protected readonly holidayDates = computed(
    () => new Set([...valueOr(this.thisYearHolidays, []), ...valueOr(this.nextYearHolidays, [])].map(({ date }) => date)),
  );

  protected refresh() {
    this.balances.reload();
    this.requests.reload();
  }

  protected onApplied() {
    this.isApplying.set(false);
    this.refresh();
  }
}
