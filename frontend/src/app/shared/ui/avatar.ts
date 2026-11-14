import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const INITIALS = 2;

@Component({
  selector: 'app-avatar',
  template: `{{ initials() }}`,
  host: {
    class: 'inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-coral-soft text-xs font-medium text-coral select-none',
    'aria-hidden': 'true',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Avatar {
  readonly name = input.required<string>();
  protected readonly initials = computed(() =>
    this.name()
      .split(/\s+/)
      .slice(0, INITIALS)
      .map((part) => part.charAt(0).toUpperCase())
      .join(''),
  );
}
