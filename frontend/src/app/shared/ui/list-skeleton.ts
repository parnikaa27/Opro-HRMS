import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const DEFAULT_ROWS = 3;

@Component({
  selector: 'app-list-skeleton',
  template: `
    <ul class="divide-y divide-line rounded-2xl border border-line bg-card shadow-lift" aria-busy="true" aria-label="Loading" data-testid="list-loading">
      @for (row of rows(); track $index) {
        <li class="flex items-center gap-3 px-5 py-4">
          <span class="h-4 w-1/3 animate-pulse rounded-md bg-line"></span>
          <span class="ms-auto h-4 w-16 animate-pulse rounded-md bg-line"></span>
        </li>
      }
    </ul>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListSkeleton {
  readonly count = input(DEFAULT_ROWS);
  protected readonly rows = computed(() => Array.from({ length: this.count() }));
}
