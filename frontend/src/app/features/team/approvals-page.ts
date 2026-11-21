import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { CompOffClaim, CorrectionRequest, HomeDay, OvertimeClaim } from '../../models/attendance';
import { Resignation } from '../../models/exit';
import { LeaveRequest } from '../../models/leave';
import { Avatar } from '../../shared/ui/avatar';
import { Dialog } from '../../shared/ui/dialog';
import { Icon } from '../../shared/ui/icon';
import { ListSkeleton } from '../../shared/ui/list-skeleton';
import { StatusPill } from '../../shared/ui/status-pill';
import { isWaitingForHr } from '../../shared/utils/approval-step';
import { formatDayShort } from '../../shared/utils/date-time';
import { valueOr } from '../../shared/utils/resource';
import { fixCategoryLabel } from '../attendance/fix-categories';
import { LeaveApi, needsCertificate } from '../leave/leave-api';
import { describeDates, describeExtras, describeLength } from '../leave/leave-format';
import { CompOffList } from './comp-off-list';
import { DecisionState } from './decision-state';
import { DeclineForm } from './decline-form';
import { HomeDayList } from './home-day-list';
import { OvertimeList } from './overtime-list';
import { ResignationList } from './resignation-list';
import { submittedAgo } from './request-row';
import { TeamApi, ViewScope } from './team-api';

type Tab = 'pending' | 'approved' | 'rejected' | 'fixes' | 'home' | 'comp-off' | 'overtime' | 'resignations';

interface Declining {
  id: string;
  name: string;
  kind: 'leave' | 'fix' | 'home' | 'comp-off' | 'overtime' | 'resignation';
}

// Still the HOD's to decide: not yet passed on to HR.
const isHodStep = (item: { status: string; hodApprovedOn?: string }) => !isWaitingForHr(item);
const isOpen = ({ status }: LeaveRequest) => status === 'approved' || status === 'pending';
const overlaps = (first: LeaveRequest, second: LeaveRequest) => first.from <= second.to && first.to >= second.from;

