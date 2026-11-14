import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-modal-heading',
  template: `
    <span class="eyebrow">{{ eyebrow() }}</span>
    <h2>{{ heading() }}</h2>
    <p class="modal-intro">{{ intro() }}</p>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalHeading {
  readonly eyebrow = input.required<string>();
  readonly heading = input.required<string>();
  readonly intro = input.required<string>();
}
