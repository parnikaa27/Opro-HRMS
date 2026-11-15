import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';

// Destructive actions ask once, inline, instead of a modal on top of a modal.
@Component({
  selector: 'app-confirm-button',
  template: `
    @if (isAsking()) {
      <span class="row-actions" role="group" [attr.aria-label]="question()">
        {{ question() }}
        <button type="button" class="text-link danger" (click)="isAsking.set(false); confirmed.emit()" data-testid="confirm-yes">{{ yes() }}</button>
        <button type="button" class="text-link" (click)="isAsking.set(false)">Keep it</button>
      </span>
    } @else {
      <button type="button" class="text-link" (click)="isAsking.set(true)" [attr.data-testid]="testId()">{{ label() }}</button>
    }
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmButton {
  readonly label = input.required<string>();
  readonly question = input.required<string>();
  readonly yes = input('Yes, delete it');
  readonly testId = input('delete');
  readonly confirmed = output();
  protected readonly isAsking = signal(false);
}
