import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CompanyApi } from '../../core/company-api';
import { Card } from '../../shared/ui/card';
import { formatShortDate } from '../../shared/utils/date-time';
import { valueOr } from '../../shared/utils/resource';

@Component({
  selector: 'app-announcements-card',
  imports: [Card],
  template: `
    <app-card label="From HR" [isLoading]="announcements.isLoading()" [hasError]="!!announcements.error()">
      <ul class="mt-3 grid gap-5 md:grid-cols-3">
        @for (item of items(); track item.id) {
          <li>
            <article>
              <p class="text-xs text-soft">{{ formatShortDate(item.publishedOn) }}</p>
              <h3 class="mt-1 font-medium">{{ item.title }}</h3>
              <p class="mt-1 text-sm leading-relaxed text-soft">{{ item.body }}</p>
            </article>
          </li>
        } @empty {
          <li class="text-sm text-soft">No news from HR right now.</li>
        }
      </ul>
    </app-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnnouncementsCard {
  protected readonly announcements = inject(CompanyApi).announcements();
  protected readonly items = computed(() => valueOr(this.announcements, []));
  protected readonly formatShortDate = formatShortDate;
}
