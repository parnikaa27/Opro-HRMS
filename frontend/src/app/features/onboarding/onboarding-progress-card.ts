import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Onboarding } from '../../models/onboarding';
import { Avatar } from '../../shared/ui/avatar';
import { formatShortDate, maldivesToday } from '../../shared/utils/date-time';
import { valueOr } from '../../shared/utils/resource';
import { OnboardingApi, progress } from './onboarding-api';

// On HR's overview: everyone still onboarding, how far they've got, and what's overdue.
@Component({
  selector: 'app-onboarding-progress-card',
  imports: [Avatar, RouterLink],
  template: `
    @if (joiners().length) {
      <section class="card card-pad to-collect" data-testid="onboarding-progress-card">
        <div class="card-heading"><div><span class="eyebrow">ONBOARDING</span><h2>New joiners</h2></div><span class="alert-count">{{ joiners().length }}</span></div>
        @for (joiner of joiners(); track joiner.employeeId) {
          <a class="visa-alert" [routerLink]="['/hr/people', joiner.employeeId]" data-testid="joiner-progress">
            <app-avatar [name]="joiner.employeeName" />
            <div>
              <strong>{{ joiner.employeeName }}</strong>
              <span>Joined {{ formatShortDate(joiner.startsOn) }} · {{ progress(joiner) }}{{ overdue(joiner) ? ' · ' + overdue(joiner) + ' overdue' : '' }}</span>
            </div>
          </a>
        }
      </section>
    }
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnboardingProgressCard {
  private readonly inProgress = inject(OnboardingApi).inProgress();
  private readonly today = maldivesToday();
  protected readonly joiners = computed(() => valueOr(this.inProgress, []));
  protected readonly progress = progress;
  protected readonly formatShortDate = formatShortDate;
  protected readonly overdue = ({ items }: Onboarding) => items.filter(({ doneOn, dueOn }) => !doneOn && dueOn < this.today).length;
}
