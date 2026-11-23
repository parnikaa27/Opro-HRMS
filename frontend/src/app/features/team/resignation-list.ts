import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Resignation } from '../../models/exit';
import { Avatar } from '../../shared/ui/avatar';
import { Icon } from '../../shared/ui/icon';
import { formatFullDate } from '../../shared/utils/date-time';
import { submittedAgo } from './request-row';

// Reports who resigned, waiting for their HOD. Approving passes it to HR, who sets the exit date.
@Component({
  selector: 'app-resignation-list',
  imports: [Avatar, Icon],
  template: `
    @for (resignation of resignations(); track resignation.id) {
      <div class="large-request" data-testid="pending-resignation">
        <app-avatar [name]="resignation.employeeName ?? ''" />
        <div>
          <strong>{{ resignation.employeeName }}</strong>
          <span>Resigned · {{ submittedAgo(resignation.submittedOn) }}</span>
        </div>
        <div><small>Last day asked for</small><strong>{{ formatFullDate(resignation.releaseOn) }}</strong></div>
        <div><small>Reason</small><strong>{{ resignation.reason }}</strong></div>
        <div class="request-actions labeled">
          <button type="button" class="decline" [disabled]="busyId() === resignation.id" (click)="declined.emit(resignation)" data-testid="reject"><app-icon name="x" [size]="16" /> Decline</button>
          <button type="button" class="approve" [disabled]="busyId() === resignation.id" (click)="approved.emit(resignation)" data-testid="approve"><app-icon name="check" [size]="16" /> Approve</button>
        </div>
        @if (failedId() === resignation.id) {
          <p class="row-error" role="alert">That didn't save. Try again in a moment.</p>
        }
      </div>
    }
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResignationList {
  readonly resignations = input.required<readonly Resignation[]>();
  readonly busyId = input<string>();
  readonly failedId = input<string>();
  readonly approved = output<Resignation>();
  readonly declined = output<Resignation>();

  protected readonly formatFullDate = formatFullDate;
  protected readonly submittedAgo = submittedAgo;
}
