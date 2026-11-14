import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CorrectionRequest } from '../../models/attendance';
import { LeaveRequest } from '../../models/leave';
import { Avatar } from '../../shared/ui/avatar';
import { StatusPill } from '../../shared/ui/status-pill';
import { formatDayShort, formatShortDate } from '../../shared/utils/date-time';
import { valueOr } from '../../shared/utils/resource';
import { LeaveApi } from '../leave/leave-api';
import { describeDates, describeLength } from '../leave/leave-format';
import { DecisionControls } from './decision-controls';
import { Decision, TeamApi } from './team-api';
import { ListSkeleton } from '../../shared/ui/list-skeleton';

const HISTORY_SIZE = 10;
const isOpen = ({ status }: LeaveRequest) => status === 'approved' || status === 'pending';
const overlaps = (first: LeaveRequest, second: LeaveRequest) => first.from <= second.to && first.to >= second.from;
const punchLabel = ({ kind }: CorrectionRequest) => (kind === 'missed-in' ? 'punch in' : 'punch out');

@Component({
  selector: 'app-approvals-page',
  imports: [ListSkeleton, Avatar, DecisionControls, StatusPill],
  template: `
    <header class="mb-8">
      <h1 class="font-display text-3xl tracking-tight sm:text-4xl">Approvals</h1>
      <p class="mt-2 text-soft">Leave and punch fixes from your team, oldest first.</p>
    </header>

    <section aria-labelledby="leave-heading">
      <h2 id="leave-heading" class="eyebrow mb-3">Leave requests</h2>
      @if (leave.error()) {
        <p class="text-sm text-danger">Leave requests didn't load. Refresh the page to try again.</p>
      } @else if (leave.isLoading() && leaveList().length === 0) {
        <app-list-skeleton [count]="2" />
      } @else {
        <ul class="space-y-3">
          @for (request of pendingLeave(); track request.id) {
            <li class="rounded-2xl border border-line bg-card p-5 shadow-lift" data-testid="pending-leave">
              <div class="flex items-start gap-3">
                <app-avatar [name]="request.employeeName ?? ''" />
                <div class="min-w-0 flex-1">
                  <p class="font-medium">{{ request.employeeName }}</p>
                  <p class="text-sm text-soft">{{ typeName(request.type) }}, {{ describeDates(request) }}, {{ describeLength(request) }}</p>
                </div>
                <span class="text-xs text-soft">Asked {{ formatShortDate(request.appliedOn) }}</span>
              </div>
              <p class="mt-3 text-sm">{{ request.reason }}</p>
              @if (othersOff(request); as others) {
                <p class="mt-3 rounded-xl bg-late-soft px-3 py-2 text-sm text-late" data-testid="overlap">Also off then: {{ others }}</p>
              }
              <app-decision-controls
                [requestId]="request.id"
                [isBusy]="busyId() === request.id"
                [hasFailed]="failedId() === request.id"
                (decided)="decideLeave(request.id, $event)"
              />
            </li>
          } @empty {
            <li class="rounded-2xl border border-line bg-card px-5 py-4 text-sm text-soft">No leave waiting for you.</li>
          }
        </ul>
      }
    </section>

    <section class="mt-10" aria-labelledby="fixes-heading">
      <h2 id="fixes-heading" class="eyebrow mb-3">Punch fixes</h2>
      @if (fixes.error()) {
        <p class="text-sm text-danger">Punch fixes didn't load. Refresh the page to try again.</p>
      } @else if (fixes.isLoading() && fixList().length === 0) {
        <app-list-skeleton [count]="1" />
      } @else {
        <ul class="space-y-3">
          @for (fix of pendingFixes(); track fix.id) {
            <li class="rounded-2xl border border-line bg-card p-5 shadow-lift" data-testid="pending-fix">
              <div class="flex items-start gap-3">
                <app-avatar [name]="fix.employeeName ?? ''" />
                <div class="min-w-0 flex-1">
                  <p class="font-medium">{{ fix.employeeName }}</p>
                  <p class="text-sm text-soft">Missed {{ punchLabel(fix) }} on {{ formatDayShort(fix.date) }}. Says it was {{ fix.requestedTime }}.</p>
                </div>
                <span class="text-xs text-soft">Asked {{ formatShortDate(fix.raisedOn) }}</span>
              </div>
              <p class="mt-3 text-sm">{{ fix.reason }}</p>
              <app-decision-controls
                [requestId]="fix.id"
                [isBusy]="busyId() === fix.id"
                [hasFailed]="failedId() === fix.id"
                (decided)="decideFix(fix.id, $event)"
              />
            </li>
          } @empty {
            <li class="rounded-2xl border border-line bg-card px-5 py-4 text-sm text-soft">No punch fixes waiting for you.</li>
          }
        </ul>
      }
    </section>

    @if (history().length > 0) {
      <section class="mt-10" aria-labelledby="history-heading">
        <h2 id="history-heading" class="eyebrow mb-3">Decided recently</h2>
        <ul class="divide-y divide-line rounded-2xl border border-line bg-card shadow-lift">
          @for (item of history(); track item.id) {
            <li class="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-sm" data-testid="decided">
              <span>{{ item.text }}</span>
              <app-status-pill [tone]="item.isApproved ? 'ok' : 'danger'">{{ item.isApproved ? 'Approved' : 'Not approved' }}</app-status-pill>
            </li>
          }
        </ul>
      </section>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApprovalsPage {
  private readonly api = inject(TeamApi);

  protected readonly leave = this.api.leaveRequests();
  protected readonly fixes = this.api.corrections();
  private readonly types = inject(LeaveApi).types();

  protected readonly leaveList = computed(() => valueOr(this.leave, []));
  protected readonly fixList = computed(() => valueOr(this.fixes, []));

  protected readonly pendingLeave = computed(() =>
    this.leaveList().filter(({ status }) => status === 'pending').sort((first, second) => first.appliedOn.localeCompare(second.appliedOn)),
  );
  protected readonly pendingFixes = computed(() =>
    this.fixList().filter(({ status }) => status === 'pending').sort((first, second) => first.raisedOn.localeCompare(second.raisedOn)),
  );

  protected readonly history = computed(() =>
    [
      ...this.leaveList()
        .filter(({ status }) => status === 'approved' || status === 'rejected')
        .map((request) => ({
          id: request.id,
          decidedOn: request.decidedOn ?? '',
          isApproved: request.status === 'approved',
          text: `${request.employeeName}, ${this.typeName(request.type).toLowerCase()}, ${describeDates(request)}`,
        })),
      ...this.fixList()
        .filter(({ status }) => status !== 'pending')
        .map((fix) => ({
          id: fix.id,
          decidedOn: fix.decidedOn ?? '',
          isApproved: fix.status === 'approved',
          text: `${fix.employeeName}, ${punchLabel(fix)} fix for ${formatShortDate(fix.date)}`,
        })),
    ]
      .sort((first, second) => second.decidedOn.localeCompare(first.decidedOn))
      .slice(0, HISTORY_SIZE),
  );

  protected readonly busyId = signal<string | undefined>(undefined);
  protected readonly failedId = signal<string | undefined>(undefined);

  protected readonly typeName = (code: string) => valueOr(this.types, []).find((type) => type.code === code)?.name ?? code;
  protected readonly othersOff = (request: LeaveRequest) =>
    this.leaveList()
      .filter((other) => other.employeeId !== request.employeeId && isOpen(other) && overlaps(other, request))
      .map((other) => `${other.employeeName}${other.status === 'pending' ? ' (waiting)' : ''}`)
      .join(', ');

  protected readonly describeDates = describeDates;
  protected readonly describeLength = describeLength;
  protected readonly formatShortDate = formatShortDate;
  protected readonly formatDayShort = formatDayShort;
  protected readonly punchLabel = punchLabel;

  protected decideLeave(id: string, decision: Decision) {
    return this.decide(id, () => this.api.decideLeave(id, decision), () => this.leave.reload());
  }

  protected decideFix(id: string, decision: Decision) {
    return this.decide(id, () => this.api.decideCorrection(id, decision), () => this.fixes.reload());
  }

  private async decide(id: string, save: () => Promise<unknown>, refresh: () => void) {
    this.busyId.set(id);
    this.failedId.set(undefined);
    try {
      await save();
      refresh();
    } catch (error) {
      console.error('Saving a decision failed', error);
      this.failedId.set(id);
    } finally {
      this.busyId.set(undefined);
    }
  }
}
