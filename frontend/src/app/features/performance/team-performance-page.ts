import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { TeamMemberPerformance } from '../../models/performance';
import { Avatar } from '../../shared/ui/avatar';
import { Dialog } from '../../shared/ui/dialog';
import { ListSkeleton } from '../../shared/ui/list-skeleton';
import { StatusPill, Tone } from '../../shared/ui/status-pill';
import { formatFullDate, formatShortDate } from '../../shared/utils/date-time';
import { valueOr } from '../../shared/utils/resource';
import { AppraisalForm } from './forms/appraisal-form';
import { PlanDecisionForm } from './forms/plan-decision-form';
import { ProbationReviewForm } from './forms/probation-review-form';
import { PerformanceApi, PerformanceScope, RATINGS } from './performance-api';
import { PlanView } from './plan-view';

type Tab = 'approve' | 'appraise' | 'waiting' | 'done';
type Open = { kind: 'plan' | 'view' | 'appraise' | 'probation'; person: TeamMemberPerformance } | undefined;

// Which list a person sits in: what the HOD has to do for them, if anything.
const tabOf = ({ form, appraisal }: TeamMemberPerformance): Tab => {
  if (appraisal) {
    return 'done';
  }
  return form?.status === 'submitted' ? 'approve' : form?.status === 'approved' ? 'appraise' : 'waiting';
};

// Where one person stands, in words, with a tone for the pill.
const standing = ({ form, appraisal }: TeamMemberPerformance): { text: string; tone: Tone } => {
  if (appraisal) {
    return appraisal.acceptedOn
      ? { text: `Rated ${appraisal.rating}, accepted ${formatShortDate(appraisal.acceptedOn)}`, tone: 'ok' }
      : { text: `Rated ${appraisal.rating}, not accepted yet`, tone: 'late' };
  }
  switch (form?.status) {
    case 'submitted':
      return { text: `Sent ${formatShortDate(form.submittedOn ?? '')}`, tone: 'late' };
    case 'hod-approved':
      return { text: 'With HR', tone: 'neutral' };
    case 'approved':
      return { text: 'Plan approved', tone: 'ok' };
    case 'rejected':
      return { text: `Sent back ${formatShortDate(form.decidedOn ?? '')}`, tone: 'danger' };
    default:
      return { text: 'Not sent yet', tone: 'neutral' };
  }
};

