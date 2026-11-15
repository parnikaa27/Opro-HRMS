import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const DEGREES_PER_PERCENT = 3.6;
const FULL = 100;
const COLOURS = { aqua: '#15b8a6', amber: '#fdba4a' } as const;

@Component({
  selector: 'app-circle-progress',
  template: `
    <div class="circle-progress" [style.--progress]="degrees()" [style.--ring]="colours[colour()]" role="img" [attr.aria-label]="label() + ' ' + sub()">
      <div>
        <strong>{{ label() }}</strong>
        <span>{{ sub() }}</span>
      </div>
    </div>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CircleProgress {
  readonly percent = input.required<number>();
  readonly label = input.required<string>();
  readonly sub = input.required<string>();
  readonly colour = input<keyof typeof COLOURS>('aqua');

  protected readonly colours = COLOURS;
  protected readonly degrees = computed(() => `${Math.min(Math.max(this.percent(), 0), FULL) * DEGREES_PER_PERCENT}deg`);
}
