import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormField, form, required } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { Resignation } from '../../models/exit';
import { Avatar } from '../../shared/ui/avatar';
import { Dialog } from '../../shared/ui/dialog';
import { FieldError } from '../../shared/ui/field-error';
import { Icon } from '../../shared/ui/icon';
import { ListSkeleton } from '../../shared/ui/list-skeleton';
import { ModalHeading } from '../../shared/ui/modal-heading';
import { formatFullDate, maldivesToday } from '../../shared/utils/date-time';
import { valueOr } from '../../shared/utils/resource';
import { DecisionState } from '../team/decision-state';
import { DeclineForm } from '../team/decline-form';
import { ExitApi } from './exit-api';

// Resignations the HOD approved, for HR's step. Approving sets the exit date: the day they asked for, or another.
@Component({
  selector: 'app-resignations-to-decide',
  imports: [Avatar, DeclineForm, Dialog, FieldError, FormField, Icon, ListSkeleton, ModalHeading, RouterLink],
  template: `
    <section class="card all-requests" data-testid="resignations-to-decide">
      <div class="card-heading"><div><span class="eyebrow">Leaving Opro</span><h2>Resignations</h2></div></div>
      @if (waiting.error()) {
        <p class="attendance-off">Resignations didn't load. Refresh the page to try again.</p>
      } @else if (waiting.isLoading() && list().length === 0) {
        <app-list-skeleton [count]="1" />
      } @else {
        @for (resignation of list(); track resignation.id) {
          <div class="large-request inbox-request" data-testid="waiting-resignation">
            <app-avatar [name]="resignation.employeeName ?? ''" />
            <div>
              <a [routerLink]="['/hr/people', resignation.employeeId]" class="person-cell"><strong>{{ resignation.employeeName }}</strong></a>
              <span>{{ resignation.hodApprovedByName ? 'Approved by ' + resignation.hodApprovedByName : 'No HOD to ask' }} · “{{ resignation.reason }}”</span>
            </div>
            <div><small>Last day asked for</small><strong>{{ formatFullDate(resignation.releaseOn) }}</strong></div>
            <div class="request-actions labeled">
              <button type="button" class="decline" [disabled]="decisions.busyId() === resignation.id" (click)="declining.set(resignation)" data-testid="reject"><app-icon name="x" [size]="16" /> Decline</button>
              <button type="button" class="approve" [disabled]="decisions.busyId() === resignation.id" (click)="open(resignation)" data-testid="approve"><app-icon name="check" [size]="16" /> Approve</button>
            </div>
            @if (decisions.failedId() === resignation.id) {
              <p class="row-error" role="alert">That didn't save. Try again in a moment.</p>
            }
          </div>
        } @empty {
          <p class="attendance-off">No resignations waiting for HR.</p>
        }
      }
    </section>

    <app-dialog heading="Approve resignation" [isOpen]="approving() !== undefined" (isOpenChange)="$event || approving.set(undefined)">
      @if (approving(); as resignation) {
        <app-modal-heading eyebrow="Leaving Opro" [heading]="'Accept ' + resignation.employeeName + '’s resignation?'" intro="They hear their exit date and what to hand back. The HOD hears the date too." />
        <form novalidate (submit)="approve($event, resignation)">
          <label>Exit date <input type="date" [min]="today" [formField]="exitForm.exitOn" data-testid="exit-date-input" aria-describedby="exit-date-error" /></label>
          <app-field-error id="exit-date-error" [errors]="exitForm.exitOn().errors()" [isTouched]="exitForm.exitOn().touched()" />
          <div class="modal-actions">
            <button type="button" class="secondary-button" (click)="approving.set(undefined)">Cancel</button>
            <button type="submit" class="primary-button" data-testid="confirm-approve">Approve</button>
          </div>
        </form>
      }
    </app-dialog>

    <app-dialog heading="Decline resignation" [isOpen]="declining() !== undefined" (isOpenChange)="$event || declining.set(undefined)">
      @if (declining(); as resignation) {
        <app-decline-form [name]="resignation.employeeName ?? ''" placeholder="Your contract runs to January. Let's talk about a later date." (declined)="decline(resignation, $event)" (cancelled)="declining.set(undefined)" />
      }
    </app-dialog>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResignationsToDecide {
  private readonly api = inject(ExitApi);
  protected readonly waiting = this.api.waitingForHr();
  protected readonly list = computed(() => valueOr(this.waiting, []));
  protected readonly decisions = new DecisionState();
  protected readonly approving = signal<Resignation | undefined>(undefined);
  protected readonly declining = signal<Resignation | undefined>(undefined);
  protected readonly today = maldivesToday();
  protected readonly formatFullDate = formatFullDate;
  protected readonly draft = signal({ exitOn: '' });
  protected readonly exitForm = form(this.draft, (path) => {
    required(path.exitOn, { message: 'Pick their exit date.' });
  });

  // Starts on the day they asked for.
  protected open(resignation: Resignation) {
    this.draft.set({ exitOn: resignation.releaseOn });
    this.approving.set(resignation);
  }

  protected approve(event: Event, { id }: Resignation) {
    event.preventDefault();
    if (this.exitForm().invalid()) {
      return undefined;
    }
    this.approving.set(undefined);
    return this.decisions.run(id, () => this.api.decideAsHr(id, { decision: 'approved', exitOn: this.draft().exitOn }), () => this.waiting.reload());
  }

  protected decline({ id }: Resignation, note: string) {
    this.declining.set(undefined);
    return this.decisions.run(id, () => this.api.decideAsHr(id, { decision: 'rejected', note }), () => this.waiting.reload());
  }
}
