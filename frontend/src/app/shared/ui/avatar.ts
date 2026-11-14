import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { initialsOf } from '../utils/initials';

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
  protected readonly initials = computed(() => initialsOf(this.name()));
}
