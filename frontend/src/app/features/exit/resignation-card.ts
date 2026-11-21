import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ConfirmButton } from '../../shared/ui/confirm-button';
import { Dialog } from '../../shared/ui/dialog';
import { StatusPill } from '../../shared/ui/status-pill';
import { SuccessState } from '../../shared/ui/success-state';
import { formatFullDate } from '../../shared/utils/date-time';
import { valueOr } from '../../shared/utils/resource';
import { ExitApi } from './exit-api';
import { itemStatus } from './exit-status';
import { ResignationForm } from './resignation-form';

// On someone's profile: resign, follow it through the HOD and HR, then see the exit date and what to bring back.
@Component({
  selector: 'app-resignation-card',
  imports: [ConfirmButton, Dialog, ResignationForm, StatusPill, SuccessState],
  template: `
    <section class="card card-pad" data-testid="resignation-card">
      <div class="card-heading"><div><span class="eyebrow">LEAVING OPRO</span><h2>Resignation</h2></div></div>
      @if (resignations.error()) {
        <p class="attendance-off">This didn't load. Refresh the page to try again.</p>
      } @else if (open(); as current) {
        @if (current.status === 'approved') {
          <p data-testid="exit-date"><strong>Your exit date is {{ formatFullDate(current.exitOn ?? current.releaseOn) }}.</strong> Before you go, hand these back to HR.</p>
          <ul class="exit-checklist">
            @for (item of current.checklist; track item.itemId) {
              <li data-testid="exit-item">
                <span>{{ item.name }}</span>
                <app-status-pill [tone]="itemStatus(item, 'you').tone">{{ itemStatus(item, 'you').label }}</app-status-pill>
              </li>
            }
          </ul>
        } @else {
          <p data-testid="resignation-status">
            You resigned on {{ formatFullDate(current.submittedOn) }}, asking for {{ formatFullDate(current.releaseOn) }} as your last day.
            {{ current.hodApprovedOn ? 'It’s with HR now.' : 'It’s with your HOD.' }}
          </p>
          <app-confirm-button label="Withdraw it" question="Withdraw your resignation?" yes="Yes, withdraw it" testId="withdraw-resignation" (confirmed)="withdraw(current.id)" />
        }
      } @else {
        @if (latest()?.status === 'rejected') {
          <p class="card-note" data-testid="resignation-declined">{{ latest()?.decidedByName }} didn't accept your last one: “{{ latest()?.decisionNote }}”</p>
        }
        <p class="card-text">Thinking of leaving? Talk to your HOD first. When you're ready, put it in here.</p>
        <button type="button" class="text-link danger" (click)="isResigning.set(true)" data-testid="resign">Resign</button>
      }
      @if (failed()) {
        <p class="row-error" role="alert">That didn't go through. Try again in a moment.</p>
      }
    </section>

    <app-dialog heading="Resign" [(isOpen)]="isResigning">
      @if (wasSent()) {
        <app-success-state heading="Resignation sent" body="Your HOD has been told. You'll hear when it's approved." (done)="close()" />
      } @else {
        <app-resignation-form (sent)="sent()" (cancelled)="close()" />
      }
    </app-dialog>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResignationCard {
  private readonly api = inject(ExitApi);
  protected readonly resignations = this.api.mine();
  private readonly list = computed(() => valueOr(this.resignations, []));
  protected readonly latest = computed(() => this.list().at(0));
  protected readonly open = computed(() => this.list().find(({ status }) => status === 'pending' || status === 'approved'));
  protected readonly isResigning = signal(false);
  protected readonly wasSent = signal(false);
  protected readonly failed = signal(false);
  protected readonly itemStatus = itemStatus;
  protected readonly formatFullDate = formatFullDate;

  protected sent() {
    this.wasSent.set(true);
    this.resignations.reload();
  }

  protected close() {
    this.isResigning.set(false);
    this.wasSent.set(false);
  }

  protected async withdraw(id: string) {
    this.failed.set(false);
    try {
      await this.api.withdraw(id);
      this.resignations.reload();
    } catch (error) {
      console.error('Withdrawing a resignation failed', error);
      this.failed.set(true);
    }
  }
}
