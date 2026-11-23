import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FlightClaim } from '../../models/flight';
import { Dialog } from '../../shared/ui/dialog';
import { SuccessState } from '../../shared/ui/success-state';
import { valueOr } from '../../shared/utils/resource';
import { FlightClaimForm } from './flight-claim-form';
import { FlightSummary } from './flight-summary';
import { FlightsApi } from './flights-api';

// Someone's own flight allowance on their profile. Hidden for people who don't get one and never claimed.
@Component({
  selector: 'app-flight-card',
  imports: [Dialog, FlightClaimForm, FlightSummary, SuccessState],
  template: `
    @if (year.error()) {
      <p class="attendance-off">Your flight allowance didn't load. Refresh the page to try again.</p>
    } @else if (shown(); as flights) {
      <section class="card card-pad" data-testid="flight-card">
        <div class="card-heading">
          <div>
            <span class="eyebrow">Flight allowance</span>
            <h2>Flights home</h2>
          </div>
          @if (flights.allowanceUsd !== undefined) {
            <button type="button" class="secondary-button" (click)="isClaiming.set(true)" data-testid="open-claim">Claim a flight</button>
          }
        </div>
        <app-flight-summary [year]="flights" receiptPath="/api/flights/claims" [canCancel]="true" (cancelled)="cancel($event)" />
        @if (cancelFailed()) {
          <p class="row-error" role="alert">That didn't cancel. Try again in a moment.</p>
        }
      </section>
    }

    <app-dialog heading="Claim a flight" [isOpen]="isClaiming()" (isOpenChange)="$event || close()">
      @if (wasClaimed()) {
        <app-success-state heading="Flight claimed" body="It's taken off what's left of your allowance. HR can see it and the receipt on your record." (done)="close()" />
      } @else {
        <app-flight-claim-form (claimed)="wasClaimed.set(true)" (cancelled)="close()" />
      }
    </app-dialog>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FlightCard {
  private readonly api = inject(FlightsApi);
  protected readonly year = this.api.year();
  protected readonly isClaiming = signal(false);
  protected readonly wasClaimed = signal(false);
  protected readonly cancelFailed = signal(false);
  protected readonly shown = computed(() => {
    const flights = valueOr(this.year, undefined);
    return flights && (flights.allowanceUsd !== undefined || flights.claims.length > 0) ? flights : undefined;
  });

  protected async cancel({ id }: FlightClaim) {
    this.cancelFailed.set(false);
    try {
      await this.api.cancel(id);
      this.year.reload();
    } catch (error) {
      console.error('Cancelling a flight claim failed', error);
      this.cancelFailed.set(true);
    }
  }

  // A claim may have gone in even when the form stayed open on an error, so always look again.
  protected close() {
    this.isClaiming.set(false);
    this.wasClaimed.set(false);
    this.year.reload();
  }
}
