import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AllowanceGrant } from '../../models/allowance';
import { Avatar } from '../../shared/ui/avatar';
import { Dialog } from '../../shared/ui/dialog';
import { Icon } from '../../shared/ui/icon';
import { ListSkeleton } from '../../shared/ui/list-skeleton';
import { valueOr } from '../../shared/utils/resource';
import { DecisionState } from '../team/decision-state';
import { DeclineForm } from '../team/decline-form';
import { AllowanceApi, money } from './allowance-api';

// One-off allowances HODs granted, for HR to approve or decline. Part of the inbox.
@Component({
  selector: 'app-grants-to-decide',
  imports: [Avatar, DeclineForm, Dialog, Icon, ListSkeleton, RouterLink],
  template: `
    <section class="card all-requests" data-testid="grants-to-decide">
      <div class="card-heading"><div><span class="eyebrow">ALLOWANCES</span><h2>One-off grants</h2></div></div>
      @if (waiting.error()) {
        <p class="attendance-off">Grants didn't load. Refresh the page to try again.</p>
      } @else if (waiting.isLoading() && list().length === 0) {
        <app-list-skeleton [count]="1" />
      } @else {
        @for (grant of list(); track grant.id) {
          <div class="large-request inbox-request" data-testid="waiting-grant">
            <app-avatar [name]="grant.employeeName ?? ''" />
            <div>
              <a [routerLink]="['/hr/people', grant.employeeId]" class="person-cell"><strong>{{ grant.employeeName }}</strong></a>
              <span>From {{ grant.grantedByName }} · “{{ grant.reason }}”</span>
            </div>
            <div><small>{{ grant.typeName.toUpperCase() }}</small><strong>{{ money(grant.amount, grant.currency) }}</strong></div>
            <div class="request-actions labeled">
              <button type="button" class="decline" [disabled]="decisions.busyId() === grant.id" (click)="declining.set(grant)" data-testid="reject"><app-icon name="x" [size]="16" /> Decline</button>
              <button type="button" class="approve" [disabled]="decisions.busyId() === grant.id" (click)="approve(grant)" data-testid="approve"><app-icon name="check" [size]="16" /> Approve</button>
            </div>
            @if (decisions.failedId() === grant.id) {
              <p class="row-error" role="alert">That didn't save. Try again in a moment.</p>
            }
          </div>
        } @empty {
          <p class="attendance-off">No one-off allowances waiting.</p>
        }
      }
    </section>

    <app-dialog heading="Decline allowance" [isOpen]="declining() !== undefined" (isOpenChange)="$event || declining.set(undefined)">
      @if (declining(); as grant) {
        <app-decline-form [name]="grant.grantedByName ?? ''" placeholder="The ferry company is paying for the taxis." (declined)="decline(grant, $event)" (cancelled)="declining.set(undefined)" />
      }
    </app-dialog>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GrantsToDecide {
  private readonly api = inject(AllowanceApi);
  protected readonly waiting = this.api.waitingForHr();
  protected readonly list = computed(() => valueOr(this.waiting, []));
  protected readonly decisions = new DecisionState();
  protected readonly declining = signal<AllowanceGrant | undefined>(undefined);
  protected readonly money = money;

  protected approve({ id }: AllowanceGrant) {
    return this.decisions.run(id, () => this.api.decide(id, { decision: 'approved' }), () => this.waiting.reload());
  }

  protected decline({ id }: AllowanceGrant, note: string) {
    this.declining.set(undefined);
    return this.decisions.run(id, () => this.api.decide(id, { decision: 'rejected', note }), () => this.waiting.reload());
  }
}
