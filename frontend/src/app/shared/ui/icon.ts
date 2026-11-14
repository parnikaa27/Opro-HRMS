import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ICON_SHAPES, IconShape } from './icon-shapes';

export type IconName = keyof typeof ICON_SHAPES;

const DEFAULT_SIZE = 20;
const DEFAULT_STROKE = 2;

@Component({
  selector: 'app-icon',
  template: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" [attr.stroke-width]="strokeWidth()" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" width="100%" height="100%">
      @for (shape of shapes(); track $index) {
        @switch (shape[0]) {
          @case ('path') {
            <svg:path [attr.d]="shape[1]['d']" />
          }
          @case ('circle') {
            <svg:circle [attr.cx]="shape[1]['cx']" [attr.cy]="shape[1]['cy']" [attr.r]="shape[1]['r']" />
          }
          @case ('rect') {
            <svg:rect [attr.x]="shape[1]['x']" [attr.y]="shape[1]['y']" [attr.width]="shape[1]['width']" [attr.height]="shape[1]['height']" [attr.rx]="shape[1]['rx']" />
          }
          @case ('line') {
            <svg:line [attr.x1]="shape[1]['x1']" [attr.y1]="shape[1]['y1']" [attr.x2]="shape[1]['x2']" [attr.y2]="shape[1]['y2']" />
          }
        }
      }
    </svg>
  `,
  host: {
    class: 'inline-block shrink-0 align-middle',
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input(DEFAULT_SIZE);
  readonly strokeWidth = input(DEFAULT_STROKE);
  protected readonly shapes = computed<readonly IconShape[]>(() => ICON_SHAPES[this.name()]);
}
