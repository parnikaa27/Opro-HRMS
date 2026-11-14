import { ChangeDetectionStrategy, Component, inject, input, linkedSignal, output, signal } from '@angular/core';
import { FormField, form, maxLength, required } from '@angular/forms/signals';
import { CompanyEvent } from '../../../models/company';
import { FieldError } from '../../../shared/ui/field-error';
import { ModalHeading } from '../../../shared/ui/modal-heading';
import { submitForm } from '../../../shared/utils/form-submit';
import { HrApi } from '../hr-api';

const MAX_NAME = 40;

@Component({
  selector: 'app-event-form',
  imports: [FieldError, FormField, ModalHeading],
  template: `
    <app-modal-heading eyebrow="COMPANY CALENDAR" [heading]="event() ? 'Edit event' : 'Add an event'" intro="Events show on everyone's calendar. Keep the name short, it has to fit a calendar square." />
    <form novalidate (submit)="save($event)">
      <div class="form-row">
        <label>Name <input [formField]="eventForm.name" placeholder="Office social" data-testid="event-name" aria-describedby="event-name-error" /></label>
        <label>Date <input type="date" [formField]="eventForm.date" data-testid="event-date" aria-describedby="event-date-error" /></label>
      </div>
      <app-field-error id="event-name-error" [errors]="eventForm.name().errors()" [isTouched]="eventForm.name().touched()" />
      <app-field-error id="event-date-error" [errors]="eventForm.date().errors()" [isTouched]="eventForm.date().touched()" />
      @if (failed()) {
        <p role="alert">That didn't save. Try again in a moment.</p>
      }
      <div class="modal-actions">
        <button type="button" class="secondary-button" (click)="cancelled.emit()">Cancel</button>
        <button type="submit" class="primary-button" [disabled]="eventForm().submitting()" data-testid="event-submit">Save</button>
      </div>
    </form>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventForm {
  private readonly api = inject(HrApi);
  readonly event = input<CompanyEvent>();
  readonly saved = output();
  readonly cancelled = output();

  protected readonly failed = signal(false);
  protected readonly draft = linkedSignal(() => ({ name: this.event()?.name ?? '', date: this.event()?.date ?? '' }));
  protected readonly eventForm = form(this.draft, (path) => {
    required(path.name, { message: 'Give the event a name.' });
    maxLength(path.name, MAX_NAME, { message: `Keep it under ${MAX_NAME} characters.` });
    required(path.date, { message: 'Pick the date.' });
  });

  protected save(event: Event) {
    return submitForm(event, this.eventForm, this.failed, async () => {
      const { name, date } = this.draft();
      await this.api.saveEvent({ ...(this.event() && { id: this.event()?.id }), name: name.trim(), date });
      this.saved.emit();
    });
  }
}
