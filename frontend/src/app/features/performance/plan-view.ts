import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Goal, PlanEntry } from '../../models/performance';
import { formatFullDate } from '../../shared/utils/date-time';
import { SectionKey, SECTIONS } from './plan-sections';

// Someone's plan, read only and numbered like their own page: for their HOD, HR and a super admin.
@Component({
  selector: 'app-plan-view',
  template: `
    <ol class="plan-view" data-testid="plan-view">
      @for (section of sections(); track section.key) {
        <li data-testid="plan-view-section">
          <h3><span class="plan-number" aria-hidden="true">{{ section.number }}</span>{{ section.title }}</h3>
          @if (section.key === 'goals') {
            @for (goal of goals(); track goal.id) {
              <div class="plan-entry"><strong>{{ goal.title }}</strong><span>{{ goal.measure }} · {{ goal.weight }}%</span></div>
            } @empty {
              <p class="card-note">No goals yet.</p>
            }
          } @else {
            @for (entry of entriesFor(section.key); track entry.id) {
              <div class="plan-entry">
                <strong>{{ entry.title }}</strong>
                @if (entry.details || entry.targetOn) {
                  <span>{{ entry.details }}{{ entry.details && entry.targetOn ? ' · ' : '' }}{{ entry.targetOn ? 'By ' + formatFullDate(entry.targetOn) : '' }}</span>
                }
              </div>
            } @empty {
              <p class="card-note">Nothing added.</p>
            }
          }
        </li>
      }
    </ol>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanView {
  readonly goals = input<readonly Goal[]>([]);
  readonly entries = input<readonly PlanEntry[]>([]);
  // The appraisal rates goals itself, so it shows only the other four.
  readonly hasGoals = input(true);
  // Just one section, as the person's own page shows it once the plan is sent.
  readonly only = input<SectionKey>();

  // Each keeps its number from the person's page, whichever are shown.
  protected readonly sections = computed(() => {
    const only = this.only();
    return SECTIONS.map((section, index) => ({ ...section, number: index + 1 })).filter(({ key }) => (only ? key === only : this.hasGoals() || key !== 'goals'));
  });
  protected readonly entriesFor = (key: string) => this.entries().filter(({ section }) => section === key);
  protected readonly formatFullDate = formatFullDate;
}
