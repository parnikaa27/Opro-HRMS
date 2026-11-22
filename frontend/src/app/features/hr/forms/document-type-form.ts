import { ChangeDetectionStrategy, Component, inject, input, linkedSignal, output, signal } from '@angular/core';
import { FormField, form, max, maxLength, min, required, submit } from '@angular/forms/signals';
import { DocumentType } from '../../../models/company';
import { FieldError } from '../../../shared/ui/field-error';
import { ModalHeading } from '../../../shared/ui/modal-heading';
import { serverReason } from '../../../shared/utils/form-submit';
import { HrApi } from '../hr-api';

const MAX_NAME = 60;
const DEFAULT_REMIND_DAYS = 30;
const MAX_REMIND_DAYS = 365;
const FAILED = "That didn't save. Try again in a moment.";

// Adds a document to HR's list, or edits one. Leave the type out to add.
@Component({
  selector: 'app-document-type-form',
  imports: [FieldError, FormField, ModalHeading],
  template: `
    <app-modal-heading eyebrow="DOCUMENTS" [heading]="type() ? 'Edit ' + type()?.name?.toLowerCase() : 'Add a document'" intro="Everyone it applies to sees it on their Documents page straight away. One for people HR asks is given from each person's page." />
    <form novalidate (submit)="save($event)">
      <label>Name <input [formField]="typeForm.name" placeholder="Police clearance" data-testid="doc-type-name" aria-describedby="doc-type-name-error" /></label>
      <app-field-error id="doc-type-name-error" [errors]="typeForm.name().errors()" [isTouched]="typeForm.name().touched()" />
      <div class="form-row">
        <label>
          Uploaded by
          <select [formField]="typeForm.uploadedBy" data-testid="doc-type-by">
            <option value="employee">The employee, HR checks it</option>
            <option value="hr">HR</option>
          </select>
        </label>
        <label>
          Expires
          <select [formField]="typeForm.expires" data-testid="doc-type-expires">
            <option value="no">No</option>
            <option value="yes">Yes, ask for the date</option>
          </select>
        </label>
        <label>
          Needed from
          <select [formField]="typeForm.neededFrom" data-testid="doc-type-who">
            <option value="everyone">Everyone</option>
            <option value="expatriates">Expatriates only</option>
            <option value="asked">People HR asks, from their page</option>
          </select>
        </label>
      </div>
      @if (draft().expires === 'yes') {
        <label>Remind this many days before it expires <input type="number" step="1" [formField]="typeForm.remindDays" data-testid="doc-type-remind" aria-describedby="doc-type-remind-error doc-type-remind-note" /></label>
        <app-field-error id="doc-type-remind-error" [errors]="typeForm.remindDays().errors()" [isTouched]="typeForm.remindDays().touched()" />
        <p class="card-note" id="doc-type-remind-note">The person and HR hear then. Super admins hear too in the last 7 days, and everyone on the day.</p>
      }
      @if (failure()) {
        <p role="alert" data-testid="doc-type-error">{{ failure() }}</p>
      }
      <div class="modal-actions">
        <button type="button" class="secondary-button" (click)="cancelled.emit()">Cancel</button>
        <button type="submit" class="primary-button" [disabled]="typeForm().submitting()" data-testid="doc-type-submit">{{ type() ? 'Save' : 'Add document' }}</button>
      </div>
    </form>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentTypeForm {
  private readonly api = inject(HrApi);
  readonly type = input<DocumentType>();
  readonly saved = output();
  readonly cancelled = output();

  protected readonly failure = signal<string | undefined>(undefined);
  protected readonly draft = linkedSignal(() => {
    const type = this.type();
    return {
      name: type?.name ?? '',
      uploadedBy: type?.uploadedBy ?? 'employee',
      expires: type?.hasExpiry ? 'yes' : 'no',
      neededFrom: type && !type.isForEveryone ? 'asked' : type?.isForExpatriatesOnly ? 'expatriates' : 'everyone',
      remindDays: type?.remindDaysBefore ?? DEFAULT_REMIND_DAYS,
    };
  });
  protected readonly typeForm = form(this.draft, (path) => {
    required(path.name, { message: 'Give the document a name.' });
    maxLength(path.name, MAX_NAME, { message: `Keep it under ${MAX_NAME} characters.` });
    min(path.remindDays, 1, { message: 'Remind at least a day ahead.' });
    max(path.remindDays, MAX_REMIND_DAYS, { message: `That's more than a year.` });
  });

  protected save(event: Event) {
    event.preventDefault();
    this.failure.set(undefined);
    return submit(this.typeForm, async () => {
      const { name, uploadedBy, expires, neededFrom, remindDays } = this.draft();
      try {
        await this.api.saveDocumentType({
          code: this.type()?.code,
          name: name.trim(),
          uploadedBy,
          hasExpiry: expires === 'yes',
          isForExpatriatesOnly: neededFrom === 'expatriates',
          isForEveryone: neededFrom !== 'asked',
          remindDaysBefore: Math.round(remindDays),
        });
        this.saved.emit();
      } catch (error) {
        console.error('Saving a document type failed', error);
        this.failure.set(serverReason(error) ?? FAILED);
      }
      return undefined;
    });
  }
}
