import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { DocumentEntry } from '../../models/company';
import { Dialog } from '../../shared/ui/dialog';
import { Icon } from '../../shared/ui/icon';
import { ListSkeleton } from '../../shared/ui/list-skeleton';
import { StatusPill } from '../../shared/ui/status-pill';
import { valueOr } from '../../shared/utils/resource';
import { describeDocument, documentStatus } from '../documents/document-status';
import { DocumentUploadForm } from '../documents/document-upload-form';
import { DecisionState } from '../team/decision-state';
import { DeclineForm } from '../team/decline-form';
import { HrApi } from './hr-api';

// One person's documents on their HR page: open any copy, upload one for them, and check what they sent.
@Component({
  selector: 'app-hr-documents-card',
  imports: [DeclineForm, Dialog, DocumentUploadForm, Icon, ListSkeleton, StatusPill],
  template: `
    <section class="card request-history" data-testid="hr-documents">
      <div class="card-heading"><div><span class="eyebrow">EMPLOYEE FILES</span><h2>Documents</h2></div></div>
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
            </div>
            <app-status-pill [tone]="status(document).tone">{{ status(document).label }}</app-status-pill>
            <span class="row-actions">
              @if (document.hasFile) {
                <a [href]="filePath(document)" target="_blank" rel="noopener" class="text-link">View</a>
              }
              @if (document.status === 'pending' && !isOwn()) {
                <button type="button" class="text-link" [disabled]="decisions.busyId() === document.type" (click)="declining.set(document)" data-testid="send-back">Send back</button>
                <button type="button" class="text-link" [disabled]="decisions.busyId() === document.type" (click)="verify(document)" data-testid="verify">Verify</button>
              }
              @if (!isOwn()) {
                <button type="button" class="text-link" (click)="uploading.set(document)" data-testid="hr-upload">Upload</button>
              }
            </span>
            @if (decisions.failedId() === document.type) {
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
        <app-decline-form eyebrow="DOCUMENTS" [heading]="'Send back the ' + document.name.toLowerCase() + '?'" confirmLabel="Send back" placeholder="The photo page is cut off. Could you scan it again?" [name]="name()" (declined)="sendBack(document, $event)" (cancelled)="declining.set(undefined)" />
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
  protected readonly filePath = ({ type }: DocumentEntry) => `/api/hr/employees/${encodeURIComponent(this.employeeId())}/documents/${encodeURIComponent(type)}/file`;

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
