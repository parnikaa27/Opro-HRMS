import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Onboarding } from '../../models/onboarding';
import { formatFullDate } from '../../shared/utils/date-time';
import { valueOr } from '../../shared/utils/resource';
import { DecisionState } from '../team/decision-state';
import { TeamApi } from '../team/team-api';
import { OnboardingApi, progress } from './onboarding-api';
import { OnboardingChecklist } from './onboarding-checklist';

// On an HOD's team overview: each report still onboarding, the HOD's tasks to tick, and a buddy to pick.
@Component({
  selector: 'app-team-onboarding-card',
  imports: [OnboardingChecklist],
  template: `
    @if (joiners().length) {
      <section class="card card-pad" data-testid="team-onboarding">
        <div class="card-heading"><div><span class="eyebrow">Onboarding</span><h2>Joining your team</h2></div></div>
        @for (joiner of joiners(); track joiner.employeeId) {
          <div class="onboarding-joiner" data-testid="joiner">
            <div class="card-heading">
              <div><strong>{{ joiner.employeeName }}</strong><span class="card-note"> · {{ joiner.designation }}, joined {{ formatFullDate(joiner.startsOn) }} · {{ progress(joiner) }}</span></div>
              <label class="inline-select">
                <span class="sr-only">{{ joiner.employeeName }}'s buddy</span>
                <select (change)="pickBuddy(joiner, $event)" data-testid="pick-buddy">
                  <option value="" [selected]="!joiner.buddyId">{{ joiner.buddyId ? 'Change buddy' : 'Pick a buddy…' }}</option>
                  @for (person of buddies(joiner); track person.id) {
                    <option [value]="person.id" [selected]="person.id === joiner.buddyId">{{ person.fullName }}</option>
                  }
                </select>
              </label>
            </div>
            <app-onboarding-checklist [employeeId]="joiner.employeeId" [items]="joiner.items" ticks="hod" (changed)="team.reload()" />
            @if (decisions.failedId() === joiner.employeeId) {
              <p class="row-error" role="alert">That buddy didn't save. Try again in a moment.</p>
            }
          </div>
        }
      </section>
    }
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamOnboardingCard {
  private readonly api = inject(OnboardingApi);
  protected readonly team = this.api.team();
  private readonly members = inject(TeamApi).members();
  protected readonly joiners = computed(() => valueOr(this.team, []));
  protected readonly decisions = new DecisionState();
  protected readonly progress = progress;
  protected readonly formatFullDate = formatFullDate;
  // Anyone on the team but the joiner.
  protected readonly buddies = ({ employeeId }: Onboarding) =>
    valueOr(this.members, []).filter(({ id }) => id !== employeeId);

  protected pickBuddy({ employeeId }: Onboarding, event: Event) {
    const buddyId = event.target instanceof HTMLSelectElement ? event.target.value : '';
    return buddyId ? this.decisions.run(employeeId, () => this.api.setBuddy(employeeId, buddyId), () => this.team.reload()) : undefined;
  }
}