// The HOD's view, and a super admin's across Opro when an HOD is away: probation reviews coming up, then everyone in the
// open cycle sorted by what's needed: plans to approve, people to appraise, those waiting on someone else, and done.
@Component({
  selector: 'app-team-performance-page',
  imports: [AppraisalForm, Avatar, Dialog, ListSkeleton, PlanDecisionForm, PlanView, ProbationReviewForm, StatusPill],
  template: `
    <div class="page-view">
      <div class="page-title">
        <div>
          <span class="eyebrow">{{ scope() === 'company' ? 'Across Opro' : 'Team management' }}</span>
          <h1>Performance</h1>
          <p>{{ intro() }}</p>
        </div>
      </div>
      @if (team.error()) {
        <p class="attendance-off">Performance didn't load. Refresh the page to try again.</p>
      } @else if (team.isLoading() && people().length === 0) {
        <app-list-skeleton [count]="4" />
      } @else {
        @if (cycle()) {
          <ol class="plan-steps" aria-label="How an appraisal goes">
            <li><span class="plan-number" aria-hidden="true">1</span>They send their plan</li>
            <li><span class="plan-number" aria-hidden="true">2</span>{{ scope() === 'company' ? 'Their HOD or you approve it' : 'You approve it' }}, then HR</li>
            <li><span class="plan-number" aria-hidden="true">3</span>{{ scope() === 'company' ? 'Their HOD or you appraise' : 'You appraise them' }}</li>
            <li><span class="plan-number" aria-hidden="true">4</span>They accept the rating</li>
          </ol>
        }
        @if (onProbation().length) {
          <section class="card all-requests" data-testid="probation-card">
            <div class="card-heading"><div><span class="eyebrow">Probation</span><h2>Reviews to do</h2></div></div>
            @for (person of onProbation(); track person.employeeId) {
              <div class="large-request plan-row" data-testid="probation-row">
                <app-avatar [name]="person.fullName" />
                <div><strong>{{ person.fullName }}</strong><span>{{ person.designation }}</span></div>
                <div><small>Probation ends</small><strong>{{ formatFullDate(person.probationEndsOn ?? '') }}</strong></div>
                <div class="request-actions labeled">
                  <button type="button" class="approve" (click)="open.set({ kind: 'probation', person })" data-testid="review-probation">Review</button>
                </div>
              </div>
            }
          </section>
        }
        <section class="card all-requests" data-testid="appraisals-card">
          <div class="card-heading"><div><span class="eyebrow">Appraisals</span><h2>{{ cycle()?.name ?? 'No cycle open' }}</h2></div></div>
          <div class="request-tabs" role="tablist" aria-label="Appraisal stage">
            @for (option of tabs(); track option.value) {
              <button type="button" role="tab" [class.active]="tab() === option.value" [attr.aria-selected]="tab() === option.value" (click)="picked.set(option.value)" [attr.data-testid]="'tab-' + option.value">
                {{ option.label }}
                @if (option.count) {
                  <b>{{ option.count }}</b>
                }
              </button>
            }
          </div>
          @for (person of shown(); track person.employeeId) {
            <div class="large-request plan-row" data-testid="team-appraisal-row">
              <app-avatar [name]="person.fullName" />
              <div><strong>{{ person.fullName }}</strong><span>{{ person.designation }}{{ scope() === 'company' && person.managerName ? ', HOD ' + person.managerName : '' }}</span></div>
              <app-status-pill [tone]="standing(person).tone" data-testid="plan-standing">{{ standing(person).text }}</app-status-pill>
              <div class="request-actions labeled">
                @switch (tab()) {
                  @case ('approve') {
                    <button type="button" class="approve" (click)="open.set({ kind: 'plan', person })" data-testid="review-plan">Review plan</button>
                  }
                  @case ('appraise') {
                    <button type="button" class="approve" (click)="open.set({ kind: 'appraise', person })" data-testid="appraise">Appraise</button>
                  }
                  @default {
                    <button type="button" class="secondary-button" (click)="open.set({ kind: 'view', person })" data-testid="view-plan">View plan</button>
                  }
                }
              </div>
            </div>
          } @empty {
            <p class="attendance-off">{{ emptyText() }}</p>
          }
        </section>
      }
    </div>

    <app-dialog [heading]="dialogHeading()" [isOpen]="open() !== undefined" (isOpenChange)="$event || open.set(undefined)">
      @if (open(); as opened) {
        @switch (opened.kind) {
          @case ('plan') {
            <app-plan-decision-form [employeeId]="opened.person.employeeId" [name]="opened.person.fullName" [goals]="opened.person.goals" [entries]="opened.person.entries" [step]="scope()" (decided)="saved()" />
          }
          @case ('view') {
            <app-plan-view [goals]="opened.person.goals" [entries]="opened.person.entries" />
            <div class="modal-actions"><button type="button" class="secondary-button" (click)="open.set(undefined)">Close</button></div>
          }
          @case ('appraise') {
            <app-appraisal-form [employeeId]="opened.person.employeeId" [name]="opened.person.fullName" [goals]="opened.person.goals" [entries]="opened.person.entries" [scope]="scope()" (saved)="saved()" (cancelled)="open.set(undefined)" />
          }
          @case ('probation') {
            <app-probation-review-form [employeeId]="opened.person.employeeId" [name]="opened.person.fullName" [endsOn]="opened.person.probationEndsOn ?? ''" [scope]="scope()" (saved)="saved()" (cancelled)="open.set(undefined)" />
          }
        }
      }
    </app-dialog>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamPerformancePage {
  // Set from route data: team for an HOD, company for a super admin.
  readonly scope = input<PerformanceScope>('team');
  protected readonly team = inject(PerformanceApi).team(() => this.scope());
  protected readonly open = signal<Open>(undefined);
  protected readonly cycle = computed(() => valueOr(this.team, undefined)?.cycle);
  protected readonly people = computed(() => valueOr(this.team, undefined)?.people ?? []);
  private readonly counts = computed(() =>
    this.people().reduce((all, person) => ({ ...all, [tabOf(person)]: all[tabOf(person)] + 1 }), { approve: 0, appraise: 0, waiting: 0, done: 0 }),
  );
  protected readonly tabs = computed(() => [
    { value: 'approve' as const, label: 'Plans to approve', count: this.counts().approve },
    { value: 'appraise' as const, label: 'To appraise', count: this.counts().appraise },
    { value: 'waiting' as const, label: 'Waiting on others', count: this.counts().waiting },
    { value: 'done' as const, label: 'Appraised', count: this.counts().done },
  ]);
  // Opens where there's something to do, and stays on the tab picked even as the list reloads.
  private readonly picked = signal<Tab | undefined>(undefined);
  protected readonly tab = computed<Tab>(() => this.picked() ?? (this.counts().approve ? 'approve' : this.counts().appraise ? 'appraise' : 'waiting'));
  protected readonly shown = computed(() => this.people().filter((person) => tabOf(person) === this.tab()));
  protected readonly emptyText = computed(
    () =>
      ({
        approve: 'No plans waiting for you.',
        appraise: 'Nobody to appraise yet. People appear here once HR approves their plan.',
        waiting: 'Nobody is waiting on someone else.',
        done: 'Nobody appraised yet.',
      })[this.tab()],
  );
  protected readonly onProbation = computed(() =>
    this.people()
      .filter(({ probationEndsOn }) => probationEndsOn !== undefined)
      .sort((first, second) => (first.probationEndsOn ?? '').localeCompare(second.probationEndsOn ?? '')),
  );
  protected readonly intro = computed(() => {
    const cycle = this.cycle();
    if (!cycle) {
      return 'No appraisal cycle is open. HR opens one each year, and you’ll be told when they do.';
    }
    return this.scope() === 'company'
      ? `${cycle.name} is open until ${formatFullDate(cycle.dueOn)}. Step in for an HOD who is away: approve a plan or appraise someone. Never HR’s step.`
      : `${cycle.name} is open until ${formatFullDate(cycle.dueOn)}. Here’s what each of your team needs from you.`;
  });
  protected readonly dialogHeading = computed(
    () => ({ plan: 'Their plan', view: 'Their plan', appraise: 'Appraise', probation: 'Probation review' })[this.open()?.kind ?? 'plan'],
  );
  protected readonly standing = standing;
  protected readonly ratings = RATINGS;
  protected readonly formatFullDate = formatFullDate;

  protected saved() {
    this.open.set(undefined);
    this.team.reload();
  }
}
