import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { LeaveRequest, LeaveStatus, LeaveType } from '../../models/leave';
import { StatusPill, Tone } from '../../shared/ui/status-pill';
import { formatShortDate, maldivesToday } from '../../shared/utils/date-time';
import { LeaveApi } from './leave-api';
import { describeDates, describeLength } from './leave-format';

const STATUS: Record<LeaveStatus, { label: string; tone: Tone }> = {
  pending: { label: 'Waiting', tone: 'late' },
  approved: { label: 'Approved', tone: 'ok' },
  rejected: { label: 'Not approved', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};

@Component({
  selector: 'app-leave-requests',
  imports: [StatusPill],
  template: `
    <ul class="divide-y divide-line rounded-2xl border border-line bg-card shadow-lift">
      @for (request of sorted(); track request.id) {
        <li class="p-5" data-testid="leave-request">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 class="font-medium">{{ nameOf(request.type) }}</h3>
              <p class="mt-0.5 text-sm text-soft">{{ dates(request) }}, {{ length(request) }}</p>
            </div>
            <app-status-pill [tone]="status[request.status].tone">{{ status[request.status].label }}</app-status-pill>
          </div>
          <p class="mt-3 text-sm">{{ request.reason }}</p>
          @if (request.decisionNote) {
            <blockquote class="mt-3 border-s-2 border-line ps-3 text-sm text-soft">“{{ request.decisionNote }}”</blockquote>
          }
          <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-soft">
            <span>Applied {{ formatShortDate(request.appliedOn) }}</span>
            @if (!isReadOnly() && canCancel(request)) {
              @if (confirming() === request.id) {
                <span class="flex flex-wrap items-center gap-2 text-sm text-ink" role="group" aria-label="Confirm cancellation">
                  Cancel this request?
                  <button type="button" class="btn-quiet px-3 py-1 text-danger hover:bg-danger-soft" (click)="cancel(request.id)" data-testid="confirm-cancel">Yes, cancel it</button>
                  <button type="button" class="btn-quiet px-3 py-1" (click)="confirming.set(undefined)">Keep it</button>
                </span>
              } @else {
                <button type="button" class="font-medium text-sea hover:underline" (click)="confirming.set(request.id)" data-testid="cancel-request">Cancel request</button>
              }
            }
          </div>
          @if (failedId() === request.id) {
            <p class="mt-2 text-sm text-danger" role="alert">Couldn't cancel it. Try again in a moment.</p>
          }
        </li>
      } @empty {
        <li class="p-5 text-sm text-soft">No requests yet. When you apply for leave, it shows up here with its status.</li>
      }
    </ul>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeaveRequests {
  private readonly api = inject(LeaveApi);
  private readonly today = maldivesToday();

  readonly requests = input.required<readonly LeaveRequest[]>();
  readonly types = input.required<readonly LeaveType[]>();
  readonly isReadOnly = input(false);
  readonly changed = output();

  protected readonly sorted = computed(() => [...this.requests()].sort((first, second) => second.from.localeCompare(first.from)));
  protected readonly confirming = signal<string | undefined>(undefined);
  protected readonly failedId = signal<string | undefined>(undefined);
  protected readonly status = STATUS;

  protected readonly nameOf = (code: string) => this.types().find((type) => type.code === code)?.name ?? code;
  protected readonly canCancel = ({ status, from }: LeaveRequest) => status === 'pending' || (status === 'approved' && from > this.today);
  protected readonly dates = describeDates;
  protected readonly length = describeLength;
  protected readonly formatShortDate = formatShortDate;

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
