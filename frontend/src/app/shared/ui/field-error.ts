import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-field-error',
  template: `
    @if (message(); as text) {
      <p class="field-error" [id]="id()">{{ text }}</p>
    }
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FieldError {
  readonly id = input.required<string>();
  readonly errors = input.required<readonly { message?: string }[]>();
  readonly isTouched = input.required<boolean>();
  protected readonly message = computed(() => (this.isTouched() ? this.errors()[0]?.message : undefined));
}
