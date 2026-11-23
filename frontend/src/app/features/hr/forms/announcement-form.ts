import { ChangeDetectionStrategy, Component, inject, input, linkedSignal, output, signal } from '@angular/core';
import { FormField, form, maxLength, required } from '@angular/forms/signals';
import { Announcement } from '../../../models/company';
import { FieldError } from '../../../shared/ui/field-error';
import { ModalHeading } from '../../../shared/ui/modal-heading';
import { submitForm } from '../../../shared/utils/form-submit';
import { HrApi } from '../hr-api';

const MAX_TITLE = 80;
const MAX_BODY = 500;

@Component({
  selector: 'app-announcement-form',
  imports: [FieldError, FormField, ModalHeading],
  template: `
    <app-modal-heading eyebrow="From HR" [heading]="announcement() ? 'Edit announcement' : 'New announcement'" intro="Everyone gets a notification when you post. Edits don't send another one." />
    <form novalidate (submit)="save($event)">
      <label>Title <input [formField]="announcementForm.title" placeholder="Year end dinner, 17 December" data-testid="announcement-title" aria-describedby="announcement-title-error" /></label>
      <app-field-error id="announcement-title-error" [errors]="announcementForm.title().errors()" [isTouched]="announcementForm.title().touched()" />
      <label>
        Message
        <textarea [formField]="announcementForm.body" placeholder="Hulhumalé beach, 7 pm. Bring your family." data-testid="announcement-body" aria-describedby="announcement-body-error"></textarea>
      </label>
      <app-field-error id="announcement-body-error" [errors]="announcementForm.body().errors()" [isTouched]="announcementForm.body().touched()" />
      @if (failed()) {
        <p role="alert">That didn't save. Try again in a moment.</p>
      }
      <div class="modal-actions">
        <button type="button" class="secondary-button" (click)="cancelled.emit()">Cancel</button>
        <button type="submit" class="primary-button" [disabled]="announcementForm().submitting()" data-testid="announcement-submit">{{ announcement() ? 'Save' : 'Post' }}</button>
      </div>
    </form>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnnouncementForm {
  private readonly api = inject(HrApi);
  readonly announcement = input<Announcement>();
  readonly saved = output();
  readonly cancelled = output();

  protected readonly failed = signal(false);
  protected readonly draft = linkedSignal(() => ({ title: this.announcement()?.title ?? '', body: this.announcement()?.body ?? '' }));
  protected readonly announcementForm = form(this.draft, (path) => {
    required(path.title, { message: 'Give it a title.' });
    maxLength(path.title, MAX_TITLE, { message: `Keep it under ${MAX_TITLE} characters.` });
    required(path.body, { message: 'Write the message.' });
    maxLength(path.body, MAX_BODY, { message: `Keep it under ${MAX_BODY} characters.` });
  });

  protected save(event: Event) {
    return submitForm(event, this.announcementForm, this.failed, async () => {
      const { title, body } = this.draft();
      await this.api.saveAnnouncement({ ...(this.announcement() && { id: this.announcement()?.id }), title: title.trim(), body: body.trim() });
      this.saved.emit();
    });
  }
}
