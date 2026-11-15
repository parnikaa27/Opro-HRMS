import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FlightClaim } from '../../models/flight';
import { Avatar } from '../../shared/ui/avatar';
import { Dialog } from '../../shared/ui/dialog';
import { Icon } from '../../shared/ui/icon';
import { ListSkeleton } from '../../shared/ui/list-skeleton';
import { formatDayShort } from '../../shared/utils/date-time';
import { formatMoney } from '../../shared/utils/money';
import { valueOr } from '../../shared/utils/resource';
import { DecisionState } from '../team/decision-state';
import { DeclineForm } from '../team/decline-form';
import { submittedAgo } from '../team/request-row';
import { HrApi } from './hr-api';

// Flight claims waiting for HR, oldest first. Each person's page has the decided ones.
@Component({
  selector: 'app-flight-claims-inbox',
  imports: [Avatar, DeclineForm, Dialog, Icon, ListSkeleton, RouterLink],
  template: `
    <section class="card all-requests" data-testid="flight-claims">
      <div class="card-heading">
        <div>
          <span class="eyebrow">FLIGHT ALLOWANCE</span>
          <h2>Flight claims</h2>
        </div>
      </div>
      @if (claims.error()) {
        <p class="attendance-off">Flight claims didn't load. Refresh the page to try again.</p>
      } @else if (claims.isLoading() && waiting().length === 0) {
        <app-list-skeleton [count]="2" />
      } @else {
        @for (claim of waiting(); track claim.id) {
          <div class="large-request" data-testid="flight-claim-row">
            <app-avatar [name]="claim.employeeName ?? ''" />
            <div>
              <a [routerLink]="['/hr/people', claim.employeeId]" class="person-cell"><strong>{{ claim.employeeName }}</strong></a>
              <span>{{ claim.route }} · {{ submittedAgo(claim.raisedOn) }}</span>
            </div>
            <div><small>FLIGHT</small><strong>{{ formatDayShort(claim.flightDate) }}</strong></div>
            <div><small>AMOUNT</small><strong>{{ formatMoney(claim.amount, claim.currency) }}{{ claim.currency === 'USD' ? '' : ' (' + formatMoney(claim.amountUsd, 'USD') + ')' }}</strong></div>
            <div>
              <small>RECEIPT</small>
              @if (claim.hasReceipt) {
                <a [href]="'/api/hr/flight-claims/' + claim.id + '/receipt'" target="_blank" rel="noopener" class="text-link">Open</a>
              } @else {
                <strong>None attached</strong>
              }
            </div>
            <div class="request-actions labeled">
              <button type="button" class="decline" [disabled]="decisions.busyId() === claim.id" (click)="declining.set(claim)" data-testid="reject"><app-icon name="x" [size]="16" /> Decline</button>
              <button type="button" class="approve" [disabled]="decisions.busyId() === claim.id" (click)="approve(claim)" data-testid="approve"><app-icon name="check" [size]="16" /> Approve</button>
            </div>
            @if (decisions.failedId() === claim.id) {
              <p class="row-error" role="alert">That didn't save. If it would go over their allowance, raise it on their page first.</p>
            }
          </div>
        } @empty {
          <p class="attendance-off">No flight claims waiting. They land here when someone claims from their profile.</p>
        }
      }
    </section>

    <app-dialog heading="Decline flight claim" [isOpen]="declining() !== undefined" (isOpenChange)="$event || declining.set(undefined)">
      @if (declining(); as target) {
        <app-decline-form eyebrow="FLIGHT ALLOWANCE" placeholder="The receipt is for a different date. Could you send the right one?" [name]="target.employeeName ?? ''" (declined)="decline(target, $event)" (cancelled)="declining.set(undefined)" />
      }
    </app-dialog>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FlightClaimsInbox {
  private readonly api = inject(HrApi);
  protected readonly claims = this.api.flightClaims({ status: 'pending' });
  protected readonly decisions = new DecisionState();
  protected readonly declining = signal<FlightClaim | undefined>(undefined);
  protected readonly waiting = computed(() => [...valueOr(this.claims, [])].sort((first, second) => first.raisedOn.localeCompare(second.raisedOn)));
  protected readonly submittedAgo = submittedAgo;
  protected readonly formatDayShort = formatDayShort;
  protected readonly formatMoney = formatMoney;

  protected approve({ id }: FlightClaim) {
    return this.decisions.run(id, () => this.api.decideFlightClaim(id, 'approved'), () => this.claims.reload());
  }

  protected async decline({ id }: FlightClaim, note: string) {
    this.declining.set(undefined);
    await this.decisions.run(id, () => this.api.decideFlightClaim(id, 'rejected', note), () => this.claims.reload());
  }
}
