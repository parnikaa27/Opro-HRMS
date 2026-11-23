import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Dialog } from '../../shared/ui/dialog';
import { Icon } from '../../shared/ui/icon';
import { StatusPill } from '../../shared/ui/status-pill';
import { SuccessState } from '../../shared/ui/success-state';
import { formatCompactDate } from '../../shared/utils/date-time';
import { valueOr } from '../../shared/utils/resource';
import { BankForm } from './bank-form';
import { ProfileApi } from './profile-api';
import { bankStatus, describeExperience } from './record-format';

// Someone's own record on their profile: bank details they enter, and the insurance, education and experience HR keeps.
@Component({
  selector: 'app-record-card',
  imports: [BankForm, Dialog, Icon, StatusPill, SuccessState],
  template: `
    @if (record.error()) {
      <p class="attendance-off">Your record didn't load. Refresh the page to try again.</p>
    } @else if (details(); as details) {
      <section class="card request-history" data-testid="record-card">
        <div class="card-heading">
          <div>
            <span class="eyebrow">My record</span>
            <h2>Bank, insurance and background</h2>
          </div>
          <button type="button" class="secondary-button" (click)="isEditingBank.set(true)" data-testid="open-bank">{{ details.bankAccount ? 'Change bank details' : 'Add bank details' }}</button>
        </div>
        <div class="history-row" data-testid="my-bank">
          <div class="leave-type-icon"><app-icon name="landmark" [size]="18" /></div>
          <div>
            <strong>Bank details</strong>
            @if (details.bankAccount; as bank) {
              <span>{{ bank.bankName }} · {{ bank.accountName }} · •••• {{ bank.accountLast4 }} · {{ bank.currency }}</span>
              @if (bank.decisionNote) {
                <span>Sent back: {{ bank.decisionNote }}</span>
              }
            } @else {
              <span>Add the account your pay should go to</span>
            }
          </div>
          @if (details.bankAccount; as bank) {
            <app-status-pill [tone]="bankStatus(bank).tone">{{ bankStatus(bank).label }}</app-status-pill>
          } @else {
            <span></span>
          }
          <span></span>
        </div>
        <div class="history-row" data-testid="my-insurance">
          <div class="leave-type-icon"><app-icon name="shieldCheck" [size]="18" /></div>
          <div>
            <strong>Medical insurance</strong>
            <span>{{ details.insurance ? details.insurance.provider + ' · ' + details.insurance.policyNumber + ' · expires ' + formatCompactDate(details.insurance.expiresOn) : 'None through Opro' }}</span>
          </div>
          <span></span><span></span>
        </div>
        @for (entry of details.education; track entry.id) {
          <div class="history-row" data-testid="my-education">
            <div class="leave-type-icon"><app-icon name="file" [size]="18" /></div>
            <div><strong>{{ entry.qualification }}</strong><span>{{ entry.institution }}, {{ entry.completedYear }}</span></div>
            <span></span><span></span>
          </div>
        }
        @for (entry of details.experience; track entry.id) {
          <div class="history-row" data-testid="my-experience">
            <div class="leave-type-icon"><app-icon name="briefcase" [size]="18" /></div>
            <div><strong>{{ entry.role }}, {{ entry.employer }}</strong><span>{{ describeExperience(entry) }}</span></div>
            <span></span><span></span>
          </div>
        }
        <p class="table-note">HR keeps your insurance, education and experience. Something missing? Ask HR to change it.</p>
      </section>
    }

    <app-dialog heading="Bank details" [isOpen]="isEditingBank()" (isOpenChange)="$event || close()">
      @if (wasSent()) {
        <app-success-state heading="Sent to HR" body="They'll check it against your bank letter. You'll hear when it's verified." (done)="close()" />
      } @else if (isEditingBank()) {
        <app-bank-form (saved)="sent()" (cancelled)="close()" />
      }
    </app-dialog>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecordCard {
  protected readonly record = inject(ProfileApi).record();
  protected readonly details = computed(() => valueOr(this.record, undefined));
  protected readonly isEditingBank = signal(false);
  protected readonly wasSent = signal(false);
  protected readonly bankStatus = bankStatus;
  protected readonly describeExperience = describeExperience;
  protected readonly formatCompactDate = formatCompactDate;

  protected sent() {
    this.wasSent.set(true);
    this.record.reload();
  }

  protected close() {
    this.isEditingBank.set(false);
    this.wasSent.set(false);
  }
}
