import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { initialsOf } from '../utils/initials';

@Component({
  selector: 'app-avatar',
  template: `{{ initials() }}`,
  host: {
    class: 'inline-flex shrink-0 items-center justify-center rounded-full bg-coral-soft font-medium text-coral select-none',
    '[class]': "isLarge() ? 'size-14 text-base' : 'size-9 text-xs'",
    'aria-hidden': 'true',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Avatar {
  readonly name = input.required<string>();
  readonly isLarge = input(false);
  protected readonly initials = computed(() => initialsOf(this.name()));
}
