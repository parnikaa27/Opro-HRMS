import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Holiday } from '../../models/company';
import { StatusPill } from '../../shared/ui/status-pill';
import { daysUntil, formatDayShort, formatMonth, maldivesToday, monthOf, yearOf } from '../../shared/utils/date-time';
import { valueOr } from '../../shared/utils/resource';
import { plural } from '../../shared/utils/text';
import { HolidaysApi } from './holidays-api';

// HR publishes one year ahead, so there's nothing useful further out than that.
const YEARS_EITHER_SIDE = 1;

@Component({
  selector: 'app-holidays-page',
  imports: [StatusPill],
  template: `
    <header class="mb-8">
      <h1 class="font-display text-3xl tracking-tight sm:text-4xl">Holidays</h1>
      <p class="mt-2 text-soft">Public holidays in the Maldives. The office is closed on all of them.</p>
    </header>

    <div class="mb-4 flex items-center justify-between gap-3">
      <button type="button" class="btn-quiet" [class.invisible]="!canGoBack()" [disabled]="!canGoBack()" (click)="year.set(year() - 1)" data-testid="previous-year">
        ‹ {{ year() - 1 }}
      </button>
      <h2 class="font-display text-xl" aria-live="polite" data-testid="year-label">{{ year() }}</h2>
      <button type="button" class="btn-quiet" [class.invisible]="!canGoForward()" [disabled]="!canGoForward()" (click)="year.set(year() + 1)" data-testid="next-year">
        {{ year() + 1 }} ›
      </button>
    </div>

    <p class="mb-6 rounded-2xl bg-sea-soft px-4 py-3 text-sm text-sea">
      Islamic holidays follow the moon. Dates marked tentative are confirmed by HR once the moon is sighted, usually a few days before.
    </p>

    @if (holidays.error()) {
      <p class="text-sm text-danger">The holiday calendar didn't load. Refresh the page to try again.</p>
    } @else if (!holidays.isLoading() && list().length === 0) {
      <p class="text-soft" data-testid="holidays-empty">HR hasn't published the holidays for {{ year() }} yet.</p>
    } @else {
      <p class="mb-4 text-sm text-soft" data-testid="holidays-summary">{{ summary() }}</p>
      <div class="space-y-8">
        @for (group of months(); track group.month) {
          <section [attr.aria-labelledby]="'month-' + group.month">
            <h3 class="eyebrow mb-2" [id]="'month-' + group.month">{{ formatMonth(group.month) }}</h3>
            <ul class="divide-y divide-line rounded-2xl border border-line bg-card shadow-lift">
              @for (holiday of group.holidays; track holiday.date) {
                <li
                  class="flex items-center gap-4 px-5 py-3.5"
                  [class.text-soft]="holiday.date < today"
                  [class.bg-sea-soft]="holiday.date === next()?.date"
                  data-testid="holiday"
                >
                  <span class="w-28 shrink-0 text-sm">{{ formatDayShort(holiday.date) }}</span>
                  <span class="min-w-0 flex-1 font-medium" [class.font-normal]="holiday.date < today">{{ holiday.name }}</span>
                  <span class="flex shrink-0 flex-wrap items-center justify-end gap-2 text-xs text-soft">
                    @if (holiday.isTentative && holiday.date >= today) {
                      <app-status-pill tone="sea">Tentative</app-status-pill>
                    }
                    {{ when(holiday) }}
                  </span>
                </li>
              }
            </ul>
          </section>
        }
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HolidaysPage {
  protected readonly today = maldivesToday();
  private readonly thisYear = yearOf(this.today);

  protected readonly year = signal(this.thisYear);
  protected readonly canGoBack = computed(() => this.year() > this.thisYear - YEARS_EITHER_SIDE);
  protected readonly canGoForward = computed(() => this.year() < this.thisYear + YEARS_EITHER_SIDE);

  protected readonly holidays = inject(HolidaysApi).forYear(() => String(this.year()));
  protected readonly list = computed(() => [...valueOr(this.holidays, [])].sort((first, second) => first.date.localeCompare(second.date)));
  protected readonly next = computed(() => this.list().find((holiday) => holiday.date >= this.today));

  protected readonly months = computed(() =>
    this.list().reduce<{ month: string; holidays: Holiday[] }[]>((groups, holiday) => {
      const month = monthOf(holiday.date);
      const last = groups.at(-1);
      return last?.month === month
        ? [...groups.slice(0, -1), { month, holidays: [...last.holidays, holiday] }]
        : [...groups, { month, holidays: [holiday] }];
    }, []),
  );

  protected readonly summary = computed(() => {
    const total = plural(this.list().length, 'public holiday');
    if (this.year() !== this.thisYear) {
      return `${total} in ${this.year()}.`;
    }
    const ahead = this.list().filter((holiday) => holiday.date >= this.today).length;
    return `${total} this year, ${ahead} still to come.`;
  });

  protected readonly when = ({ date }: Holiday) => {
    const days = daysUntil(date, this.today);
    return days === 0 ? 'Today' : days > 0 ? `in ${plural(days, 'day')}` : '';
  };

  protected readonly formatMonth = formatMonth;
  protected readonly formatDayShort = formatDayShort;
}
