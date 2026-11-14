import { ChangeDetectionStrategy, Component, effect, ElementRef, input, model, viewChild } from '@angular/core';
import { Icon } from './icon';

// The design's modal, on a native <dialog> so focus, Escape and the backdrop come for free.
@Component({
  selector: 'app-dialog',
  imports: [Icon],
  template: `
    <dialog #dialog class="modal" [attr.aria-label]="heading()" (close)="isOpen.set(false)">
      <button type="button" class="modal-close" aria-label="Close" (click)="isOpen.set(false)"><app-icon name="x" /></button>
      @if (isOpen()) {
        <ng-content />
      }
    </dialog>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dialog {
  readonly heading = input.required<string>();
  readonly isOpen = model(false);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const element = this.dialog().nativeElement;
      if (this.isOpen() && !element.open) {
        element.showModal();
      } else if (!this.isOpen() && element.open) {
        element.close();
      }
    });
  }
}
