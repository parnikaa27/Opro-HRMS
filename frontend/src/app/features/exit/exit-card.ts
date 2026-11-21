import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { ChecklistItem, Resignation } from '../../models/exit';
import { StatusPill } from '../../shared/ui/status-pill';
import { formatFullDate } from '../../shared/utils/date-time';
import { DecisionState } from '../team/decision-state';
import { ExitApi } from './exit-api';
import { itemStatus } from './exit-status';

// On HR's page for someone who resigned: their exit date, and each item to tick off as it comes back. They can be
// marked as leaving once nothing is still out.
@Component({
  selector: 'app-exit-card',
  imports: [StatusPill],
  template: `
    <section class="card request-history" data-testid="exit-card">
      <div class="card-heading"><div><span class="eyebrow">LEAVING OPRO</span><h2>Exit checklist</h2></div></div>
      <p class="card-note">
        Resigned on {{ formatFullDate(resignation().submittedOn) }}: “{{ resignation().reason }}” Exit date {{ formatFullDate(resignation().exitOn ?? resignation().releaseOn) }}.
      </p>
      @for (item of resignation().checklist; track item.itemId) {
        <div class="history-row exit-row" data-testid="exit-item">
          <div>
            <strong>{{ item.name }}</strong>
          </div>
          <app-status-pill [tone]="itemStatus(item, 'them').tone">{{ itemStatus(item, 'them').label }}</app-status-pill>
          @if (!isOwn()) {
            <span class="row-actions">
              @if (item.outcome) {
                <button type="button" class="text-link" [disabled]="decisions.busyId() === item.itemId" (click)="untick(item)" data-testid="untick">Undo</button>
              } @else {
                <button type="button" class="text-link" [disabled]="decisions.busyId() === item.itemId" (click)="tick(item, 'returned')" data-testid="returned">Returned</button>
                <button type="button" class="text-link" [disabled]="decisions.busyId() === item.itemId" (click)="tick(item, 'not-given')" data-testid="not-given">Never given</button>
              }
            </span>
          }
          @if (decisions.failedId() === item.itemId) {
            <p class="row-error" role="alert">That didn't save. Try again in a moment.</p>
          }
        </div>
      } @empty {
        <p class="attendance-off">Nothing on the list to hand back. Add items in Policies.</p>
      }
    </section>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExitCard {
  private readonly api = inject(ExitApi);
  readonly employeeId = input.required<string>();
  readonly resignation = input.required<Resignation>();
  // HR never ticks off their own.
  readonly isOwn = input(false);
  readonly changed = output();

  protected readonly decisions = new DecisionState();
  protected readonly itemStatus = itemStatus;
  protected readonly formatFullDate = formatFullDate;

  protected tick({ itemId }: ChecklistItem, outcome: 'returned' | 'not-given') {
    return this.decisions.run(itemId, () => this.api.tick(this.employeeId(), itemId, outcome), () => this.changed.emit());
  }

  protected untick({ itemId }: ChecklistItem) {
    return this.decisions.run(itemId, () => this.api.untick(this.employeeId(), itemId), () => this.changed.emit());
  }
}
