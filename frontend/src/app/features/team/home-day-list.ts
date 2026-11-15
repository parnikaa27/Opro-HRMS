import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { HomeDay } from '../../models/attendance';
import { Avatar } from '../../shared/ui/avatar';
import { Icon } from '../../shared/ui/icon';
import { formatDayShort } from '../../shared/utils/date-time';

// Days worked from home, waiting for a decision. Declining turns the day into an absence, so it needs a reason.
@Component({
  selector: 'app-home-day-list',
  imports: [Avatar, Icon],
  template: `
    @for (day of days(); track day.id) {
      <div class="large-request" data-testid="pending-home-day">
        <app-avatar [name]="day.employeeName ?? ''" />
        <div>
          <strong>{{ day.employeeName }}</strong>
          <span>Worked from home</span>
        </div>
        <div><small>DATE</small><strong>{{ formatDayShort(day.date) }}</strong></div>
        <div><small>IF DECLINED</small><strong>The day counts as absent</strong></div>
        <div class="request-actions labeled">
          <button type="button" class="decline" [disabled]="busyId() === day.id" (click)="declined.emit(day)" data-testid="reject"><app-icon name="x" [size]="16" /> Decline</button>
          <button type="button" class="approve" [disabled]="busyId() === day.id" (click)="approved.emit(day)" data-testid="approve"><app-icon name="check" [size]="16" /> Approve</button>
        </div>
        @if (failedId() === day.id) {
          <p class="row-error" role="alert">That didn't save. Try again in a moment.</p>
        }
      </div>
    }
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeDayList {
  readonly days = input.required<readonly HomeDay[]>();
  readonly busyId = input<string>();
  readonly failedId = input<string>();
  readonly approved = output<HomeDay>();
  readonly declined = output<HomeDay>();

  protected readonly formatDayShort = formatDayShort;
}
