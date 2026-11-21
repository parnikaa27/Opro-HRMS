import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { OnboardingItem, TaskOwner } from '../../models/onboarding';
import { StatusPill } from '../../shared/ui/status-pill';
import { formatShortDate, maldivesToday } from '../../shared/utils/date-time';
import { DecisionState } from '../team/decision-state';
import { OnboardingApi, OWNERS } from './onboarding-api';

// A joiner's onboarding tasks, each with who does it and when it's due. Only the reader's own can be ticked.
@Component({
  selector: 'app-onboarding-checklist',
  imports: [StatusPill],
  template: `
    <ul class="onboarding-checklist">
      @for (item of items(); track item.id) {
        <li [class.done]="item.doneOn" data-testid="onboarding-item">
          <div>
            <strong>{{ item.name }}</strong>
            <span>{{ owners[item.owner] }} · {{ item.doneOn ? 'Done ' + formatShortDate(item.doneOn) + (item.doneByName ? ' by ' + item.doneByName : '') : 'Due ' + formatShortDate(item.dueOn) }}</span>
          </div>
          @if (item.owner === ticks()) {
            <button type="button" class="text-link" [disabled]="decisions.busyId() === item.id" (click)="tick(item)" [attr.data-testid]="item.doneOn ? 'undo-task' : 'do-task'">{{ item.doneOn ? 'Undo' : 'Mark done' }}</button>
          } @else if (!item.doneOn && item.dueOn < today) {
            <app-status-pill tone="danger">Overdue</app-status-pill>
          }
        </li>
      }
    </ul>
    @if (decisions.failedId()) {
      <p class="row-error" role="alert">That didn't save. Try again in a moment.</p>
    }
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnboardingChecklist {
  private readonly api = inject(OnboardingApi);
  readonly employeeId = input.required<string>();
  readonly items = input.required<readonly OnboardingItem[]>();
  // Whose tasks the reader ticks. Left out to only read.
  readonly ticks = input<TaskOwner>();
  readonly changed = output();

  protected readonly decisions = new DecisionState();
  protected readonly owners = OWNERS;
  protected readonly today = maldivesToday();
  protected readonly formatShortDate = formatShortDate;

  protected tick({ id, doneOn }: OnboardingItem) {
    return this.decisions.run(id, () => this.api.tick(this.employeeId(), id, !doneOn), () => this.changed.emit());
  }
}
