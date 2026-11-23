import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { FormField, form, required, submit, validate } from '@angular/forms/signals';
import { CompanyApi } from '../../core/company-api';
import { DocumentEntry } from '../../models/company';
import { FieldError } from '../../shared/ui/field-error';
import { Icon } from '../../shared/ui/icon';
import { ModalHeading } from '../../shared/ui/modal-heading';
import { addDays, maldivesToday } from '../../shared/utils/date-time';
import { serverReason } from '../../shared/utils/form-submit';
import { HrApi } from '../hr/hr-api';
import { CERTIFICATE_ACCEPT, certificateProblem } from '../leave/leave-api';

const FAILED = "That didn't upload. Check your connection and try again.";
const KILOBYTE = 1024;

// "240 KB" or "1.2 MB", for the list of files picked.
const sizeOf = ({ size }: File) => (size < KILOBYTE * KILOBYTE ? `${Math.max(1, Math.round(size / KILOBYTE))} KB` : `${(size / KILOBYTE / KILOBYTE).toFixed(1)} MB`);

// Uploads one or more files of a document: someone's own, or HR's copy for the person in employeeId. Each file picked
// is listed with a cross, so a wrong one comes off before anything is sent.
@Component({
  selector: 'app-document-upload-form',
  imports: [FieldError, FormField, Icon, ModalHeading],
  template: `
    <app-modal-heading eyebrow="Documents" [heading]="'Upload ' + document().name.toLowerCase()" [intro]="intro()" />
    <form novalidate (submit)="save($event)">
      <label>
        {{ files().length ? 'Add more files' : 'Files' }}
        <input type="file" multiple [accept]="accept" (change)="pick($event)" data-testid="document-file" aria-describedby="document-file-note" />
      </label>
      <p class="modal-intro" id="document-file-note">{{ fileProblem() ?? 'PDF, JPG or PNG, each under 5 MB. Pick several at once for a document with more than one page.' }}</p>
      @if (files().length) {
        <ul class="picked-files" aria-label="Files to upload" data-testid="picked-files">
          @for (file of files(); track $index; let index = $index) {
            <li data-testid="picked-file">
              <span>{{ file.name }}</span>
              <small>{{ sizeOf(file) }}</small>
              <button type="button" class="entry-remove" (click)="remove(index)" [attr.aria-label]="'Take off ' + file.name" data-testid="remove-picked-file">
                <app-icon name="x" [size]="16" />
              </button>
            </li>
          }
        </ul>
      }
      <div class="form-row">
        <label>Starts on <input type="date" [max]="today" [formField]="uploadForm.issuedOn" data-testid="document-issued" aria-describedby="document-issued-error" /></label>
        @if (document().hasExpiry) {
          <label>Expires on <input type="date" [min]="tomorrow" [formField]="uploadForm.expiresOn" data-testid="document-expiry" aria-describedby="document-expiry-error" /></label>
        }
      </div>
      <app-field-error id="document-issued-error" [errors]="uploadForm.issuedOn().errors()" [isTouched]="uploadForm.issuedOn().touched()" />
      <app-field-error id="document-expiry-error" [errors]="uploadForm.expiresOn().errors()" [isTouched]="uploadForm.expiresOn().touched()" />
      @if (document().files.length) {
        <p class="card-note">The same dates as the copy on file add these as more pages. New dates make a new copy, which replaces the old files.</p>
      }
      @if (failure()) {
        <p role="alert" data-testid="document-error">{{ failure() }}</p>
      }
      <div class="modal-actions">
        <button type="button" class="secondary-button" (click)="cancelled.emit()">Cancel</button>
        <button type="submit" class="primary-button" [disabled]="uploadForm().submitting()" data-testid="document-submit">{{ uploadForm().submitting() ? 'Uploading…' : files().length > 1 ? 'Upload ' + files().length + ' files' : 'Upload' }}</button>
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
  protected readonly today = maldivesToday();
  protected readonly tomorrow = addDays(this.today, 1);
  protected readonly intro = computed(() =>
    this.employeeId() ? 'It counts as verified straight away, and they’re told.' : 'HR checks it, and you’ll hear when it’s verified.',
  );
  protected readonly failure = signal<string | undefined>(undefined);
  protected readonly fileProblem = signal<string | undefined>(undefined);
  protected readonly files = signal<readonly File[]>([]);
  protected readonly sizeOf = sizeOf;
  // Starts with the copy on file's dates, so adding a page is just picking the file.
  protected readonly draft = linkedSignal(() => ({ issuedOn: this.document().issuedOn ?? '', expiresOn: this.document().expiresOn ?? '' }));
  protected readonly uploadForm = form(this.draft, (path) => {
    required(path.issuedOn, { message: 'Enter the date it starts.' });
    validate(path.issuedOn, ({ value }) => (value() > this.today ? { kind: 'future', message: "It can't start after today." } : undefined));
    required(path.expiresOn, { message: 'Enter the date it expires.', when: () => this.document().hasExpiry });
    validate(path.expiresOn, ({ value }) => (value() && value() < this.tomorrow ? { kind: 'past', message: 'It has to expire after today.' } : undefined));
  });

  // Each pick adds to the list. A file that can't be sent is left out, and says why.
  protected pick(event: Event) {
    if (!(event.target instanceof HTMLInputElement)) {
      return;
    }
    const picked = [...(event.target.files ?? [])];
    const refused = picked.filter((file) => certificateProblem(file));
    this.fileProblem.set(refused.length ? `Left out ${refused.map(({ name }) => name).join(', ')}. Each file has to be a PDF, JPG or PNG under 5 MB.` : undefined);
    this.files.update((files) => [...files, ...picked.filter((file) => !certificateProblem(file))]);
    // So the same file can be picked again after taking it off.
    event.target.value = '';
  }

  protected remove(index: number) {
    this.files.update((files) => files.filter((_, position) => position !== index));
  }

  protected save(event: Event) {
    event.preventDefault();
    this.failure.set(undefined);
    const files = this.files();
    if (!files.length) {
      this.fileProblem.set(this.fileProblem() ?? 'Pick the file to upload.');
    }
    return submit(this.uploadForm, async () => {
      if (!files.length) {
        return undefined;
      }
      const { type, hasExpiry } = this.document();
      const { issuedOn, expiresOn } = this.draft();
      const dates = { issuedOn, ...(hasExpiry && { expiresOn }) };
      const employeeId = this.employeeId();
      try {
        // One at a time, in the order picked, so the pages keep their order. Each one sent leaves the list, so trying
        // again after a failure doesn't send it twice.
        for (const file of files) {
          await (employeeId ? this.hr.uploadDocumentFor(employeeId, type, file, dates) : this.company.uploadDocument(type, file, dates));
          this.files.update((left) => left.filter((each) => each !== file));
        }
        this.saved.emit();
      } catch (error) {
        console.error('Uploading a document failed', error);
        this.failure.set(serverReason(error) ?? FAILED);
      }
      return undefined;
    });
  }
}
