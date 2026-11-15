import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LeaveBalance, LeaveType } from '../../models/leave';
import { CircleProgress } from '../../shared/ui/circle-progress';
import { Icon } from '../../shared/ui/icon';
import { plural } from '../../shared/utils/text';

const PERCENT = 100;
const RINGS = 2;
const HINTS: Readonly<Record<string, string>> = {
  family: 'Caring for a sick family member',
  maternity: 'Before and after your baby arrives',
  paternity: 'When your child is born',
  'comp-off': 'For Fridays and holidays you worked',
};

// The first two balances get rings like the design's annual and sick cards. The rest use its "special leave" card.
@Component({
  selector: 'app-leave-balances',
  imports: [CircleProgress, Icon],
  template: `
    <div class="leave-balance-row">
      @for (balance of balances(); track balance.type; let index = $index) {
        <div class="card leave-balance" data-testid="leave-balance">
          @if (index < rings) {
            <app-circle-progress [percent]="share(balance)" [label]="'' + available(balance)" [sub]="ringLabel(balance)" [colour]="index === 0 ? 'aqua' : 'amber'" />
            <div>
              <h3>{{ nameOf(balance.type) }}</h3>
              <span>{{ available(balance) }} of {{ plural(balance.entitled, 'day') }} available{{ balance.carriedOver ? ', ' + balance.carriedOver + ' carried over' : '' }}</span>
              <div class="progress-track" [class.amber]="index === 1"><i [style.width.%]="share(balance)"></i></div>
            </div>
          } @else {
            <div class="special-icon"><app-icon name="sparkles" /></div>
            <div>
              <h3>{{ nameOf(balance.type) }}</h3>
              <span>{{ plural(available(balance), 'day') }} available</span>
              <p>{{ hints[balance.type] ?? '' }}</p>
            </div>
          }
        </div>
      }
    </div>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeaveBalances {
  readonly balances = input.required<readonly LeaveBalance[]>();
  readonly types = input.required<readonly LeaveType[]>();

  protected readonly rings = RINGS;
  protected readonly hints = HINTS;
  protected readonly nameOf = (code: string) => this.types().find((type) => type.code === code)?.name ?? code;
  protected readonly available = (balance: LeaveBalance) => balance.entitled - balance.taken - balance.pending;
  protected readonly share = (balance: LeaveBalance) => (balance.entitled > 0 ? (this.available(balance) / balance.entitled) * PERCENT : 0);
  protected readonly ringLabel = (balance: LeaveBalance) => `${this.nameOf(balance.type).split(' ')[0].toLowerCase()} days`;
  protected readonly plural = plural;
}
