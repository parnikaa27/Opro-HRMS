import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { initialsOf } from '../utils/initials';

// The design gives each person a soft colour. Picking it from the name keeps it stable everywhere.
const COLOURS = ['', 'blue', 'pink', 'amber', 'aqua'];

const colourFor = (name: string) => COLOURS[[...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % COLOURS.length];

@Component({
  selector: 'app-avatar',
  template: `{{ initials() }}`,
  host: {
    '[class]': 'classes()',
    'aria-hidden': 'true',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Avatar {
  readonly name = input.required<string>();
  readonly isLarge = input(false);
  protected readonly initials = computed(() => initialsOf(this.name()));
  protected readonly classes = computed(() => ['avatar', colourFor(this.name()), this.isLarge() ? 'large' : ''].filter(Boolean).join(' '));
}
