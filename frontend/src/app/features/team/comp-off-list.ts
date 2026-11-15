import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CompOffClaim } from '../../models/attendance';
import { Avatar } from '../../shared/ui/avatar';
import { Icon } from '../../shared/ui/icon';
import { formatDayShort, formatDuration } from '../../shared/utils/date-time';
import { plural } from '../../shared/utils/text';

// Fridays and holidays worked, waiting for compensatory off. What it earns comes from the day's punches.
@Component({
  selector: 'app-comp-off-list',
  imports: [Avatar, Icon],
  template: `
    @for (claim of claims(); track claim.id) {
      <div class="large-request" data-testid="pending-comp-off">
        <app-avatar [name]="claim.employeeName ?? ''" />
        <div>
          <strong>{{ claim.employeeName }}</strong>
          <span>Worked on a day off</span>
        </div>
        <div><small>DATE</small><strong>{{ formatDayShort(claim.date) }}</strong></div>
        <div><small>WORKED</small><strong>{{ claim.workedMinutes ? formatDuration(claim.workedMinutes) : 'Still punched in' }}</strong></div>
        <div><small>EARNS</small><strong>{{ claim.days === 0.5 ? 'Half a day' : plural(claim.days, 'day') }}</strong></div>
        <div class="request-actions labeled">
          <button type="button" class="decline" [disabled]="busyId() === claim.id" (click)="declined.emit(claim)" data-testid="reject"><app-icon name="x" [size]="16" /> Decline</button>
          <button type="button" class="approve" [disabled]="busyId() === claim.id" (click)="approved.emit(claim)" data-testid="approve"><app-icon name="check" [size]="16" /> Approve</button>
        </div>
        @if (failedId() === claim.id) {
          <p class="row-error" role="alert">That didn't save. If they haven't punched out yet, try again once they have.</p>
        }
      </div>
    }
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CompOffList {
  readonly claims = input.required<readonly CompOffClaim[]>();
  readonly busyId = input<string>();
  readonly failedId = input<string>();
  readonly approved = output<CompOffClaim>();
  readonly declined = output<CompOffClaim>();

  protected readonly formatDayShort = formatDayShort;
  protected readonly formatDuration = formatDuration;
  protected readonly plural = plural;
}
