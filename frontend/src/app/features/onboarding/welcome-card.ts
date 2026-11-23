import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { formatFullDate, formatTimeOfDay } from '../../shared/utils/date-time';
import { valueOr } from '../../shared/utils/resource';
import { OnboardingApi, progress } from './onboarding-api';
import { OnboardingChecklist } from './onboarding-checklist';

// On a new joiner's Overview until their onboarding is done: their first day, HOD and buddy, and every task.
@Component({
  selector: 'app-welcome-card',
  imports: [OnboardingChecklist],
  template: `
    @if (onboarding(); as current) {
      <section class="card card-pad" data-testid="welcome-card">
        <div class="card-heading">
          <div><span class="eyebrow">Welcome to Opro</span><h2>Your first weeks</h2></div>
          <span class="card-note" data-testid="onboarding-progress">{{ progress(current) }}</span>
        </div>
        @if (current.firstDayPlace || current.firstDayTime) {
          <p class="card-text" data-testid="first-day">
            First day, {{ formatFullDate(current.startsOn) }}{{ current.firstDayTime ? ' at ' + formatTimeOfDay(current.firstDayTime) : '' }}{{ current.firstDayPlace ? ', ' + current.firstDayPlace : '' }}.{{ current.firstDayContact ? ' Ask for ' + current.firstDayContact + '.' : '' }}
          </p>
        }
        <p class="card-note" data-testid="welcome-people">
          {{ current.hodName ? 'Your HOD is ' + current.hodName + '.' : '' }} {{ current.buddyName ? current.buddyName + ' is your buddy: ask them anything.' : '' }}
        </p>
        <app-onboarding-checklist [employeeId]="current.employeeId" [items]="current.items" ticks="joiner" (changed)="mine.reload()" />
      </section>
    }
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WelcomeCard {
  protected readonly mine = inject(OnboardingApi).mine();
  // Only while there's something left to do.
  protected readonly onboarding = computed(() => {
    const current = valueOr(this.mine, null);
    return current && !current.completedOn ? current : undefined;
  });
  protected readonly progress = progress;
  protected readonly formatFullDate = formatFullDate;
  protected readonly formatTimeOfDay = formatTimeOfDay;
}
