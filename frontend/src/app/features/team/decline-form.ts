import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { ModalHeading } from '../../shared/ui/modal-heading';

@Component({
  selector: 'app-decline-form',
  imports: [ModalHeading],
  template: `
    <app-modal-heading [eyebrow]="eyebrow()" [heading]="heading() ?? 'Decline ' + firstName() + '’s request?'" intro="Tell them why, so they know what to do next." />
    <form novalidate (submit)="send($event)">
      <label>
        Reason
        <textarea #noteBox [placeholder]="placeholder()" [attr.aria-invalid]="showsError()" aria-describedby="decline-error" (input)="note.set(noteBox.value)" data-testid="decision-note"></textarea>
      </label>
      @if (showsError()) {
        <p class="field-error" id="decline-error">Give a short reason so they know what to do next.</p>
      }
      <div class="modal-actions">
        <button type="button" class="secondary-button" (click)="cancelled.emit()">Cancel</button>
        <button type="submit" class="primary-button danger" data-testid="confirm-reject">{{ confirmLabel() }}</button>
      </div>
    </form>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeclineForm {
  readonly name = input.required<string>();
  readonly eyebrow = input('Team management');
  readonly placeholder = input('Two others are off that week. Could you move it by a few days?');
  readonly heading = input<string>();
  readonly confirmLabel = input('Decline');
  readonly declined = output<string>();
  readonly cancelled = output();

  protected readonly note = signal('');
  protected readonly showsError = signal(false);
  protected readonly firstName = computed(() => this.name().split(' ')[0]);

  protected send(event: Event) {
    event.preventDefault();
    const note = this.note().trim();
    this.showsError.set(!note);
    if (note) {
      this.declined.emit(note);
    }
  }
}
