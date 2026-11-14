import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { initialsOf } from '../utils/initials';

// The design gives each person a soft colour. Picking it from the name keeps it stable everywhere.
const COLOURS = ['', 'blue', 'pink', 'amber', 'aqua'];

const colourFor = (name: string) => COLOURS[[...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % COLOURS.length];

@Component({
  selector: 'app-avatar',
  imports: [NgOptimizedImage],
  template: `
    @if (photoUrl(); as photo) {
      <img [ngSrc]="photo" width="96" height="96" alt="" />
    } @else {
      {{ initials() }}
    }
  `,
  host: {
    '[class]': 'classes()',
    'aria-hidden': 'true',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Avatar {
  readonly name = input.required<string>();
  readonly isLarge = input(false);
  readonly photoUrl = input<string>();
  protected readonly initials = computed(() => initialsOf(this.name()));
  protected readonly classes = computed(() => ['avatar', colourFor(this.name()), this.isLarge() ? 'large' : ''].filter(Boolean).join(' '));
}
