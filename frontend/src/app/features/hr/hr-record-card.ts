import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { ConfirmButton } from '../../shared/ui/confirm-button';
import { Dialog } from '../../shared/ui/dialog';
import { Icon } from '../../shared/ui/icon';
import { ListSkeleton } from '../../shared/ui/list-skeleton';
import { StatusPill } from '../../shared/ui/status-pill';
import { formatCompactDate } from '../../shared/utils/date-time';
import { valueOr } from '../../shared/utils/resource';
import { bankStatus, describeExperience } from '../profile/record-format';
import { DecisionState } from '../team/decision-state';
import { DeclineForm } from '../team/decline-form';
import { EducationForm } from './forms/education-form';
import { ExperienceForm } from './forms/experience-form';
import { InsuranceForm } from './forms/insurance-form';
import { HrApi } from './hr-api';

type Editing = 'insurance' | 'education' | 'experience' | undefined;

// The rest of someone's record on their HR page: insurance, bank details to check, education and experience.
// HR never changes or checks their own.
@Component({
  selector: 'app-hr-record-card',
  imports: [ConfirmButton, DeclineForm, Dialog, EducationForm, ExperienceForm, Icon, InsuranceForm, ListSkeleton, StatusPill],
  template: `
    <section class="card request-history" data-testid="hr-record">
      <div class="card-heading"><div><span class="eyebrow">Employee file</span><h2>Record</h2></div></div>
      @if (record.error()) {
        <p class="attendance-off">Their record didn't load. Refresh the page to try again.</p>
      } @else if (record.isLoading() && !details()) {
        <app-list-skeleton [count]="3" />
      } @else if (details(); as details) {
        <div class="history-row" data-testid="record-insurance">
          <div class="leave-type-icon"><app-icon name="shieldCheck" [size]="18" /></div>
          <div>
            <strong>Medical insurance</strong>
            <span>{{ details.insurance ? details.insurance.provider + ' · ' + details.insurance.policyNumber + ' · expires ' + formatCompactDate(details.insurance.expiresOn) : 'None on record' }}</span>
          </div>
          <span></span>
          <span class="row-actions">
            @if (!isOwn()) {
              <button type="button" class="text-link" (click)="editing.set('insurance')" data-testid="edit-insurance">{{ details.insurance ? 'Edit' : 'Add' }}</button>
              @if (details.insurance) {
                <app-confirm-button label="Remove" question="Remove their insurance?" yes="Yes, remove it" testId="remove-insurance" (confirmed)="removeInsurance()" />
              }
            }
          </span>
        </div>

        <div class="history-row" data-testid="record-bank">
          <div class="leave-type-icon"><app-icon name="landmark" [size]="18" /></div>
          <div>
            <strong>Bank details</strong>
            @if (details.bankAccount; as bank) {
              <span>{{ bank.bankName }} · {{ bank.accountName }} · {{ bank.accountNumber ?? '•••• ' + bank.accountLast4 }} · {{ bank.currency }}</span>
              @if (bank.decisionNote) {
                <span>Sent back: {{ bank.decisionNote }}</span>
              }
            } @else {
              <span>They haven't entered any yet</span>
            }
          </div>
          @if (details.bankAccount; as bank) {
            <app-status-pill [tone]="bankStatus(bank).tone">{{ bankStatus(bank).label }}</app-status-pill>
            <span class="row-actions">
              @if (bank.status === 'pending' && !isOwn()) {
                <button type="button" class="text-link" [disabled]="decisions.busyId() === 'bank'" (click)="isSendingBack.set(true)" data-testid="bank-send-back">Send back</button>
                <button type="button" class="text-link" [disabled]="decisions.busyId() === 'bank'" (click)="verifyBank()" data-testid="bank-verify">Verify</button>
              }
            </span>
          } @else {
            <span></span><span></span>
          }
          @if (decisions.failedId() === 'bank') {
            <p class="row-error" role="alert">That didn't save. Try again in a moment.</p>
          }
        </div>

        @for (entry of details.education; track entry.id) {
          <div class="history-row" data-testid="record-education">
            <div class="leave-type-icon"><app-icon name="file" [size]="18" /></div>
            <div>
              <strong>{{ entry.qualification }}</strong>
              <span>{{ entry.institution }}, {{ entry.completedYear }}</span>
            </div>
            <span></span>
            <span class="row-actions">
              @if (!isOwn()) {
                <app-confirm-button label="Remove" question="Remove this qualification?" yes="Yes, remove it" testId="remove-education" (confirmed)="removeEducation(entry.id)" />
              }
            </span>
          </div>
        }
        @for (entry of details.experience; track entry.id) {
          <div class="history-row" data-testid="record-experience">
            <div class="leave-type-icon"><app-icon name="briefcase" [size]="18" /></div>
            <div>
              <strong>{{ entry.role }}, {{ entry.employer }}</strong>
              <span>{{ describeExperience(entry) }}</span>
            </div>
            <span></span>
            <span class="row-actions">
              @if (!isOwn()) {
                <app-confirm-button label="Remove" question="Remove this job?" yes="Yes, remove it" testId="remove-experience" (confirmed)="removeExperience(entry.id)" />
              }
            </span>
          </div>
        }
        @if (!isOwn()) {
          <p class="row-actions record-adds">
            <button type="button" class="text-link" (click)="editing.set('education')" data-testid="add-education"><app-icon name="plus" [size]="14" /> Add qualification</button>
            <button type="button" class="text-link" (click)="editing.set('experience')" data-testid="add-experience"><app-icon name="plus" [size]="14" /> Add past job</button>
          </p>
        }
        @if (removeFailed()) {
          <p class="row-error" role="alert">That didn't remove. Try again in a moment.</p>
        }
      }
    </section>

    <app-dialog heading="Record" [isOpen]="editing() !== undefined" (isOpenChange)="$event || editing.set(undefined)">
      @switch (editing()) {
        @case ('insurance') {
          <app-insurance-form [employeeId]="employeeId()" [name]="name()" [insurance]="details()?.insurance" (saved)="saved()" (cancelled)="editing.set(undefined)" />
        }
        @case ('education') {
          <app-education-form [employeeId]="employeeId()" [name]="name()" (saved)="saved()" (cancelled)="editing.set(undefined)" />
        }
        @case ('experience') {
          <app-experience-form [employeeId]="employeeId()" [name]="name()" (saved)="saved()" (cancelled)="editing.set(undefined)" />
        }
      }
    </app-dialog>

    <app-dialog heading="Send back" [isOpen]="isSendingBack()" (isOpenChange)="isSendingBack.set($event)">
      @if (isSendingBack()) {
        <app-decline-form eyebrow="Bank details" heading="Send back their bank details?" confirmLabel="Send back" placeholder="The account name doesn't match the bank letter." [name]="name()" (declined)="sendBackBank($event)" (cancelled)="isSendingBack.set(false)" />
      }
    </app-dialog>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HrRecordCard {
  private readonly api = inject(HrApi);
  readonly employeeId = input.required<string>();
  readonly name = input.required<string>();
  readonly isOwn = input(false);

  protected readonly record = this.api.employeeRecord(this.employeeId);
  protected readonly details = computed(() => valueOr(this.record, undefined));
  protected readonly decisions = new DecisionState();
  protected readonly editing = signal<Editing>(undefined);
  protected readonly isSendingBack = signal(false);
  protected readonly removeFailed = signal(false);
  protected readonly bankStatus = bankStatus;
  protected readonly describeExperience = describeExperience;
  protected readonly formatCompactDate = formatCompactDate;

  protected saved() {
    this.editing.set(undefined);
    this.record.reload();
  }

  protected verifyBank() {
    return this.decisions.run('bank', () => this.api.decideBank(this.employeeId(), 'verified'), () => this.record.reload());
  }

  protected async sendBackBank(note: string) {
    this.isSendingBack.set(false);
    await this.decisions.run('bank', () => this.api.decideBank(this.employeeId(), 'rejected', note), () => this.record.reload());
  }

  protected removeInsurance() {
    return this.remove(() => this.api.removeInsurance(this.employeeId()));
  }

  protected removeEducation(id: string) {
    return this.remove(() => this.api.removeEducation(this.employeeId(), id));
  }

  protected removeExperience(id: string) {
    return this.remove(() => this.api.removeExperience(this.employeeId(), id));
  }

  private async remove(action: () => Promise<unknown>) {
    this.removeFailed.set(false);
    try {
      await action();
      this.record.reload();
    } catch (error) {
      console.error('Removing part of a record failed', error);
      this.removeFailed.set(true);
    }
  }
}
