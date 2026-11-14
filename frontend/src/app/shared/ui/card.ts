import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-card',
  template: `
    <section class="h-full rounded-2xl border border-line bg-card p-5 shadow-lift" [attr.aria-busy]="isLoading()">
      <header class="flex min-h-6 items-center justify-between gap-3">
        <h2 class="eyebrow">{{ label() }}</h2>
        <ng-content select="[cardAside]" />
      </header>
      @if (hasError()) {
        <p class="mt-4 text-sm text-danger" data-testid="card-error">This didn't load. Refresh the page to try again.</p>
      } @else if (isLoading()) {
        <div class="mt-4 space-y-3" data-testid="card-loading">
          <div class="h-7 w-2/3 animate-pulse rounded-md bg-line"></div>
          <div class="h-4 w-1/2 animate-pulse rounded-md bg-line"></div>
        </div>
      } @else {
        <ng-content />
      }
    </section>
  `,
  host: { class: 'block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Card {
  readonly label = input.required<string>();
  readonly isLoading = input(false);
  readonly hasError = input(false);
}
