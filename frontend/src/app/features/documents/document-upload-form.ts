import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormField, form, required, submit, validate } from '@angular/forms/signals';
import { CompanyApi } from '../../core/company-api';
import { DocumentEntry } from '../../models/company';
import { FieldError } from '../../shared/ui/field-error';
import { ModalHeading } from '../../shared/ui/modal-heading';
import { addDays, maldivesToday } from '../../shared/utils/date-time';
import { serverReason } from '../../shared/utils/form-submit';
import { HrApi } from '../hr/hr-api';
import { CERTIFICATE_ACCEPT, certificateProblem } from '../leave/leave-api';

const FAILED = "That didn't upload. Check your connection and try again.";

// Uploads one document: someone's own, or HR's copy for the person in employeeId.
@Component({
  selector: 'app-document-upload-form',
  imports: [FieldError, FormField, ModalHeading],
  template: `
    <app-modal-heading eyebrow="DOCUMENTS" [heading]="(document().hasFile ? 'Replace ' : 'Upload ') + document().name.toLowerCase()" [intro]="intro()" />
    <form novalidate (submit)="save($event)">
      <label>
        File
        <input type="file" [accept]="accept" (change)="pick($event)" data-testid="document-file" aria-describedby="document-file-note" />
      </label>
      <p class="modal-intro" id="document-file-note">{{ fileProblem() ?? 'A PDF, JPG or PNG under 5 MB.' }}</p>
      @if (document().hasExpiry) {
        <label>Expires on <input type="date" [min]="tomorrow" [formField]="uploadForm.expiresOn" data-testid="document-expiry" aria-describedby="document-expiry-error" /></label>
        <app-field-error id="document-expiry-error" [errors]="uploadForm.expiresOn().errors()" [isTouched]="uploadForm.expiresOn().touched()" />
      }
      @if (failure()) {
        <p role="alert" data-testid="document-error">{{ failure() }}</p>
      }
      <div class="modal-actions">
        <button type="button" class="secondary-button" (click)="cancelled.emit()">Cancel</button>
        <button type="submit" class="primary-button" [disabled]="uploadForm().submitting()" data-testid="document-submit">{{ uploadForm().submitting() ? 'Uploading…' : 'Upload' }}</button>
      </div>
    </form>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentUploadForm {
  private readonly company = inject(CompanyApi);
  private readonly hr = inject(HrApi);
  readonly document = input.required<DocumentEntry>();
  readonly employeeId = input<string>();
  readonly saved = output();
  readonly cancelled = output();

  protected readonly accept = CERTIFICATE_ACCEPT;
  protected readonly tomorrow = addDays(maldivesToday(), 1);
  protected readonly intro = computed(() =>
    this.employeeId() ? 'It counts as verified straight away, and they’re told.' : 'HR checks it, and you’ll hear when it’s verified.',
  );
  protected readonly failure = signal<string | undefined>(undefined);
  protected readonly fileProblem = signal<string | undefined>(undefined);
  private readonly file = signal<File | undefined>(undefined);
  protected readonly draft = signal({ expiresOn: '' });
  protected readonly uploadForm = form(this.draft, (path) => {
    required(path.expiresOn, { message: 'Enter the date it expires.', when: () => this.document().hasExpiry });
    validate(path.expiresOn, ({ value }) => (value() && value() < this.tomorrow ? { kind: 'past', message: 'It has to expire after today.' } : undefined));
  });

  protected pick(event: Event) {
    const file = event.target instanceof HTMLInputElement ? event.target.files?.[0] : undefined;
    const problem = file && certificateProblem(file);
    this.fileProblem.set(problem);
    this.file.set(problem ? undefined : file);
  }

  protected save(event: Event) {
    event.preventDefault();
    this.failure.set(undefined);
    const file = this.file();
    if (!file) {
      this.fileProblem.set(this.fileProblem() ?? 'Pick the file to upload.');
    }
    return submit(this.uploadForm, async () => {
      if (!file) {
        return undefined;
      }
      const { type, hasExpiry } = this.document();
      const expiresOn = hasExpiry ? this.draft().expiresOn : undefined;
      const employeeId = this.employeeId();
      try {
        await (employeeId ? this.hr.uploadDocumentFor(employeeId, type, file, expiresOn) : this.company.uploadDocument(type, file, expiresOn));
        this.saved.emit();
      } catch (error) {
        console.error('Uploading a document failed', error);
        this.failure.set(serverReason(error) ?? FAILED);
      }
      return undefined;
    });
  }
}