@Component({
  selector: 'app-approvals-page',
  imports: [Avatar, CompOffList, DeclineForm, Dialog, HomeDayList, Icon, ListSkeleton, OvertimeList, ResignationList, StatusPill],
  template: `
    <div class="page-view">
      <div class="page-title">
        <div>
          <span class="eyebrow">{{ scope() === 'company' ? 'ACROSS OPRO' : 'TEAM MANAGEMENT' }}</span>
          <h1>Leave requests</h1>
          <p>{{ scope() === 'company' ? 'Every request at Opro. Step in when an HOD is away.' : 'Review leave, punch fixes, home days, comp off, overtime and resignations for your team.' }}</p>
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

        @if (leave.error() || fixes.error() || homeDays.error() || compOffs.error() || overtime.error() || resignations.error()) {
          <p class="attendance-off">Requests didn't load. Refresh the page to try again.</p>
        } @else if (leave.isLoading() && leaveList().length === 0) {
          <app-list-skeleton [count]="3" />
        } @else if (tab() === 'comp-off') {
          <app-comp-off-list
            [claims]="pendingCompOffs()"
            [busyId]="decisions.busyId()"
            [failedId]="decisions.failedId()"
            (approved)="approveCompOff($event)"
            (declined)="declining.set({ id: $event.id, name: $event.employeeName ?? '', kind: 'comp-off' })"
          />
          @if (pendingCompOffs().length === 0) {
            <p class="attendance-off">{{ emptyText['comp-off'] }}</p>
          }
        } @else if (tab() === 'resignations') {
          <app-resignation-list
            [resignations]="pendingResignations()"
            [busyId]="decisions.busyId()"
            [failedId]="decisions.failedId()"
            (approved)="approveResignation($event)"
            (declined)="declining.set({ id: $event.id, name: $event.employeeName ?? '', kind: 'resignation' })"
          />
          @if (pendingResignations().length === 0) {
            <p class="attendance-off">{{ emptyText.resignations }}</p>
          }
        } @else if (tab() === 'overtime') {
          <app-overtime-list
            [claims]="pendingOvertime()"
            [busyId]="decisions.busyId()"
            [failedId]="decisions.failedId()"
            (approved)="approveOvertime($event)"
            (declined)="declining.set({ id: $event.id, name: $event.employeeName ?? '', kind: 'overtime' })"
          />
          @if (pendingOvertime().length === 0) {
            <p class="attendance-off">{{ emptyText.overtime }}</p>
          }
        } @else if (tab() === 'home') {
          <app-home-day-list
            [days]="pendingHomeDays()"
            [busyId]="decisions.busyId()"
            [failedId]="decisions.failedId()"
            (approved)="approveHomeDay($event)"
            (declined)="declining.set({ id: $event.id, name: $event.employeeName ?? '', kind: 'home' })"
          />
          @if (pendingHomeDays().length === 0) {
            <p class="attendance-off">{{ emptyText.home }}</p>
          }
        } @else if (tab() === 'fixes') {
          @for (fix of pendingFixes(); track fix.id) {
            <div class="large-request" data-testid="pending-fix">
              <app-avatar [name]="fix.employeeName ?? ''" />
              <div>
                <strong>{{ fix.employeeName }}</strong>
                <span>{{ fixCategoryLabel(fix.category) }} · punch {{ fix.kind === 'missed-in' ? 'in' : 'out' }} · {{ submittedAgo(fix.raisedOn) }}</span>
              </div>
              <div><small>DATE</small><strong>{{ formatDayShort(fix.date) }}</strong></div>
              <div><small>TIME</small><strong>{{ fix.requestedTime }}</strong></div>
              <div><small>REASON</small><strong>{{ fix.reason ?? 'None given' }}</strong></div>
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
                @if (request.hasCertificate) {
                  <span class="certificate-note" data-testid="certificate">Medical certificate attached</span>
                } @else if (isMissingCertificate(request)) {
                  <span class="certificate-note missing" data-testid="certificate-missing">Medical certificate missing</span>
                }
                @if (describeExtras(request); as extras) {
                  <span class="certificate-note" data-testid="leave-extras">{{ extras }}</span>
                }
              </div>
              <div><small>DATES</small><strong>{{ describeDates(request) }}</strong></div>
              <div><small>DURATION</small><strong>{{ describeLength(request) }}</strong></div>
              <div><small>{{ request.decisionNote ? 'YOUR NOTE' : 'REASON' }}</small><strong>{{ request.decisionNote ?? request.reason }}</strong></div>
              @if (isWaitingForHr(request)) {
                <app-status-pill tone="late">Waiting for HR</app-status-pill>
              } @else if (request.status === 'pending') {
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
        <app-decline-form [name]="target.name" [placeholder]="declineExample[target.kind]" (declined)="decline(target, $event)" (cancelled)="declining.set(undefined)" />
      }
    </app-dialog>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApprovalsPage {
  private readonly api = inject(TeamApi);

  // Set from route data: an HOD decides for their team, a super admin for anyone but themselves.
  readonly scope = input<ViewScope>('team');

  protected readonly leave = this.api.leaveRequests({ scope: this.scope });
  protected readonly fixes = this.api.corrections({ scope: this.scope });
  protected readonly homeDays = this.api.homeDays({ status: 'pending', scope: this.scope });
  protected readonly compOffs = this.api.compOffs({ status: 'pending', scope: this.scope });
  protected readonly overtime = this.api.overtime({ status: 'pending', scope: this.scope });
  protected readonly resignations = this.api.resignations({ status: 'pending', scope: this.scope });
  private readonly types = inject(LeaveApi).types();
  protected readonly decisions = new DecisionState();

  protected readonly tab = signal<Tab>('pending');
  protected readonly declining = signal<Declining | undefined>(undefined);

  protected readonly leaveList = computed(() => valueOr(this.leave, []));
  protected readonly pendingFixes = computed(() =>
    valueOr(this.fixes, [])
      .filter((fix) => fix.status === 'pending' && !isWaitingForHr(fix))
      .sort((first, second) => first.raisedOn.localeCompare(second.raisedOn)),
  );
  protected readonly pendingHomeDays = computed(() => valueOr(this.homeDays, []).filter(isHodStep).sort((first, second) => first.date.localeCompare(second.date)));
  protected readonly pendingCompOffs = computed(() => valueOr(this.compOffs, []).filter(isHodStep).sort((first, second) => first.date.localeCompare(second.date)));
  protected readonly pendingOvertime = computed(() => valueOr(this.overtime, []).filter(isHodStep).sort((first, second) => first.date.localeCompare(second.date)));
  protected readonly pendingResignations = computed(() =>
    valueOr(this.resignations, []).filter(isHodStep).sort((first, second) => first.submittedOn.localeCompare(second.submittedOn)),
  );
  private readonly byStatus = (status: LeaveRequest['status']) => this.leaveList().filter((request) => request.status === status);

  protected readonly tabs = computed(() => [
    { value: 'pending' as const, label: 'Pending', count: this.byStatus('pending').filter(isHodStep).length },
    { value: 'approved' as const, label: 'Approved', count: 0 },
    { value: 'rejected' as const, label: 'Declined', count: 0 },
    { value: 'fixes' as const, label: 'Punch fixes', count: this.pendingFixes().length },
    { value: 'home' as const, label: 'Home working', count: this.pendingHomeDays().length },
    { value: 'comp-off' as const, label: 'Comp off', count: this.pendingCompOffs().length },
    { value: 'overtime' as const, label: 'Overtime', count: this.pendingOvertime().length },
    { value: 'resignations' as const, label: 'Resignations', count: this.pendingResignations().length },
  ]);

  protected readonly shown = computed(() => {
    const tab = this.tab();
    const list = tab === 'pending' || tab === 'approved' || tab === 'rejected' ? this.byStatus(tab) : [];
    // Oldest waiting first; decided ones newest first.
    return tab === 'pending'
      ? list.sort((first, second) => first.appliedOn.localeCompare(second.appliedOn))
      : list.sort((first, second) => (second.decidedOn ?? '').localeCompare(first.decidedOn ?? ''));
  });

  protected readonly emptyText: Record<Tab, string> = {
    pending: 'Nothing waiting for you. Enjoy the quiet.',
    fixes: 'No punch fixes waiting for you.',
    home: 'Nobody is waiting for a home working decision.',
    'comp-off': 'Nobody worked a day off that needs compensatory off.',
    overtime: 'Nobody stayed past the shift long enough to count.',
    resignations: 'Nobody has resigned.',
    approved: 'No approved requests yet.',
    rejected: 'You haven’t declined anything.',
  };

  // An example reason that fits what's being declined. A declined home day becomes an absence, so say why.
  protected readonly declineExample: Record<Declining['kind'], string> = {
    leave: 'Two others are off that week. Could you move it by a few days?',
    fix: 'The site log shows you left at 4, not 5. Could you check the time?',
    home: 'We had the site visit today, so I needed you in the office.',
    'comp-off': 'You came in by choice that Friday, so there’s nothing to give back.',
    overtime: 'The delivery was moved to the next day, so staying late wasn’t needed.',
    resignation: 'Your contract runs to the end of the project. Let’s talk about a later date.',
  };

  // Sick leave long enough to need a certificate, without one yet. They can still approve it.
  protected readonly isMissingCertificate = (request: LeaveRequest) =>
    request.status === 'pending' && needsCertificate(valueOr(this.types, []).find(({ code }) => code === request.type), request.days);
  protected readonly typeName = (code: string) => valueOr(this.types, []).find((type) => type.code === code)?.name ?? code;
  protected readonly othersOff = (request: LeaveRequest) =>
    this.leaveList()
      .filter((other) => other.employeeId !== request.employeeId && isOpen(other) && overlaps(other, request))
      .map((other) => `${other.employeeName}${other.status === 'pending' ? ' (pending)' : ''}`)
      .join(', ');

  protected readonly describeDates = describeDates;
  protected readonly isWaitingForHr = isWaitingForHr;
  protected readonly describeLength = describeLength;
  protected readonly describeExtras = describeExtras;
  protected readonly formatDayShort = formatDayShort;
  protected readonly fixCategoryLabel = fixCategoryLabel;
  protected readonly submittedAgo = submittedAgo;

  protected approveLeave({ id }: LeaveRequest) {
    return this.decisions.run(id, () => this.api.decideLeave(id, { decision: 'approved' }, this.scope()), () => this.leave.reload());
  }

  protected approveFix({ id }: CorrectionRequest) {
    return this.decisions.run(id, () => this.api.decideCorrection(id, { decision: 'approved' }, this.scope()), () => this.fixes.reload());
  }

  protected approveCompOff({ id }: CompOffClaim) {
    return this.decisions.run(id, () => this.api.decideCompOff(id, { decision: 'approved' }, this.scope()), () => this.compOffs.reload());
  }

  protected approveOvertime({ id }: OvertimeClaim) {
    return this.decisions.run(id, () => this.api.decideOvertime(id, { decision: 'approved' }, this.scope()), () => this.overtime.reload());
  }

  protected approveResignation({ id }: Resignation) {
    return this.decisions.run(id, () => this.api.decideResignation(id, { decision: 'approved' }, this.scope()), () => this.resignations.reload());
  }

  protected approveHomeDay({ id }: HomeDay) {
    return this.decisions.run(id, () => this.api.decideHomeDay(id, { decision: 'approved' }, this.scope()), () => this.homeDays.reload());
  }

  protected async decline(target: Declining, note: string) {
    this.declining.set(undefined);
    const decision = { decision: 'rejected' as const, note };
    const save = {
      leave: () => this.api.decideLeave(target.id, decision, this.scope()),
      fix: () => this.api.decideCorrection(target.id, decision, this.scope()),
      home: () => this.api.decideHomeDay(target.id, decision, this.scope()),
      'comp-off': () => this.api.decideCompOff(target.id, decision, this.scope()),
      overtime: () => this.api.decideOvertime(target.id, decision, this.scope()),
      resignation: () => this.api.decideResignation(target.id, decision, this.scope()),
    }[target.kind];
    const list = { leave: this.leave, fix: this.fixes, home: this.homeDays, 'comp-off': this.compOffs, overtime: this.overtime, resignation: this.resignations }[target.kind];
    return this.decisions.run(target.id, save, () => list.reload());
  }
}
