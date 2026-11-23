import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { COMP_OFF, LeaveBalance, LeaveType } from '../../models/leave';
import { CircleProgress } from '../../shared/ui/circle-progress';
import { formatCompactDate, formatShortDate, maldivesToday } from '../../shared/utils/date-time';
import { plural } from '../../shared/utils/text';
import { leaveYearOf } from './leave-days';

const PERCENT = 100;
const RINGS = 2;

// The first two balances get rings like the design's annual and sick cards. Every type is then in one table:
// what the year gives, what's carried forward, approved, taken so far, waiting and left.
@Component({
  selector: 'app-leave-balances',
  imports: [CircleProgress],
  template: `
    <div class="leave-balance-row">
      @for (balance of ringed(); track balance.type; let index = $index) {
        <div class="card leave-balance" data-testid="leave-balance">
          <app-circle-progress [percent]="share(balance)" [label]="'' + left(balance)" [sub]="ringLabel(balance)" [colour]="index === 0 ? 'aqua' : 'amber'" />
          <div>
            <h3>{{ nameOf(balance.type) }}</h3>
            <span>{{ left(balance) }} of {{ plural(balance.entitled, 'day') }} available{{ balance.carriedOver ? ', ' + balance.carriedOver + ' carried over' : '' }}</span>
            <div class="progress-track" [class.amber]="index === 1"><i [style.width.%]="share(balance)"></i></div>
          </div>
        </div>
      }
    </div>

    <section class="card full-table" data-testid="balance-table">
      <div class="card-heading">
        <div>
          <span class="eyebrow">Leave balance</span>
          <h2>{{ yearLabel() }}</h2>
        </div>
      </div>
      <div class="table-wrap">
        <table class="stacks">
          <thead>
            <tr>
              <th scope="col">Type</th><th scope="col">This year</th><th scope="col">Carried forward</th><th scope="col">Approved</th>
              <th scope="col">Taken so far</th><th scope="col">Waiting</th><th scope="col">Left</th>
            </tr>
          </thead>
          <tbody>
            @for (balance of balances(); track balance.type) {
              <tr data-testid="balance-row">
                <td>
                  <strong>{{ nameOf(balance.type) }}</strong>
                  @if (balance.type === compOff && balance.expiresOn) {
                    <small class="cell-note">Take by {{ formatShortDate(balance.expiresOn) }}</small>
                  }
                </td>
                <td data-label="This year">{{ balance.entitled - (balance.carriedOver ?? 0) }}</td>
                <td data-label="Carried forward">{{ balance.carriedOver ?? 0 }}</td>
                <td data-label="Approved">{{ balance.taken }}</td>
                <td data-label="Taken so far">{{ balance.takenToDate ?? balance.taken }}</td>
                <td data-label="Waiting">{{ balance.pending }}</td>
                <td data-label="Left"><strong>{{ left(balance) }}</strong></td>
              </tr>
            } @empty {
              <tr><td colspan="7">No leave to show yet.</td></tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LeaveBalances {
  readonly balances = input.required<readonly LeaveBalance[]>();
  readonly types = input.required<readonly LeaveType[]>();
  // Their joining date, which sets when their leave year runs.
  readonly joinedOn = input<string>();

  protected readonly compOff = COMP_OFF;
  protected readonly ringed = computed(() => this.balances().slice(0, RINGS));
  protected readonly yearLabel = computed(() => {
    const joinedOn = this.joinedOn();
    if (!joinedOn) {
      return 'This leave year';
    }
    const { start, end } = leaveYearOf(joinedOn, maldivesToday());
    return `${formatCompactDate(start)} to ${formatCompactDate(end)}`;
  });
  protected readonly nameOf = (code: string) => this.types().find((type) => type.code === code)?.name ?? code;
  protected readonly left = (balance: LeaveBalance) => balance.entitled - balance.taken - balance.pending;
  protected readonly share = (balance: LeaveBalance) => (balance.entitled > 0 ? (this.left(balance) / balance.entitled) * PERCENT : 0);
  protected readonly ringLabel = (balance: LeaveBalance) => `${this.nameOf(balance.type).split(' ')[0].toLowerCase()} days`;
  protected readonly plural = plural;
  protected readonly formatShortDate = formatShortDate;
}
