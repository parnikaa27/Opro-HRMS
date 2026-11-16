import { ChangeDetectionStrategy, Component, inject, input, linkedSignal, output, signal } from '@angular/core';
import { FormField, form, maxLength, required, submit } from '@angular/forms/signals';
import { DocumentType } from '../../../models/company';
import { FieldError } from '../../../shared/ui/field-error';
import { ModalHeading } from '../../../shared/ui/modal-heading';
import { serverReason } from '../../../shared/utils/form-submit';
import { HrApi } from '../hr-api';

const MAX_NAME = 60;
const FAILED = "That didn't save. Try again in a moment.";

// Adds a document to HR's list, or edits one. Leave the type out to add.
@Component({
  selector: 'app-document-type-form',
  imports: [FieldError, FormField, ModalHeading],
  template: `
    <app-modal-heading eyebrow="DOCUMENTS" [heading]="type() ? 'Edit ' + type()?.name?.toLowerCase() : 'Add a document'" intro="Everyone it applies to sees it on their Documents page straight away." />
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
          </select>
        </label>
      </div>
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
      neededFrom: type?.isForExpatriatesOnly ? 'expatriates' : 'everyone',
    };
  });
  protected readonly typeForm = form(this.draft, (path) => {
    required(path.name, { message: 'Give the document a name.' });
    maxLength(path.name, MAX_NAME, { message: `Keep it under ${MAX_NAME} characters.` });
  });

  protected save(event: Event) {
    event.preventDefault();
    this.failure.set(undefined);
    return submit(this.typeForm, async () => {
      const { name, uploadedBy, expires, neededFrom } = this.draft();
      try {
        await this.api.saveDocumentType({
          code: this.type()?.code,
          name: name.trim(),
          uploadedBy,
          hasExpiry: expires === 'yes',
          isForExpatriatesOnly: neededFrom === 'expatriates',
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
