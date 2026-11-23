import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BankAccount } from '../../models/record';
import { Avatar } from '../../shared/ui/avatar';
import { Dialog } from '../../shared/ui/dialog';
import { Icon } from '../../shared/ui/icon';
import { ListSkeleton } from '../../shared/ui/list-skeleton';
import { valueOr } from '../../shared/utils/resource';
import { DecisionState } from '../team/decision-state';
import { DeclineForm } from '../team/decline-form';
import { submittedAgo } from '../team/request-row';
import { HrApi } from './hr-api';

// Bank details people entered, waiting for HR to check against their bank letter, oldest first. Part of the inbox.
@Component({
  selector: 'app-banks-to-check',
  imports: [Avatar, DeclineForm, Dialog, Icon, ListSkeleton, RouterLink],
  template: `
    <section class="card all-requests" data-testid="banks-to-check">
      <div class="card-heading">
        <div>
          <span class="eyebrow">Bank details</span>
          <h2>To check</h2>
        </div>
      </div>
      @if (waiting.error()) {
        <p class="attendance-off">Bank details didn't load. Refresh the page to try again.</p>
      } @else if (waiting.isLoading() && list().length === 0) {
        <app-list-skeleton [count]="2" />
      } @else {
        @for (bank of list(); track bank.employeeId) {
          <div class="large-request inbox-request" data-testid="waiting-bank">
            <app-avatar [name]="bank.employeeName ?? ''" />
            <div>
              <a [routerLink]="['/hr/people', bank.employeeId]" class="person-cell"><strong>{{ bank.employeeName }}</strong></a>
              <span>{{ bank.bankName }} · {{ submittedAgo(bank.submittedOn) }}</span>
            </div>
            <div><small>Account</small><strong>{{ bank.accountName }}, {{ bank.accountNumber }} {{ bank.currency }}</strong></div>
            <div class="request-actions labeled">
              <button type="button" class="decline" [disabled]="decisions.busyId() === bank.employeeId" (click)="declining.set(bank)" data-testid="bank-send-back"><app-icon name="x" [size]="16" /> Send back</button>
              <button type="button" class="approve" [disabled]="decisions.busyId() === bank.employeeId" (click)="verify(bank)" data-testid="bank-verify"><app-icon name="check" [size]="16" /> Verify</button>
            </div>
            @if (decisions.failedId() === bank.employeeId) {
              <p class="row-error" role="alert">That didn't save. Try again in a moment.</p>
            }
          </div>
        } @empty {
          <p class="attendance-off">Nothing to check. Bank details people enter on their profile land here.</p>
        }
      }
    </section>

    <app-dialog heading="Send back" [isOpen]="declining() !== undefined" (isOpenChange)="$event || declining.set(undefined)">
      @if (declining(); as bank) {
        <app-decline-form eyebrow="Bank details" [heading]="'Send back ' + firstName(bank) + '’s bank details?'" confirmLabel="Send back" placeholder="The account name doesn't match the bank letter." [name]="bank.employeeName ?? ''" (declined)="sendBack(bank, $event)" (cancelled)="declining.set(undefined)" />
      }
    </app-dialog>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BanksToCheck {
  private readonly api = inject(HrApi);
  protected readonly waiting = this.api.waitingBanks();
  protected readonly list = computed(() => valueOr(this.waiting, []));
  protected readonly decisions = new DecisionState();
  protected readonly declining = signal<BankAccount | undefined>(undefined);
  protected readonly submittedAgo = submittedAgo;
  protected readonly firstName = ({ employeeName }: BankAccount) => (employeeName ?? '').split(' ')[0];

  protected verify({ employeeId = '' }: BankAccount) {
    return this.decisions.run(employeeId, () => this.api.decideBank(employeeId, 'verified'), () => this.waiting.reload());
  }

  protected async sendBack({ employeeId = '' }: BankAccount, note: string) {
    this.declining.set(undefined);
    await this.decisions.run(employeeId, () => this.api.decideBank(employeeId, 'rejected', note), () => this.waiting.reload());
  }
}
