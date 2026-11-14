import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-logo',
  template: `
    <div class="logo-wrap">
      <div class="logo-mark" aria-hidden="true"><span>O</span><i></i></div>
      @if (!isCompact()) {
        <span class="logo-word">opro</span>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Logo {
  readonly isCompact = input(false);
}
