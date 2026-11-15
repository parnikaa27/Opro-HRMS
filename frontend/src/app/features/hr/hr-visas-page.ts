import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Avatar } from '../../shared/ui/avatar';
import { Dialog } from '../../shared/ui/dialog';
import { ListSkeleton } from '../../shared/ui/list-skeleton';
import { StatusPill, Tone } from '../../shared/ui/status-pill';
import { SuccessState } from '../../shared/ui/success-state';
import { daysUntil, formatCompactDate, maldivesToday } from '../../shared/utils/date-time';
import { expiryStatus, ExpiryStatus } from '../../shared/utils/expiry';
import { valueOr } from '../../shared/utils/resource';
import { VisaForm } from './forms/visa-form';
import { HrApi, HrEmployee } from './hr-api';

const EXPIRY: Record<ExpiryStatus, { label: string; tone: Tone }> = {
  valid: { label: 'Valid', tone: 'ok' },
  expiring: { label: 'Expires soon', tone: 'late' },
  expired: { label: 'Expired', tone: 'danger' },
};
const NO_RECORD = Number.MIN_SAFE_INTEGER;

@Component({
  selector: 'app-hr-visas-page',
  imports: [Avatar, Dialog, ListSkeleton, RouterLink, StatusPill, SuccessState, VisaForm],
  template: `
    <div class="page-view">
      <div class="page-title">
        <div>
          <span class="eyebrow">COMPLIANCE</span>
          <h1>Visas</h1>
          <p>Everyone who needs a work visa, soonest expiry first. Maldivian nationals aren't listed.</p>
        </div>
      </div>
      @if (everyone.error()) {
        <p class="attendance-off">Visa records didn't load. Refresh the page to try again.</p>
      } @else if (everyone.isLoading() && rows().length === 0) {
        <app-list-skeleton [count]="4" />
      } @else {
        <section class="card full-table">
          <div class="table-wrap">
            <table class="stacks">
              <thead>
                <tr><th scope="col">PERSON</th><th scope="col">VISA</th><th scope="col">VISA EXPIRES</th><th scope="col">PASSPORT EXPIRES</th><th scope="col"><span class="sr-only">Actions</span></th></tr>
              </thead>
              <tbody>
                @for (person of rows(); track person.id) {
                  <tr data-testid="visa-row">
                    <td><a class="person-cell" [routerLink]="['/hr/people', person.id]"><app-avatar [name]="person.fullName" /><span><strong>{{ person.fullName }}</strong></span></a></td>
                    @if (person.visa; as visa) {
                      <td data-label="VISA">{{ visa.visaNumber }}</td>
                      <td data-label="VISA EXPIRES">{{ formatCompactDate(visa.visaExpiry) }} <app-status-pill [tone]="pill(visa.visaExpiry).tone">{{ pill(visa.visaExpiry).label }}</app-status-pill></td>
                      <td data-label="PASSPORT EXPIRES">{{ formatCompactDate(visa.passportExpiry) }} <app-status-pill [tone]="pill(visa.passportExpiry).tone">{{ pill(visa.passportExpiry).label }}</app-status-pill></td>
                    } @else {
                      <td colspan="3" data-label="VISA"><app-status-pill tone="danger">No record</app-status-pill></td>
                    }
                    <td><button type="button" class="text-link" (click)="editing.set(person)" data-testid="edit-visa">{{ person.visa ? 'Update' : 'Add' }}</button></td>
                  </tr>
                } @empty {
                  <tr><td colspan="5">Nobody at Opro needs a work visa right now.</td></tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      }
    </div>

    <app-dialog heading="Update visa" [isOpen]="editing() !== undefined" (isOpenChange)="$event || close()">
      @if (wasSaved()) {
        <app-success-state heading="Papers updated" body="Expiry warnings now follow the new dates." (done)="close()" />
      } @else if (editing(); as person) {
        <app-visa-form [employeeId]="person.id" [name]="person.fullName" [visa]="person.visa" (saved)="onSaved()" (cancelled)="close()" />
      }
    </app-dialog>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HrVisasPage {
  private readonly today = maldivesToday();
  protected readonly everyone = inject(HrApi).employees();
  protected readonly editing = signal<HrEmployee | undefined>(undefined);
  protected readonly wasSaved = signal(false);

  // People without a record come first: that's the most urgent gap.
  protected readonly rows = computed(() =>
    valueOr(this.everyone, [])
      .filter(({ nationality }) => nationality !== 'Maldivian')
      .map((person) => ({ person, soonest: person.visa ? Math.min(daysUntil(person.visa.visaExpiry, this.today), daysUntil(person.visa.passportExpiry, this.today)) : NO_RECORD }))
      .sort((first, second) => first.soonest - second.soonest)
      .map(({ person }) => person),
  );

  protected readonly pill = (expiry: string) => EXPIRY[expiryStatus(expiry, this.today)];
  protected readonly formatCompactDate = formatCompactDate;

  protected onSaved() {
    this.wasSaved.set(true);
    this.everyone.reload();
  }

  protected close() {
    this.editing.set(undefined);
    this.wasSaved.set(false);
  }
}
