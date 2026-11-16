import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ChangeRequest } from '../../models/company';
import { Avatar } from '../../shared/ui/avatar';
import { Dialog } from '../../shared/ui/dialog';
import { Icon } from '../../shared/ui/icon';
import { ListSkeleton } from '../../shared/ui/list-skeleton';
import { StatusPill } from '../../shared/ui/status-pill';
import { formatShortDate } from '../../shared/utils/date-time';
import { valueOr } from '../../shared/utils/resource';
import { DecisionState } from '../team/decision-state';
import { DeclineForm } from '../team/decline-form';
import { submittedAgo } from '../team/request-row';
import { DocumentsToCheck } from './documents-to-check';
import { HrApi } from './hr-api';

type Status = ChangeRequest['status'];

const TABS: { value: Status; label: string; empty: string }[] = [
  { value: 'open', label: 'Open', empty: 'Nothing to change. Requests from profiles land here.' },
  { value: 'done', label: 'Done', empty: 'Nothing marked done yet.' },
  { value: 'declined', label: 'Declined', empty: 'No declined requests.' },
];

@Component({
  selector: 'app-hr-inbox-page',
  imports: [Avatar, DeclineForm, Dialog, DocumentsToCheck, Icon, ListSkeleton, RouterLink, StatusPill],
  template: `
    <div class="page-view">
      <div class="page-title">
        <div>
          <span class="eyebrow">PEOPLE &amp; CULTURE</span>
          <h1>Inbox</h1>
          <p>Detail changes people send HR from their profile, and documents they upload for you to check.</p>
        </div>
      </div>

      <section class="card all-requests">
        <div class="request-tabs" role="tablist" aria-label="Request status">
          @for (option of tabs; track option.value) {
            <button type="button" role="tab" [class.active]="tab() === option.value" [attr.aria-selected]="tab() === option.value" (click)="tab.set(option.value)" [attr.data-testid]="'tab-' + option.value">
              {{ option.label }}
              @if (option.value === 'open' && openCount()) {
                <b>{{ openCount() }}</b>
              }
            </button>
          }
        </div>

        @if (requests.error()) {
          <p class="attendance-off">Requests didn't load. Refresh the page to try again.</p>
        } @else if (requests.isLoading() && list().length === 0) {
          <app-list-skeleton [count]="3" />
        } @else {
          @for (request of shown(); track request.id) {
            <div class="large-request inbox-request" data-testid="change-row">
              <app-avatar [name]="request.employeeName ?? ''" />
              <div>
                <a [routerLink]="['/hr/people', request.employeeId]" class="person-cell"><strong>{{ request.employeeName }}</strong></a>
                <span>{{ request.field }} · {{ submittedAgo(request.raisedOn) }}</span>
              </div>
              <div><small>{{ request.decisionNote ? 'YOUR NOTE' : 'WHAT TO CHANGE' }}</small><strong>{{ request.decisionNote ?? request.details }}</strong></div>
              @if (request.status === 'open') {
                <div class="request-actions labeled">
                  <button type="button" class="decline" [disabled]="decisions.busyId() === request.id" (click)="declining.set(request)" data-testid="reject"><app-icon name="x" [size]="16" /> Decline</button>
                  <button type="button" class="approve" [disabled]="decisions.busyId() === request.id" (click)="markDone(request)" data-testid="mark-done"><app-icon name="check" [size]="16" /> Mark done</button>
                </div>
              } @else {
                <app-status-pill [tone]="request.status === 'done' ? 'ok' : 'danger'">{{ request.status === 'done' ? 'Done' : 'Declined' }}{{ request.decidedOn ? ', ' + formatShortDate(request.decidedOn) : '' }}</app-status-pill>
              }
              @if (decisions.failedId() === request.id) {
                <p class="row-error" role="alert">That didn't save. Try again in a moment.</p>
              }
            </div>
          } @empty {
            <p class="attendance-off">{{ emptyText() }}</p>
          }
        }
      </section>

      <app-documents-to-check />
    </div>

    <app-dialog heading="Decline change" [isOpen]="declining() !== undefined" (isOpenChange)="$event || declining.set(undefined)">
      @if (declining(); as target) {
        <app-decline-form eyebrow="PEOPLE & CULTURE" placeholder="We need a copy of the new passport first. Could you send it over?" [name]="target.employeeName ?? ''" (declined)="decline(target, $event)" (cancelled)="declining.set(undefined)" />
      }
    </app-dialog>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HrInboxPage {
  private readonly api = inject(HrApi);
  protected readonly requests = this.api.changeRequests();
  protected readonly decisions = new DecisionState();
  protected readonly tabs = TABS;
  protected readonly tab = signal<Status>('open');
  protected readonly declining = signal<ChangeRequest | undefined>(undefined);

  protected readonly list = computed(() => valueOr(this.requests, []));
  protected readonly openCount = computed(() => this.list().filter(({ status }) => status === 'open').length);
  protected readonly shown = computed(() =>
    this.list()
      .filter(({ status }) => status === this.tab())
      .sort((first, second) => (this.tab() === 'open' ? first.raisedOn.localeCompare(second.raisedOn) : second.raisedOn.localeCompare(first.raisedOn))),
  );
  protected readonly emptyText = computed(() => TABS.find(({ value }) => value === this.tab())?.empty ?? '');
  protected readonly submittedAgo = submittedAgo;
  protected readonly formatShortDate = formatShortDate;

  protected markDone({ id }: ChangeRequest) {
    return this.decisions.run(id, () => this.api.decideChange(id, 'done'), () => this.requests.reload());
  }

  protected async decline({ id }: ChangeRequest, note: string) {
    this.declining.set(undefined);
    await this.decisions.run(id, () => this.api.decideChange(id, 'declined', note), () => this.requests.reload());
  }
}
