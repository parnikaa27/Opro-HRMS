import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApprovalsWaiting } from '../../models/company';
import { LeaveType } from '../../models/leave';
import { Avatar } from '../../shared/ui/avatar';
import { Dialog } from '../../shared/ui/dialog';
import { Icon } from '../../shared/ui/icon';
import { ListSkeleton } from '../../shared/ui/list-skeleton';
import { formatDayShort, formatDuration } from '../../shared/utils/date-time';
import { valueOr } from '../../shared/utils/resource';
import { plural } from '../../shared/utils/text';
import { needsCertificate } from '../leave/leave-api';
import { describeDates, describeExtras, describeLength } from '../leave/leave-format';
import { DecisionState } from '../team/decision-state';
import { DeclineForm } from '../team/decline-form';
import { ApprovalKind, HrApi, NOTHING_WAITING } from './hr-api';

const HALF_DAY = 0.5;

interface Row {
  kind: ApprovalKind;
  id: string;
  employeeId: string;
  employeeName: string;
  what: string;
  detail: string;
  hod: string;
  // Oldest first, across kinds.
  sortsBy: string;
}

// The HOD approved these and HR approves too. Part of the inbox.
@Component({
  selector: 'app-approvals-to-decide',
  imports: [Avatar, DeclineForm, Dialog, Icon, ListSkeleton, RouterLink],
  template: `
    <section class="card all-requests" data-testid="approvals-to-decide">
      <div class="card-heading">
        <div>
          <span class="eyebrow">After the HOD</span>
          <h2>Approvals</h2>
        </div>
      </div>
      @if (waiting.error()) {
        <p class="attendance-off">Approvals didn't load. Refresh the page to try again.</p>
      } @else if (waiting.isLoading() && rows().length === 0) {
        <app-list-skeleton [count]="2" />
      } @else {
        @for (row of rows(); track row.kind + row.id) {
          <div class="large-request inbox-request" data-testid="waiting-approval">
            <app-avatar [name]="row.employeeName" />
            <div>
              <a [routerLink]="['/hr/people', row.employeeId]" class="person-cell"><strong>{{ row.employeeName }}</strong></a>
              <span>{{ row.what }} · approved by {{ row.hod }}</span>
            </div>
            <div><small>Details</small><strong>{{ row.detail }}</strong></div>
            <div class="request-actions labeled">
              <button type="button" class="decline" [disabled]="decisions.busyId() === row.id" (click)="declining.set(row)" data-testid="reject"><app-icon name="x" [size]="16" /> Decline</button>
              <button type="button" class="approve" [disabled]="decisions.busyId() === row.id" (click)="approve(row)" data-testid="approve"><app-icon name="check" [size]="16" /> Approve</button>
            </div>
            @if (decisions.failedId() === row.id) {
              <p class="row-error" role="alert">That didn't save. Try again in a moment.</p>
            }
          </div>
        } @empty {
          <p class="attendance-off">Nothing waiting for HR. Requests you've asked to approve after the HOD land here.</p>
        }
      }
    </section>

    <app-dialog heading="Decline request" [isOpen]="declining() !== undefined" (isOpenChange)="$event || declining.set(undefined)">
      @if (declining(); as row) {
        <app-decline-form eyebrow="People & culture" placeholder="Two people in the team are already off that week." [name]="row.employeeName" (declined)="decline(row, $event)" (cancelled)="declining.set(undefined)" />
      }
    </app-dialog>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApprovalsToDecide {
  private readonly api = inject(HrApi);
  protected readonly waiting = this.api.approvals();
  private readonly types = this.api.leaveTypes();
  protected readonly decisions = new DecisionState();
  protected readonly declining = signal<Row | undefined>(undefined);

  protected readonly rows = computed(() => toRows(valueOr(this.waiting, NOTHING_WAITING), (code) => valueOr(this.types, []).find((type) => type.code === code)));

  protected approve({ kind, id }: Row) {
    return this.decisions.run(id, () => this.api.decideApproval(kind, id, 'approved'), () => this.waiting.reload());
  }

  protected async decline({ kind, id }: Row, note: string) {
    this.declining.set(undefined);
    await this.decisions.run(id, () => this.api.decideApproval(kind, id, 'rejected', note), () => this.waiting.reload());
  }
}

interface Waiting {
  id: string;
  employeeId: string;
  employeeName?: string;
  hodApprovedByName?: string;
}

const row = (kind: ApprovalKind, { id, employeeId, employeeName, hodApprovedByName }: Waiting, what: string, detail: string, sortsBy: string): Row => ({
  kind, id, employeeId, employeeName: employeeName ?? '', what, detail, hod: hodApprovedByName ?? 'their HOD', sortsBy,
});

// One list across the five kinds, oldest first, with what each one is in plain words.
const toRows = (waiting: ApprovalsWaiting, typeOf: (code: string) => LeaveType | undefined): Row[] =>
  [
    ...waiting.leave.map((request) => {
      const type = typeOf(request.type);
      const missing = !request.hasCertificate && needsCertificate(type, request.days) ? 'Medical certificate missing' : '';
      return row('leave', request, type?.name ?? request.type, [`${describeDates(request)}, ${describeLength(request)}`, describeExtras(request), missing].filter(Boolean).join(' · '), request.from);
    }),
    ...waiting.corrections.map((fix) => row('corrections', fix, 'Punch fix', `${formatDayShort(fix.date)}, punch ${fix.kind === 'missed-in' ? 'in' : 'out'} at ${fix.requestedTime}`, fix.date)),
    ...waiting.homeDays.map((day) => row('home-days', day, 'Worked from home', formatDayShort(day.date), day.date)),
    ...waiting.compOffs.map((claim) => row('comp-offs', claim, 'Comp off', `${formatDayShort(claim.date)}, earns ${claim.days === HALF_DAY ? 'half a day' : plural(claim.days, 'day')}`, claim.date)),
    ...waiting.overtime.map((claim) => row('overtime', claim, 'Overtime', `${formatDayShort(claim.date)}, ${formatDuration(claim.minutes)}`, claim.date)),
  ].sort((first, second) => first.sortsBy.localeCompare(second.sortsBy));
