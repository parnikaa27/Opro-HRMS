import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-welcome-banner',
  template: `
    <section class="welcome">
      <div>
        <p>{{ dateLabel() }}</p>
        <h1 data-testid="page-heading">{{ heading() }}</h1>
        <span data-testid="welcome-line">{{ line() }}</span>
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
