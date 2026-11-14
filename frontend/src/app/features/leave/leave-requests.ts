import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { LeaveRequest, LeaveStatus, LeaveType } from '../../models/leave';
import { Icon } from '../../shared/ui/icon';
import { StatusPill, Tone } from '../../shared/ui/status-pill';
import { maldivesToday } from '../../shared/utils/date-time';
import { LeaveApi } from './leave-api';
import { describeDates, describeLength } from './leave-format';

const STATUS: Record<LeaveStatus, { label: string; tone: Tone }> = {
  pending: { label: 'Pending', tone: 'late' },
  approved: { label: 'Approved', tone: 'ok' },
  rejected: { label: 'Declined', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};

@Component({
  selector: 'app-leave-requests',
  imports: [Icon, StatusPill],
  template: `
    <section class="card request-history">
      <div class="card-heading">
        <div>
          <span class="eyebrow">REQUEST HISTORY</span>
          <h2>{{ heading() }}</h2>
        </div>
      </div>
      @for (request of sorted(); track request.id) {
        <div class="history-row" data-testid="leave-request">
          <div class="leave-type-icon"><app-icon name="palm" [size]="18" /></div>
          <div>
            <strong>{{ nameOf(request.type) }}</strong>
            <span>{{ dates(request) }}@if (request.decisionNote) { · “{{ request.decisionNote }}”}</span>
            @if (!isReadOnly() && canCancel(request)) {
              @if (confirming() === request.id) {
                <span class="row-actions" role="group" aria-label="Confirm cancellation">
                  Cancel this request?
                  <button type="button" class="text-link danger" (click)="cancel(request.id)" data-testid="confirm-cancel">Yes, cancel it</button>
                  <button type="button" class="text-link" (click)="confirming.set(undefined)">Keep it</button>
                </span>
              } @else {
                <span class="row-actions"><button type="button" class="text-link" (click)="confirming.set(request.id)" data-testid="cancel-request">Cancel request</button></span>
              }
            }
            @if (failedId() === request.id) {
              <span class="row-error" role="alert">Couldn't cancel it. Try again in a moment.</span>
            }
          </div>
          <span>{{ length(request) }}</span>
          <app-status-pill [tone]="status[request.status].tone">{{ status[request.status].label }}</app-status-pill>
        </div>
      } @empty {
        <p class="attendance-off">No requests yet. When you apply for leave, it shows up here with its status.</p>
      }
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeaveRequests {
  private readonly api = inject(LeaveApi);
  private readonly today = maldivesToday();

  readonly requests = input.required<readonly LeaveRequest[]>();
  readonly types = input.required<readonly LeaveType[]>();
  readonly isReadOnly = input(false);
  readonly heading = input('My leave requests');
  readonly changed = output();

  protected readonly sorted = computed(() => [...this.requests()].sort((first, second) => second.from.localeCompare(first.from)));
  protected readonly confirming = signal<string | undefined>(undefined);
  protected readonly failedId = signal<string | undefined>(undefined);
  protected readonly status = STATUS;

  protected readonly nameOf = (code: string) => this.types().find((type) => type.code === code)?.name ?? code;
  protected readonly canCancel = ({ status, from }: LeaveRequest) => status === 'pending' || (status === 'approved' && from > this.today);
  protected readonly dates = describeDates;
  protected readonly length = describeLength;

  protected async cancel(id: string) {
    this.failedId.set(undefined);
    try {
      await this.api.cancel(id);
      this.confirming.set(undefined);
      this.changed.emit();
    } catch (error) {
      console.error('Cancelling leave failed', error);
      this.failedId.set(id);
    }
  }
}
