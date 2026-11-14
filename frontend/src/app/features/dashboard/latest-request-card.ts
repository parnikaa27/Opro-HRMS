import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LeaveRequest } from '../../models/leave';
import { Icon, IconName } from '../../shared/ui/icon';
import { StatusPill, Tone } from '../../shared/ui/status-pill';
import { formatShortDate } from '../../shared/utils/date-time';
import { valueOr } from '../../shared/utils/resource';
import { LeaveApi } from '../leave/leave-api';
import { describeDates, describeLength } from '../leave/leave-format';

const VIEW: Record<'approved' | 'rejected' | 'pending', { verb: string; icon: IconName; iconClass: string; pill: string; tone: Tone }> = {
  approved: { verb: 'approved', icon: 'checkCircle', iconClass: '', pill: 'Approved', tone: 'ok' },
  rejected: { verb: 'not approved', icon: 'xCircle', iconClass: 'declined', pill: 'Declined', tone: 'danger' },
  pending: { verb: 'waiting', icon: 'clock', iconClass: 'pending', pill: 'Waiting', tone: 'late' },
};

const lastTouched = ({ decidedOn, appliedOn }: LeaveRequest) => decidedOn ?? appliedOn;

@Component({
  selector: 'app-latest-request-card',
  imports: [Icon, RouterLink, StatusPill],
  template: `
    <section class="card approval-card" data-testid="latest-request">
      <div class="card-heading">
        <div>
          <span class="eyebrow">LATEST REQUEST</span>
          <h2>Leave approval</h2>
        </div>
      </div>
      @if (latest(); as request) {
        <div class="approval-row">
          <div class="approval-icon" [class]="view(request).iconClass"><app-icon [name]="view(request).icon" [size]="22" /></div>
          <div>
            <strong>{{ typeName(request.type) }} {{ view(request).verb }}</strong>
            <span>{{ describeDates(request) }} · {{ describeLength(request) }}</span>
          </div>
        </div>
        <div class="approved-by">
          <span>{{ byLine(request) }}</span>
          <app-status-pill [tone]="view(request).tone">{{ view(request).pill }}</app-status-pill>
        </div>
      } @else {
        <p class="attendance-off">No leave requests yet. <a routerLink="/leave" [queryParams]="{ apply: 1 }" class="text-link">Request leave</a></p>
      }
    </section>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LatestRequestCard {
  private readonly api = inject(LeaveApi);
  private readonly requests = this.api.requests();
  private readonly types = this.api.types();

  protected readonly latest = computed(() =>
    [...valueOr(this.requests, [])]
      .filter(({ status }) => status !== 'cancelled')
      .sort((first, second) => lastTouched(second).localeCompare(lastTouched(first)))[0],
  );

  protected readonly view = ({ status }: LeaveRequest) => VIEW[status === 'cancelled' ? 'pending' : status];
  protected readonly byLine = (request: LeaveRequest) =>
    request.status === 'pending'
      ? `Asked on ${formatShortDate(request.appliedOn)}`
      : `${request.status === 'approved' ? 'Approved' : 'Declined'} by ${request.decidedByName ?? 'your manager'}`;
  protected readonly typeName = (code: string) => valueOr(this.types, []).find((type) => type.code === code)?.name ?? code;
  protected readonly describeDates = describeDates;
  protected readonly describeLength = describeLength;
}
