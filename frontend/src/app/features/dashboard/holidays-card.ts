import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Card } from '../../shared/ui/card';
import { Icon } from '../../shared/ui/icon';
import { StatusPill } from '../../shared/ui/status-pill';
import { daysUntil, formatShortDate, maldivesToday, yearOf } from '../../shared/utils/date-time';
import { plural } from '../../shared/utils/text';
import { HolidaysApi } from '../holidays/holidays-api';
import { valueOr } from '../../shared/utils/resource';

const UPCOMING_COUNT = 3;

@Component({
  selector: 'app-holidays-card',
  imports: [Card, StatusPill, RouterLink, Icon],
  template: `
    <app-card label="Coming up" [isLoading]="isLoading()" [hasError]="hasError()">
      <ul class="mt-3 grid gap-4 sm:grid-cols-3">
        @for (holiday of upcoming(); track holiday.date) {
          <li class="sm:border-s sm:border-line sm:ps-4 sm:first:border-s-0 sm:first:ps-0" data-testid="upcoming-holiday">
            <p class="flex items-baseline gap-1.5">
              <span class="font-display text-3xl">{{ formatShortDate(holiday.date).split(' ')[0] }}</span>
              <span class="text-sm text-soft">{{ formatShortDate(holiday.date).split(' ')[1] }}</span>
            </p>
            <p class="mt-1 text-sm font-medium">{{ holiday.name }}</p>
            <p class="mt-1 flex flex-wrap items-center gap-2 text-xs text-soft">
              in {{ plural(daysUntil(holiday.date, today), 'day') }}
              @if (holiday.isTentative) {
                <app-status-pill tone="sea">Tentative</app-status-pill>
              }
            </p>
          </li>
        } @empty {
          <li class="text-sm text-soft">No more holidays on the calendar yet.</li>
        }
      </ul>
      <a routerLink="/holidays" class="mt-5 inline-flex items-center gap-1 text-sm font-medium text-sea hover:underline">
        All holidays <app-icon name="arrow" class="size-4" />
      </a>
    </app-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HolidaysCard {
  private readonly api = inject(HolidaysApi);
  protected readonly today = maldivesToday();
  private readonly year = yearOf(this.today);

  private readonly thisYear = this.api.forYear(() => String(this.year));
  private readonly nextYear = this.api.forYear(() => String(this.year + 1));

  protected readonly isLoading = computed(() => this.thisYear.isLoading() || this.nextYear.isLoading());
  protected readonly hasError = computed(() => !!this.thisYear.error() || !!this.nextYear.error());
  protected readonly upcoming = computed(() =>
    [...valueOr(this.thisYear, []), ...valueOr(this.nextYear, [])].filter((holiday) => holiday.date >= this.today).slice(0, UPCOMING_COUNT),
  );

  protected readonly formatShortDate = formatShortDate;
  protected readonly daysUntil = daysUntil;
  protected readonly plural = plural;
}
