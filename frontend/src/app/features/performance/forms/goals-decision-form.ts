import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormField, form, maxLength, required, submit } from '@angular/forms/signals';
import { Goal } from '../../../models/performance';
import { FieldError } from '../../../shared/ui/field-error';
import { ModalHeading } from '../../../shared/ui/modal-heading';
import { serverReason } from '../../../shared/utils/form-submit';
import { PerformanceApi } from '../performance-api';

const MAX_NOTE = 300;
const FAILED = "That didn't save. Try again in a moment.";

// The goals someone sent, for their HOD, then HR, to approve or send back with what to change.
@Component({
  selector: 'app-goals-decision-form',
  imports: [FieldError, FormField, ModalHeading],
  template: `
    <app-modal-heading eyebrow="PERFORMANCE" [heading]="name() + '’s goals'" [intro]="step() === 'hr' ? 'Their HOD approved these. Approving makes them final.' : 'Approving passes them to HR. Sending them back lets them change them.'" />
    @for (goal of goals(); track goal.id) {
      <div class="goal-line" data-testid="goal-to-decide"><strong>{{ goal.title }}</strong><span>{{ goal.measure }} · {{ goal.weight }}%</span></div>
    }
    <form novalidate (submit)="decide($event, 'approved')">
      @if (isSendingBack()) {
        <label>What should they change? <textarea [formField]="noteForm.note" placeholder="Add a goal for the customs backlog." data-testid="goals-note" aria-describedby="goals-note-error"></textarea></label>
        <app-field-error id="goals-note-error" [errors]="noteForm.note().errors()" [isTouched]="noteForm.note().touched()" />
      }
      @if (failure()) {
        <p role="alert" data-testid="goals-decision-error">{{ failure() }}</p>
      }
      <div class="modal-actions">
        @if (isSendingBack()) {
          <button type="button" class="secondary-button" (click)="isSendingBack.set(false)">Back</button>
          <button type="button" class="primary-button danger" [disabled]="isSaving()" (click)="decide($event, 'rejected')" data-testid="confirm-send-back">Send back</button>
        } @else {
          <button type="button" class="secondary-button" (click)="isSendingBack.set(true)" data-testid="send-back-goals">Send back</button>
          <button type="submit" class="primary-button" [disabled]="isSaving()" data-testid="approve-goals">Approve</button>
        }
      </div>
    </form>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GoalsDecisionForm {
  private readonly api = inject(PerformanceApi);
  readonly employeeId = input.required<string>();
  readonly name = input.required<string>();
  readonly goals = input.required<readonly Goal[]>();
  readonly step = input<'team' | 'hr'>('team');
  readonly decided = output();

  protected readonly isSendingBack = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly failure = signal<string | undefined>(undefined);
  protected readonly draft = signal({ note: '' });
  protected readonly noteForm = form(this.draft, (path) => {
    required(path.note, { message: 'Say what to change, so they can fix it.' });
    maxLength(path.note, MAX_NOTE, { message: `Keep it under ${MAX_NOTE} characters.` });
  });

  protected async decide(event: Event, decision: 'approved' | 'rejected') {
    event.preventDefault();
    this.failure.set(undefined);
    const send = async () => {
      this.isSaving.set(true);
      try {
        await this.api.decideGoals(this.employeeId(), { decision, ...(decision === 'rejected' && { note: this.draft().note.trim() }) }, this.step());
        this.decided.emit();
      } catch (error) {
        console.error('Deciding goals failed', error);
        this.failure.set(serverReason(error) ?? FAILED);
      } finally {
        this.isSaving.set(false);
      }
      return undefined;
    };
    return decision === 'rejected' ? submit(this.noteForm, send) : send();
  }
}
