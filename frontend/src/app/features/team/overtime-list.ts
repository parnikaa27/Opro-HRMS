import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { OvertimeClaim } from '../../models/attendance';
import { Avatar } from '../../shared/ui/avatar';
import { Icon } from '../../shared/ui/icon';
import { formatDayShort, formatDuration } from '../../shared/utils/date-time';

// Working days someone stayed past the shift. The minutes come from the day's punches and are kept on approval.
@Component({
  selector: 'app-overtime-list',
  imports: [Avatar, Icon],
  template: `
    @for (claim of claims(); track claim.id) {
      <div class="large-request" data-testid="pending-overtime">
        <app-avatar [name]="claim.employeeName ?? ''" />
        <div>
          <strong>{{ claim.employeeName }}</strong>
          <span>Stayed past the shift</span>
        </div>
        <div><small>DATE</small><strong>{{ formatDayShort(claim.date) }}</strong></div>
        <div><small>OVERTIME</small><strong>{{ claim.minutes ? formatDuration(claim.minutes) : 'Under 30 minutes now' }}</strong></div>
        <div class="request-actions labeled">
          <button type="button" class="decline" [disabled]="busyId() === claim.id" (click)="declined.emit(claim)" data-testid="reject"><app-icon name="x" [size]="16" /> Decline</button>
          <button type="button" class="approve" [disabled]="busyId() === claim.id || !claim.minutes" (click)="approved.emit(claim)" data-testid="approve"><app-icon name="check" [size]="16" /> Approve</button>
        </div>
        @if (failedId() === claim.id) {
          <p class="row-error" role="alert">That didn't save. Try again in a moment.</p>
        }
      </div>
    }
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OvertimeList {
  readonly claims = input.required<readonly OvertimeClaim[]>();
  readonly busyId = input<string>();
  readonly failedId = input<string>();
  readonly approved = output<OvertimeClaim>();
  readonly declined = output<OvertimeClaim>();

  protected readonly formatDayShort = formatDayShort;
  protected readonly formatDuration = formatDuration;
}
