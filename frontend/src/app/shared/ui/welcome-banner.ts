import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Icon } from './icon';

@Component({
  selector: 'app-welcome-banner',
  imports: [Icon],
  template: `
    <section class="welcome">
      <div>
        <p><app-icon name="sparkles" [size]="14" /> {{ dateLabel() }}</p>
        <h1 data-testid="greeting">{{ heading() }}</h1>
        <span data-testid="welcome-line">{{ line() }}</span>
      </div>
      <div class="welcome-art" aria-hidden="true">
        <div class="sun"></div>
        <div class="island"><app-icon name="palm" [size]="52" [strokeWidth]="1.4" /></div>
        <div class="wave w1"></div>
        <div class="wave w2"></div>
      </div>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WelcomeBanner {
  readonly dateLabel = input.required<string>();
  readonly heading = input.required<string>();
  readonly line = input.required<string>();
}
