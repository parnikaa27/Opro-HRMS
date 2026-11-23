import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Appraisal } from '../../models/performance';
import { Dialog } from '../../shared/ui/dialog';
import { ListSkeleton } from '../../shared/ui/list-skeleton';
import { StatusPill, Tone } from '../../shared/ui/status-pill';
import { formatFullDate, formatShortDate } from '../../shared/utils/date-time';
import { serverReason } from '../../shared/utils/form-submit';
import { valueOr } from '../../shared/utils/resource';
import { plural } from '../../shared/utils/text';
import { DecisionState } from '../team/decision-state';
import { EntriesForm } from './forms/entries-form';
import { GoalsForm } from './forms/goals-form';
import { OUTCOMES, PerformanceApi, PLAN_STATUS, RATINGS } from './performance-api';
import { entriesIn, SectionKey, sectionInfo, SECTIONS } from './plan-sections';
import { PlanView } from './plan-view';

const STATUS_TONE: Record<string, Tone> = { approved: 'ok', rejected: 'danger', draft: 'neutral' };
const FULL_WEIGHT = 100;
const SEND_FAILED = "That didn't send. Try again in a moment.";

// Your plan for the open cycle in five numbered sections, each opened on its own, sent to your HOD in one go. Then your
// appraisals to accept, and any probation review.
@Component({
  selector: 'app-my-performance-page',
  imports: [Dialog, EntriesForm, GoalsForm, ListSkeleton, PlanView, StatusPill],
  template: `
    <div class="page-view">
      <div class="page-title">
        <div>
          <span class="eyebrow">My growth</span>
          <h1>Performance</h1>
          <p>Your plan for the year has five parts. Open each one to add what fits, then send the whole plan to your HOD.</p>
        </div>
      </div>
      @if (mine.error()) {
        <p class="attendance-off">Your performance didn't load. Refresh the page to try again.</p>
      } @else if (mine.isLoading() && !performance()) {
        <app-list-skeleton [count]="3" />
      } @else {
        @if (performance()?.cycle; as cycle) {
          <section class="card card-pad plan-status" data-testid="plan-status">
            <div class="card-heading">
              <div><span class="eyebrow">{{ cycle.name }}</span><h2>Your plan</h2></div>
              <app-status-pill [tone]="statusTone()" data-testid="plan-status-pill">{{ statusText() }}</app-status-pill>
            </div>
            <p class="card-text" data-testid="plan-next">{{ nextStep() }}</p>
            @if (form()?.status === 'rejected' && form()?.note) {
              <p class="card-note" data-testid="plan-note-shown">{{ form()?.decidedByName }} sent it back: “{{ form()?.note }}”</p>
            }
            @if (canEdit()) {
              <div class="plan-send">
                <button type="button" class="primary-button" [disabled]="!hasGoals() || isSending()" (click)="send()" data-testid="send-plan">Send to my HOD</button>
                <small>{{ hasGoals() ? 'Once sent, it stays as it is unless it comes back to you.' : 'Add your goals first. The other sections can wait.' }}</small>
              </div>
            }
            @if (sendFailure()) {
              <p class="row-error" role="alert">{{ sendFailure() }}</p>
            }
          </section>

          <ol class="plan-sections" aria-label="Your plan">
            @for (section of sections; track section.key; let index = $index) {
              <li>
                <button type="button" class="plan-tile" (click)="opened.set(section.key)" [attr.data-testid]="'plan-tile-' + section.key">
                  <span class="plan-number" aria-hidden="true">{{ index + 1 }}</span>
                  <span class="plan-tile-text">
                    <strong>{{ section.title }}</strong>
                    <small>{{ section.ask }}</small>
                    <span class="plan-count" data-testid="plan-count">{{ countLine(section.key) }}</span>
                  </span>
                  <span class="plan-action">{{ actionFor(section.key) }}</span>
                </button>
              </li>
            }
          </ol>
        } @else {
          <p class="attendance-off">No appraisal cycle is open right now. HR opens one each year, and you'll be told.</p>
        }
        @for (appraisal of performance()?.appraisals; track appraisal.id) {
          <section class="card card-pad" [class.needs-you]="!appraisal.acceptedOn" data-testid="my-appraisal">
            <div class="card-heading">
              <div><span class="eyebrow">{{ appraisal.cycleName }}</span><h2>{{ appraisal.rating }}, {{ ratings[appraisal.rating] }}</h2></div>
              @if (appraisal.acceptedOn) {
                <span class="card-note">Accepted on {{ formatFullDate(appraisal.acceptedOn) }}</span>
              } @else {
                <button type="button" class="primary-button compact" [disabled]="decisions.busyId() === appraisal.id" (click)="accept(appraisal)" data-testid="accept-rating">Accept my rating</button>
              }
            </div>
            @if (!appraisal.acceptedOn) {
              <p class="card-note" data-testid="accept-needed">Read it, then accept your rating. That's how your appraisal is finished.</p>
            }
            <p class="card-text">“{{ appraisal.comments }}” {{ appraisal.appraisedByName }}, {{ formatFullDate(appraisal.appraisedOn) }}</p>
            @for (goal of appraisal.goals; track goal.id) {
              <div class="goal-line"><strong>{{ goal.title }}</strong><span>{{ goal.rating }}, {{ ratings[goal.rating ?? 0] }}{{ goal.comment ? ' · ' + goal.comment : '' }}</span></div>
            }
            @if (appraisal.selfReviewComment) {
              <p class="card-text" data-testid="self-review-comment-shown">On your plan: “{{ appraisal.selfReviewComment }}”</p>
            }
            @if (decisions.failedId() === appraisal.id) {
              <p class="row-error" role="alert">That didn't save. Try again in a moment.</p>
            }
          </section>
        }
        @for (review of performance()?.probationReviews; track review.id) {
          <section class="card card-pad" data-testid="my-probation">
            <div class="card-heading"><div><span class="eyebrow">Probation</span><h2>{{ outcomes[review.outcome] }}{{ review.extendedTo ? ' until ' + formatFullDate(review.extendedTo) : '' }}</h2></div></div>
            <p class="card-text">“{{ review.comments }}” {{ review.reviewedByName }}, {{ formatFullDate(review.reviewedOn) }}</p>
          </section>
        }
      }
    </div>

    <app-dialog [heading]="dialogHeading()" [isOpen]="opened() !== undefined" (isOpenChange)="$event || opened.set(undefined)">
      @if (opened(); as key) {
        @if (!canEdit()) {
          <app-plan-view [goals]="performance()?.goals ?? []" [entries]="performance()?.entries ?? []" [only]="key" />
          <div class="modal-actions"><button type="button" class="secondary-button" (click)="opened.set(undefined)">Close</button></div>
        } @else if (key === 'goals') {
          <app-goals-form [goals]="performance()?.goals ?? []" (saved)="saved()" (cancelled)="opened.set(undefined)" />
        } @else {
          <app-entries-form [section]="key" [entries]="performance()?.entries ?? []" (saved)="saved()" (cancelled)="opened.set(undefined)" />
        }
      }
    </app-dialog>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyPerformancePage {
  private readonly api = inject(PerformanceApi);
  protected readonly mine = this.api.mine();
  protected readonly performance = computed(() => valueOr(this.mine, undefined));
  protected readonly form = computed(() => this.performance()?.form);
  private readonly status = computed(() => this.form()?.status ?? 'draft');
  private readonly isAppraised = computed(() => this.performance()?.appraisals.some(({ cycleId }) => cycleId === this.performance()?.cycle?.id) ?? false);
  protected readonly canEdit = computed(() => ['draft', 'rejected'].includes(this.status()) && !this.isAppraised());
  protected readonly hasGoals = computed(() => (this.performance()?.goals.length ?? 0) > 0);
  protected readonly statusText = computed(() => (this.isAppraised() ? 'Appraised' : PLAN_STATUS[this.status()]));
  protected readonly statusTone = computed(() => (this.isAppraised() ? 'ok' : (STATUS_TONE[this.status()] ?? 'late')));
  // What happens next, in one line, so nobody has to work it out from the pill.
  protected readonly nextStep = computed(() => {
    const form = this.form();
    const due = this.performance()?.cycle?.dueOn;
    if (this.isAppraised()) {
      return 'Your HOD has appraised you. Read it below and accept your rating.';
    }
    switch (form?.status) {
      case 'submitted':
        return `Sent on ${formatShortDate(form.submittedOn ?? '')}. Your HOD approves it, then HR.`;
      case 'hod-approved':
        return `${form.hodApprovedByName} approved it on ${formatShortDate(form.hodApprovedOn ?? '')}. It's with HR now.`;
      case 'approved':
        // Plans approved before approvers were recorded have no name.
        return `Approved${form.decidedByName ? ` by ${form.decidedByName}` : ''}${form.decidedOn ? ` on ${formatShortDate(form.decidedOn)}` : ''}. Your HOD appraises you against it at the end of the cycle.`;
      case 'rejected':
        return 'Change what was asked, then send it again.';
      default:
        return `Fill in each section, then send it to your HOD${due ? ` before ${formatFullDate(due)}` : ''}.`;
    }
  });
  protected readonly opened = signal<SectionKey | undefined>(undefined);
  protected readonly dialogHeading = computed(() => sectionInfo(this.opened() ?? 'goals').title);
  protected readonly isSending = signal(false);
  protected readonly sendFailure = signal<string | undefined>(undefined);
  protected readonly decisions = new DecisionState();
  protected readonly sections = SECTIONS;
  protected readonly ratings = RATINGS;
  protected readonly outcomes = OUTCOMES;
  protected readonly formatFullDate = formatFullDate;

  protected countLine(key: SectionKey) {
    const performance = this.performance();
    const titles = entriesIn(key, performance?.goals ?? [], performance?.entries ?? []);
    if (!titles.length) {
      return 'Nothing added yet';
    }
    const weight = (performance?.goals ?? []).reduce((sum, { weight: each }) => sum + each, 0);
    return key === 'goals' && weight !== FULL_WEIGHT ? `${plural(titles.length, 'goal')}, weights at ${weight}%` : `${titles.length} added: ${titles.join(', ')}`;
  }

  protected actionFor(key: SectionKey) {
    if (!this.canEdit()) {
      return 'View';
    }
    return entriesIn(key, this.performance()?.goals ?? [], this.performance()?.entries ?? []).length ? 'Edit' : 'Add';
  }

  protected async send() {
    this.isSending.set(true);
    this.sendFailure.set(undefined);
    try {
      await this.api.submit();
      this.mine.reload();
    } catch (error) {
      console.error('Sending a plan failed', error);
      this.sendFailure.set(serverReason(error) ?? SEND_FAILED);
    } finally {
      this.isSending.set(false);
    }
  }

  protected accept({ id }: Appraisal) {
    return this.decisions.run(id, () => this.api.accept(id), () => this.mine.reload());
  }

  protected saved() {
    this.opened.set(undefined);
    this.mine.reload();
  }
}
