import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { DocumentEntry } from '../../models/company';
import { Dialog } from '../../shared/ui/dialog';
import { Icon } from '../../shared/ui/icon';
import { ListSkeleton } from '../../shared/ui/list-skeleton';
import { StatusPill } from '../../shared/ui/status-pill';
import { valueOr } from '../../shared/utils/resource';
import { describeDocument, documentStatus } from '../documents/document-status';
import { DocumentFiles } from '../documents/document-files';
import { DocumentUploadForm } from '../documents/document-upload-form';
import { DecisionState } from '../team/decision-state';
import { DeclineForm } from '../team/decline-form';
import { HrApi } from './hr-api';

// One person's documents on their HR page: open any copy, upload one for them, and check what they sent.
@Component({
  selector: 'app-hr-documents-card',
  imports: [DeclineForm, Dialog, DocumentFiles, DocumentUploadForm, Icon, ListSkeleton, StatusPill],
  template: `
    <section class="card request-history" data-testid="hr-documents">
      <div class="card-heading">
        <div><span class="eyebrow">Employee files</span><h2>Documents</h2></div>
        @if (!isOwn() && askable().length) {
          <label class="inline-select">
            <span class="sr-only">Ask them for a document</span>
            <select (change)="ask($event)" data-testid="ask-document">
              <option value="">Ask for a document…</option>
              @for (type of askable(); track type.code) {
                <option [value]="type.code">{{ type.name }}</option>
              }
            </select>
          </label>
        }
      </div>
      @if (isAskFailure()) {
        <p class="row-error" role="alert">That didn't ask them. Try again in a moment.</p>
      }
      @if (documents.error()) {
        <p class="attendance-off">Their documents didn't load. Refresh the page to try again.</p>
      } @else if (documents.isLoading() && list().length === 0) {
        <app-list-skeleton [count]="3" />
      } @else {
        @for (document of list(); track document.type) {
          <div class="history-row" data-testid="hr-document">
            <div class="leave-type-icon"><app-icon name="file" [size]="18" /></div>
            <div>
              <strong>{{ document.name }}</strong>
              <span>{{ describe(document) }}</span>
              <app-document-files [files]="document.files" [name]="document.name" [basePath]="basePath(document)" [canRemove]="!isOwn()" [busyId]="busyFile()" (removed)="removeFile(document, $event)" />
            </div>
            <app-status-pill [tone]="status(document).tone">{{ status(document).label }}</app-status-pill>
            <span class="row-actions">
              @if (document.status === 'pending' && !isOwn()) {
                <button type="button" class="text-link" [disabled]="decisions.busyId() === document.type" (click)="declining.set(document)" data-testid="send-back">Send back</button>
                <button type="button" class="text-link" [disabled]="decisions.busyId() === document.type" (click)="verify(document)" data-testid="verify">Verify</button>
              }
              @if (!isOwn()) {
                <button type="button" class="text-link" (click)="uploading.set(document)" data-testid="hr-upload">Upload</button>
                @if (!document.isForEveryone) {
                  <button type="button" class="text-link" [disabled]="decisions.busyId() === document.type" (click)="stopAsking(document)" data-testid="stop-asking">Stop asking</button>
                }
              }
            </span>
            @if (decisions.failedId() === document.type || decisions.failedId()?.startsWith(document.type + '/')) {
              <p class="row-error" role="alert">That didn't save. Try again in a moment.</p>
            }
          </div>
        } @empty {
          <p class="attendance-off">No documents on the list yet. Add them in Policies.</p>
        }
      }
    </section>

    <app-dialog heading="Upload a document" [isOpen]="uploading() !== undefined" (isOpenChange)="$event || uploading.set(undefined)">
      @if (uploading(); as document) {
        <app-document-upload-form [document]="document" [employeeId]="employeeId()" (saved)="uploaded()" (cancelled)="uploading.set(undefined)" />
      }
    </app-dialog>

    <app-dialog heading="Send back" [isOpen]="declining() !== undefined" (isOpenChange)="$event || declining.set(undefined)">
      @if (declining(); as document) {
        <app-decline-form eyebrow="Documents" [heading]="'Send back the ' + document.name.toLowerCase() + '?'" confirmLabel="Send back" placeholder="The photo page is cut off. Could you scan it again?" [name]="name()" (declined)="sendBack(document, $event)" (cancelled)="declining.set(undefined)" />
      }
    </app-dialog>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HrDocumentsCard {
  private readonly api = inject(HrApi);
  readonly employeeId = input.required<string>();
  readonly name = input.required<string>();
  // HR never uploads or checks their own.
  readonly isOwn = input(false);

  protected readonly documents = this.api.employeeDocuments(this.employeeId);
  protected readonly list = computed(() => valueOr(this.documents, []));
  protected readonly decisions = new DecisionState();
  protected readonly uploading = signal<DocumentEntry | undefined>(undefined);
  protected readonly declining = signal<DocumentEntry | undefined>(undefined);
  protected readonly describe = describeDocument;
  protected readonly status = documentStatus;
  protected readonly basePath = ({ type }: DocumentEntry) => `/api/hr/employees/${encodeURIComponent(this.employeeId())}/documents/${encodeURIComponent(type)}`;
  private readonly types = this.api.documentTypes();
  // Types HR gives one person at a time that this person isn't asked for yet.
  protected readonly askable = computed(() =>
    valueOr(this.types, []).filter(({ isForEveryone, retiredOn, code }) => !isForEveryone && !retiredOn && !this.list().some(({ type }) => type === code)),
  );

  protected readonly busyFile = computed(() => this.decisions.busyId()?.split('/')[1]);
  protected readonly isAskFailure = computed(() => this.askable().some(({ code }) => code === this.decisions.failedId()));

  protected ask(event: Event) {
    const select = event.target instanceof HTMLSelectElement ? event.target : undefined;
    const type = select?.value;
    if (!select || !type) {
      return undefined;
    }
    select.value = '';
    return this.decisions.run(type, () => this.api.askForDocument(this.employeeId(), type), () => this.documents.reload());
  }

  protected stopAsking({ type }: DocumentEntry) {
    return this.decisions.run(type, () => this.api.stopAskingForDocument(this.employeeId(), type), () => this.documents.reload());
  }

  protected removeFile({ type }: DocumentEntry, fileId: string) {
    return this.decisions.run(`${type}/${fileId}`, () => this.api.removeDocumentFileFor(this.employeeId(), type, fileId), () => this.documents.reload());
  }

  protected verify({ type }: DocumentEntry) {
    return this.decisions.run(type, () => this.api.decideDocument(this.employeeId(), type, 'verified'), () => this.documents.reload());
  }

  protected async sendBack({ type }: DocumentEntry, note: string) {
    this.declining.set(undefined);
    await this.decisions.run(type, () => this.api.decideDocument(this.employeeId(), type, 'rejected', note), () => this.documents.reload());
  }

  protected uploaded() {
    this.uploading.set(undefined);
    this.documents.reload();
  }
}
