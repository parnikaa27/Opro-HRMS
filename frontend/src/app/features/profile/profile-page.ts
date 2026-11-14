import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Session } from '../../core/session';
import { Dialog } from '../../shared/ui/dialog';
import { ChangeRequestForm } from './change-request-form';
import { IdCard } from './id-card';
import { VisaDetails } from './visa-details';

@Component({
  selector: 'app-profile-page',
  imports: [Dialog, ChangeRequestForm, IdCard, VisaDetails],
  template: `
    @if (session.user(); as user) {
      <header class="mb-8 flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div>
          <h1 class="font-display text-3xl tracking-tight sm:text-4xl">Your profile</h1>
          <p class="mt-2 text-soft">Your staff ID and the papers that let you work here.</p>
        </div>
        <button type="button" class="btn-quiet" (click)="print()" data-testid="print-card">Print my ID card</button>
      </header>

      <section aria-labelledby="card-heading">
        <h2 id="card-heading" class="eyebrow mb-3 print:hidden">Staff ID</h2>
        <app-id-card [employee]="user" />
      </section>

      <section class="mt-10 max-w-2xl print:hidden" aria-labelledby="visa-heading">
        <h2 id="visa-heading" class="eyebrow mb-3">Visa and work permit</h2>
        <app-visa-details [visa]="user.visa" [nationality]="user.nationality" />
      </section>

      <section class="mt-10 max-w-2xl print:hidden" aria-labelledby="change-heading">
        <h2 id="change-heading" class="eyebrow mb-3">Something wrong?</h2>
        @if (wasSent()) {
          <p class="rounded-2xl bg-ok-soft px-4 py-3 text-sm text-ok" role="status" data-testid="change-sent">Sent to HR. They'll update your record and let you know.</p>
        } @else {
          <p class="text-sm text-soft">
            If your phone number, emergency contact or anything else on your card is out of date,
            <button type="button" class="font-medium text-sea hover:underline" (click)="isRequesting.set(true)" data-testid="request-change">ask HR to change it</button>.
          </p>
        }
      </section>

      <app-dialog heading="Ask HR to change your details" [(isOpen)]="isRequesting">
        <app-change-request-form (sent)="onSent()" />
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

  protected onSent() {
    this.isRequesting.set(false);
    this.wasSent.set(true);
  }
}
