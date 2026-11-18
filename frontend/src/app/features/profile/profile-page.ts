import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Session } from '../../core/session';
import { Dialog } from '../../shared/ui/dialog';
import { Icon } from '../../shared/ui/icon';
import { SuccessState } from '../../shared/ui/success-state';
import { FlightCard } from '../flights/flight-card';
import { ChangeRequestForm } from './change-request-form';
import { EmployeeCard } from './employee-card';
import { IdCard } from './id-card';
import { RecordCard } from './record-card';
import { VisaDetails } from './visa-details';

@Component({
  selector: 'app-profile-page',
  imports: [ChangeRequestForm, Dialog, EmployeeCard, FlightCard, Icon, IdCard, RecordCard, SuccessState, VisaDetails],
  template: `
    @if (session.user(); as user) {
      <div class="page-view">
        <div class="page-title no-print">
          <div>
            <span class="eyebrow">YOUR PROFILE</span>
            <h1>Profile</h1>
            <p>Your staff ID and the papers that let you work here.</p>
          </div>
          <button type="button" class="download-button" (click)="print()" data-testid="print-card"><app-icon name="printer" [size]="17" /> Print my ID card</button>
        </div>

        <div class="employee-grid">
          <div class="main-column">
            <section class="card card-pad print-plain" aria-labelledby="card-heading">
              <div class="card-heading no-print">
                <div>
                  <span class="eyebrow">STAFF ID</span>
                  <h2 id="card-heading">Printable ID card</h2>
                </div>
              </div>
              <div class="card-body">
                <app-id-card [employee]="user" />
              </div>
            </section>
            <div class="no-print">
              <app-visa-details [visa]="user.visa" [nationality]="user.nationality" />
            </div>
            <div class="no-print">
              <app-record-card />
            </div>
            <div class="no-print">
              <app-flight-card />
            </div>
          </div>
          <div class="side-column no-print">
            <app-employee-card [employee]="user" />
            <section class="card card-pad">
              <div class="card-heading">
                <div>
                  <span class="eyebrow">SOMETHING WRONG?</span>
                  <h2>Update your details</h2>
                </div>
              </div>
              <p class="card-text">If your phone number, emergency contact or anything else on your card is out of date, HR can fix it.</p>
              <button type="button" class="secondary-button" (click)="isRequesting.set(true)" data-testid="request-change">Ask HR to change it</button>
            </section>
          </div>
        </div>
      </div>

      <app-dialog heading="Ask HR to change your details" [(isOpen)]="isRequesting">
        @if (wasSent()) {
          <app-success-state heading="Sent to HR" body="They'll update your record and let you know." (done)="closeRequest()" />
        } @else {
          <app-change-request-form (sent)="wasSent.set(true)" (cancelled)="closeRequest()" />
        }
      </app-dialog>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePage {
  protected readonly session = inject(Session);
  protected readonly isRequesting = signal(false);
  protected readonly wasSent = signal(false);

  protected print() {
    window.print();
  }

  protected closeRequest() {
    this.isRequesting.set(false);
    this.wasSent.set(false);
  }
}
