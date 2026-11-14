import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { addMonths, formatMonth } from '../utils/date-time';

@Component({
  selector: 'app-month-switcher',
  template: `
    <div class="flex items-center justify-between gap-3">
      <button type="button" class="btn-quiet" [attr.aria-label]="'Show ' + formatMonth(previous())" (click)="month.set(previous())" data-testid="previous-month">
        ‹ <span class="hidden sm:inline">{{ formatMonth(previous()) }}</span>
      </button>
      <h2 class="font-display text-xl whitespace-nowrap" aria-live="polite" data-testid="month-label">{{ formatMonth(month()) }}</h2>
      <button type="button" class="btn-quiet" [class.invisible]="isAtLatest()" [disabled]="isAtLatest()" [attr.aria-label]="'Show ' + formatMonth(next())" (click)="month.set(next())" data-testid="next-month">
        <span class="hidden sm:inline">{{ formatMonth(next()) }}</span> ›
      </button>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonthSwitcher {
  readonly month = model.required<string>();
  // Leave empty to allow looking ahead without limit, like a leave calendar.
  readonly latest = input<string>();

  protected readonly previous = computed(() => addMonths(this.month(), -1));
  protected readonly next = computed(() => addMonths(this.month(), 1));
  protected readonly isAtLatest = computed(() => {
    const latest = this.latest();
    return latest !== undefined && this.month() >= latest;
  });
  protected readonly formatMonth = formatMonth;
}
