import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

// Temporary stand in for pages still being built. Delete once every route has its real page.
@Component({
  selector: 'app-not-built-page',
  imports: [RouterLink],
  template: `
    <h1 class="font-display text-3xl">{{ heading }}</h1>
    <p class="mt-3 max-w-md text-soft">This page is next on the list. Until then, Home has the essentials.</p>
    <a routerLink="/" class="mt-6 inline-block font-medium text-sea underline-offset-4 hover:underline">Back to Home</a>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotBuiltPage {
  protected readonly heading = inject(ActivatedRoute).snapshot.title?.split(' · ')[0];
}
