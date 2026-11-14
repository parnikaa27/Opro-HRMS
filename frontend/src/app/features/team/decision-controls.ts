import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { Decision } from './team-api';

@Component({
  selector: 'app-decision-controls',
  template: `
    @if (isRejecting()) {
      <div class="mt-4 space-y-3">
        <label class="field-label" [for]="'note-' + requestId()">Tell them why</label>
        <textarea
          #noteBox
          [id]="'note-' + requestId()"
          rows="2"
          class="field-input"
          placeholder="Two others are off that week. Could you move it by a few days?"
          [attr.aria-invalid]="showNoteError()"
          (input)="note.set(noteBox.value)"
          data-testid="decision-note"
        ></textarea>
        @if (showNoteError()) {
          <p class="field-error">Give a short reason so they can plan around it.</p>
        }
        <div class="flex flex-wrap gap-2">
          <button type="button" class="btn-primary bg-danger" [disabled]="isBusy()" (click)="reject()" data-testid="confirm-reject">Send</button>
          <button type="button" class="btn-quiet" (click)="isRejecting.set(false)">Back</button>
        </div>
      </div>
    } @else {
      <div class="mt-4 flex flex-wrap gap-2">
        <button type="button" class="btn-primary" [disabled]="isBusy()" (click)="decided.emit({ decision: 'approved' })" data-testid="approve">
          {{ isBusy() ? 'Saving…' : 'Approve' }}
        </button>
        <button type="button" class="btn-quiet" [disabled]="isBusy()" (click)="isRejecting.set(true)" data-testid="reject">Not approve</button>
      </div>
    }
    @if (hasFailed()) {
      <p class="mt-2 text-sm text-danger" role="alert">That didn't save. Try again in a moment.</p>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DecisionControls {
  readonly requestId = input.required<string>();
  readonly isBusy = input(false);
  readonly hasFailed = input(false);
  readonly decided = output<Decision>();

  protected readonly isRejecting = signal(false);
  protected readonly note = signal('');
  protected readonly showNoteError = signal(false);

  protected reject() {
    const note = this.note().trim();
    this.showNoteError.set(!note);
    if (note) {
      this.decided.emit({ decision: 'rejected', note });
    }
  }
}
