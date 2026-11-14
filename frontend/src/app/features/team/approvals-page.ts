import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CorrectionRequest } from '../../models/attendance';
import { LeaveRequest } from '../../models/leave';
import { Avatar } from '../../shared/ui/avatar';
import { Dialog } from '../../shared/ui/dialog';
import { Icon } from '../../shared/ui/icon';
import { ListSkeleton } from '../../shared/ui/list-skeleton';
import { StatusPill } from '../../shared/ui/status-pill';
import { formatDayShort } from '../../shared/utils/date-time';
import { valueOr } from '../../shared/utils/resource';
import { LeaveApi } from '../leave/leave-api';
import { describeDates, describeLength } from '../leave/leave-format';
import { DecisionState } from './decision-state';
import { DeclineForm } from './decline-form';
import { submittedAgo } from './request-row';
import { TeamApi } from './team-api';

type Tab = 'pending' | 'approved' | 'rejected' | 'fixes';

interface Declining {
  id: string;
  name: string;
  kind: 'leave' | 'fix';
}

const isOpen = ({ status }: LeaveRequest) => status === 'approved' || status === 'pending';
const overlaps = (first: LeaveRequest, second: LeaveRequest) => first.from <= second.to && first.to >= second.from;

@Component({
  selector: 'app-approvals-page',
  imports: [Avatar, DeclineForm, Dialog, Icon, ListSkeleton, StatusPill],
  template: `
    <div class="page-view">
      <div class="page-title">
        <div>
          <span class="eyebrow">TEAM MANAGEMENT</span>
          <h1>Leave requests</h1>
          <p>Review and manage leave requests and punch fixes from your team.</p>
        </div>
      </div>

      <section class="card all-requests">
        <div class="request-tabs" role="tablist" aria-label="Request status">
          @for (option of tabs(); track option.value) {
            <button type="button" role="tab" [class.active]="tab() === option.value" [attr.aria-selected]="tab() === option.value" (click)="tab.set(option.value)" [attr.data-testid]="'tab-' + option.value">
              {{ option.label }}
              @if (option.count) {
                <b>{{ option.count }}</b>
              }
            </button>
          }
        </div>

        @if (leave.error() || fixes.error()) {
          <p class="attendance-off">Requests didn't load. Refresh the page to try again.</p>
        } @else if (leave.isLoading() && leaveList().length === 0) {
          <app-list-skeleton [count]="3" />
        } @else if (tab() === 'fixes') {
          @for (fix of pendingFixes(); track fix.id) {
            <div class="large-request" data-testid="pending-fix">
              <app-avatar [name]="fix.employeeName ?? ''" />
              <div>
                <strong>{{ fix.employeeName }}</strong>
                <span>Missed punch {{ fix.kind === 'missed-in' ? 'in' : 'out' }} · {{ submittedAgo(fix.raisedOn) }}</span>
              </div>
              <div><small>DATE</small><strong>{{ formatDayShort(fix.date) }}</strong></div>
              <div><small>TIME</small><strong>{{ fix.requestedTime }}</strong></div>
              <div><small>REASON</small><strong>{{ fix.reason }}</strong></div>
              <div class="request-actions labeled">
                <button type="button" class="decline" [disabled]="decisions.busyId() === fix.id" (click)="declining.set({ id: fix.id, name: fix.employeeName ?? '', kind: 'fix' })" data-testid="reject"><app-icon name="x" [size]="16" /> Decline</button>
                <button type="button" class="approve" [disabled]="decisions.busyId() === fix.id" (click)="approveFix(fix)" data-testid="approve"><app-icon name="check" [size]="16" /> Approve</button>
              </div>
              @if (decisions.failedId() === fix.id) {
                <p class="row-error" role="alert">That didn't save. Try again in a moment.</p>
              }
            </div>
          } @empty {
            <p class="attendance-off">{{ emptyText.fixes }}</p>
          }
        } @else {
          @for (request of shown(); track request.id) {
            <div class="large-request" data-testid="leave-row">
              <app-avatar [name]="request.employeeName ?? ''" />
              <div>
                <strong>{{ request.employeeName }}</strong>
                <span>{{ typeName(request.type) }} · {{ submittedAgo(request.appliedOn) }}</span>
                @if (request.status === 'pending' && othersOff(request); as others) {
                  <span class="overlap" data-testid="overlap">Also off then: {{ others }}</span>
                }
              </div>
              <div><small>DATES</small><strong>{{ describeDates(request) }}</strong></div>
              <div><small>DURATION</small><strong>{{ describeLength(request) }}</strong></div>
              <div><small>{{ request.decisionNote ? 'YOUR NOTE' : 'REASON' }}</small><strong>{{ request.decisionNote ?? request.reason }}</strong></div>
              @if (request.status === 'pending') {
                <div class="request-actions labeled">
                  <button type="button" class="decline" [disabled]="decisions.busyId() === request.id" (click)="declining.set({ id: request.id, name: request.employeeName ?? '', kind: 'leave' })" data-testid="reject"><app-icon name="x" [size]="16" /> Decline</button>
                  <button type="button" class="approve" [disabled]="decisions.busyId() === request.id" (click)="approveLeave(request)" data-testid="approve"><app-icon name="check" [size]="16" /> Approve</button>
                </div>
              } @else {
                <app-status-pill [tone]="request.status === 'approved' ? 'ok' : 'danger'">{{ request.status === 'approved' ? 'Approved' : 'Declined' }}</app-status-pill>
              }
              @if (decisions.failedId() === request.id) {
                <p class="row-error" role="alert">That didn't save. Try again in a moment.</p>
              }
            </div>
          } @empty {
            <p class="attendance-off">{{ emptyText[tab()] }}</p>
          }
        }
      </section>
    </div>

    <app-dialog heading="Decline request" [isOpen]="declining() !== undefined" (isOpenChange)="$event || declining.set(undefined)">
      @if (declining(); as target) {
        <app-decline-form [name]="target.name" (declined)="decline(target, $event)" (cancelled)="declining.set(undefined)" />
      }
    </app-dialog>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApprovalsPage {
  private readonly api = inject(TeamApi);

  protected readonly leave = this.api.leaveRequests();
  protected readonly fixes = this.api.corrections();
  private readonly types = inject(LeaveApi).types();
  protected readonly decisions = new DecisionState();

  protected readonly tab = signal<Tab>('pending');
  protected readonly declining = signal<Declining | undefined>(undefined);

  protected readonly leaveList = computed(() => valueOr(this.leave, []));
  protected readonly pendingFixes = computed(() =>
    valueOr(this.fixes, [])
      .filter(({ status }) => status === 'pending')
      .sort((first, second) => first.raisedOn.localeCompare(second.raisedOn)),
  );
  private readonly byStatus = (status: LeaveRequest['status']) => this.leaveList().filter((request) => request.status === status);

  protected readonly tabs = computed(() => [
    { value: 'pending' as const, label: 'Pending', count: this.byStatus('pending').length },
    { value: 'approved' as const, label: 'Approved', count: 0 },
    { value: 'rejected' as const, label: 'Declined', count: 0 },
    { value: 'fixes' as const, label: 'Punch fixes', count: this.pendingFixes().length },
  ]);

  protected readonly shown = computed(() => {
    const tab = this.tab();
    const list = tab === 'fixes' ? [] : this.byStatus(tab);
    // Oldest waiting first; decided ones newest first.
    return tab === 'pending'
      ? list.sort((first, second) => first.appliedOn.localeCompare(second.appliedOn))
      : list.sort((first, second) => (second.decidedOn ?? '').localeCompare(first.decidedOn ?? ''));
  });

  protected readonly emptyText: Record<Tab, string> = {
    pending: 'Nothing waiting for you. Enjoy the quiet.',
    fixes: 'No punch fixes waiting for you.',
    approved: 'No approved requests yet.',
    rejected: 'You haven’t declined anything.',
  };

  protected readonly typeName = (code: string) => valueOr(this.types, []).find((type) => type.code === code)?.name ?? code;
  protected readonly othersOff = (request: LeaveRequest) =>
    this.leaveList()
      .filter((other) => other.employeeId !== request.employeeId && isOpen(other) && overlaps(other, request))
      .map((other) => `${other.employeeName}${other.status === 'pending' ? ' (pending)' : ''}`)
      .join(', ');

  protected readonly describeDates = describeDates;
  protected readonly describeLength = describeLength;
  protected readonly formatDayShort = formatDayShort;
  protected readonly submittedAgo = submittedAgo;

  protected approveLeave({ id }: LeaveRequest) {
    return this.decisions.run(id, () => this.api.decideLeave(id, { decision: 'approved' }), () => this.leave.reload());
  }

  protected approveFix({ id }: CorrectionRequest) {
    return this.decisions.run(id, () => this.api.decideCorrection(id, { decision: 'approved' }), () => this.fixes.reload());
  }

  protected async decline(target: Declining, note: string) {
    this.declining.set(undefined);
    const decision = { decision: 'rejected' as const, note };
    return target.kind === 'leave'
      ? this.decisions.run(target.id, () => this.api.decideLeave(target.id, decision), () => this.leave.reload())
      : this.decisions.run(target.id, () => this.api.decideCorrection(target.id, decision), () => this.fixes.reload());
  }
}
