import { Directive, ElementRef, inject, output } from '@angular/core';

// Tells a popover's owner to close when the user clicks elsewhere or presses Escape.
@Directive({
  selector: '[appDismiss]',
  host: {
    '(document:click)': 'onClick($event)',
    '(document:keydown.escape)': 'dismissed.emit()',
  },
})
export class Dismiss {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly dismissed = output({ alias: 'appDismiss' });

  protected onClick(event: MouseEvent) {
    if (event.target instanceof Node && !this.host.nativeElement.contains(event.target)) {
      this.dismissed.emit();
    }
  }
}
