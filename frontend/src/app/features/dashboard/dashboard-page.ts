import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Session } from '../../core/session';
import { formatLongDate, maldivesHour, maldivesToday } from '../../shared/utils/date-time';
import { AnnouncementsCard } from './announcements-card';
import { AttentionCard } from './attention-card';
import { HolidaysCard } from './holidays-card';
import { LeaveCard } from './leave-card';
import { TodayCard } from './today-card';

const NOON = 12;
const EVENING = 17;

export const greetingFor = (hour: number) => (hour < NOON ? 'Morning' : hour < EVENING ? 'Afternoon' : 'Evening');

@Component({
  selector: 'app-dashboard-page',
  imports: [TodayCard, LeaveCard, AttentionCard, HolidaysCard, AnnouncementsCard],
  template: `
    <header class="mb-8">
      <h1 class="font-display text-3xl tracking-tight sm:text-4xl" data-testid="greeting">{{ greeting }}, {{ firstName() }}.</h1>
      <p class="mt-2 text-soft">{{ longDate }}</p>
    </header>

    <div class="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <app-today-card />
      <app-leave-card />
    </div>
    <div class="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
      <app-attention-card />
      <app-holidays-card />
    </div>
    <app-announcements-card class="mt-4" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  private readonly session = inject(Session);

  protected readonly greeting = greetingFor(maldivesHour());
  protected readonly longDate = formatLongDate(maldivesToday());
  protected readonly firstName = computed(() => this.session.user()?.fullName.split(' ')[0] ?? '');
}
