import { ChangeDetectionStrategy, Component, effect, ElementRef, input, model, viewChild } from '@angular/core';

@Component({
  selector: 'app-dialog',
  template: `
    <dialog
      #dialog
      class="m-auto w-full max-w-lg rounded-2xl border border-line bg-card p-0 text-ink shadow-lift backdrop:bg-ink/40 max-sm:mb-0 max-sm:max-w-none max-sm:rounded-b-none"
      [attr.aria-label]="heading()"
      (close)="isOpen.set(false)"
    >
      <div class="p-6">
        <header class="mb-5 flex items-start justify-between gap-4">
          <h2 class="font-display text-2xl">{{ heading() }}</h2>
          <button type="button" class="btn-quiet -me-2 -mt-1 px-3" (click)="isOpen.set(false)">Close</button>
        </header>
        @if (isOpen()) {
          <ng-content />
        }
      </div>
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
