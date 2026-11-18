import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { plural } from '../../shared/utils/text';
import { Share } from './insights';

// A short list of groups with their count, share and a bar, biggest first. Numbers always sit beside the bar.
@Component({
  selector: 'app-breakdown',
  template: `
    <ul class="breakdown" [attr.aria-label]="label()">
      @for (share of shares(); track share.label) {
        <li data-testid="breakdown-row">
          <span>{{ share.label }}</span>
          <i aria-hidden="true"><b [style.width.%]="share.percent"></b></i>
          <strong>{{ unit() ? plural(share.count, unit()) : share.count }}</strong>
          @if (showsPercent()) {
            <small>{{ share.percent }}%</small>
          }
        </li>
      } @empty {
        <li class="attendance-off">{{ empty() }}</li>
      }
    </ul>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Breakdown {
  readonly shares = input.required<readonly Share[]>();
  readonly label = input.required<string>();
  // A singular noun, "day", counted as "1 day" or "3 days". Without one, just the number.
  readonly unit = input('');
  readonly showsPercent = input(true);
  readonly empty = input('Nothing to show yet.');
  protected readonly plural = plural;
}
