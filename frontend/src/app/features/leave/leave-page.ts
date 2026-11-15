import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Dialog } from '../../shared/ui/dialog';
import { Icon } from '../../shared/ui/icon';
import { SuccessState } from '../../shared/ui/success-state';
import { maldivesToday, yearOf } from '../../shared/utils/date-time';
import { valueOr } from '../../shared/utils/resource';
import { HolidaysApi } from '../holidays/holidays-api';
import { LeaveApi } from './leave-api';
import { LeaveBalances } from './leave-balances';
import { LeaveForm } from './leave-form';
import { LeaveRequests } from './leave-requests';
import { ListSkeleton } from '../../shared/ui/list-skeleton';

@Component({
  selector: 'app-leave-page',
  imports: [Dialog, Icon, LeaveBalances, LeaveForm, LeaveRequests, ListSkeleton, SuccessState],
  template: `
    <div class="page-view">
      <div class="page-title">
        <div>
          <span class="eyebrow">TIME OFF</span>
          <h1>Leave &amp; time off</h1>
          <p>Plan your time off and keep track of request statuses.</p>
        </div>
        <button type="button" class="primary-button compact" (click)="isApplying.set(true)" data-testid="apply-leave"><app-icon name="plus" [size]="17" /> Request leave</button>
      </div>

      @if (balances.error()) {
        <p class="attendance-off">Your balances didn't load. Refresh the page to try again.</p>
      } @else if (balances.isLoading() && balanceList().length === 0) {
        <app-list-skeleton [count]="1" />
      } @else {
        <app-leave-balances [balances]="balanceList()" [types]="typeList()" />
      }

      @if (requests.error()) {
        <p class="attendance-off">Your requests didn't load. Refresh the page to try again.</p>
      } @else if (requests.isLoading() && requestList().length === 0) {
        <app-list-skeleton />
      } @else {
        <app-leave-requests [requests]="requestList()" [types]="typeList()" certificatePath="/api/leave/requests" (changed)="refresh()" />
      }
    </div>

    <app-dialog heading="Request leave" [(isOpen)]="isApplying">
      @if (wasApplied()) {
        <app-success-state heading="Request submitted" [body]="isCertificateMissing() ? 'Your manager has been notified. Add your medical certificate from your request history when you have it.' : 'Your manager has been notified. You can track the status from the Leave page.'" (done)="closeForm()" />
      } @else {
        <app-leave-form [types]="typeList()" [balances]="balanceList()" [holidays]="holidayDates()" (applied)="onApplied($event)" (cancelled)="closeForm()" />
      }
    </app-dialog>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeavePage {
  private readonly leaveApi = inject(LeaveApi);
  private readonly holidaysApi = inject(HolidaysApi);

  private readonly year = yearOf(maldivesToday());
  // The overview's "Request leave" button links here with ?apply=1.
  protected readonly isApplying = signal(inject(ActivatedRoute).snapshot.queryParamMap.has('apply'));

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

  protected readonly wasApplied = signal(false);
  protected readonly isCertificateMissing = signal(false);

  protected onApplied(isCertificateMissing: boolean) {
    this.isCertificateMissing.set(isCertificateMissing);
    this.wasApplied.set(true);
    this.refresh();
  }

  protected closeForm() {
    this.isApplying.set(false);
    this.wasApplied.set(false);
  }
}
