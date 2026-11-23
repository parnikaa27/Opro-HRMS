import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CompanyApi } from '../../core/company-api';
import { DocumentEntry } from '../../models/company';
import { Dialog } from '../../shared/ui/dialog';
import { Icon } from '../../shared/ui/icon';
import { ListSkeleton } from '../../shared/ui/list-skeleton';
import { StatusPill } from '../../shared/ui/status-pill';
import { valueOr } from '../../shared/utils/resource';
import { describeDocument, documentStatus } from './document-status';
import { DocumentFiles } from './document-files';
import { DocumentUploadForm } from './document-upload-form';

@Component({
  selector: 'app-documents-page',
  imports: [Dialog, DocumentFiles, DocumentUploadForm, Icon, ListSkeleton, StatusPill],
  template: `
    <div class="page-view">
      <div class="page-title">
        <div>
          <span class="eyebrow">Employee files</span>
          <h1>Documents</h1>
          <p>Your employment and compliance documents. Upload yours here, and HR checks them.</p>
        </div>
      </div>
      @if (documents.error()) {
        <p class="attendance-off">Your documents didn't load. Refresh the page to try again.</p>
      } @else if (documents.isLoading() && list().length === 0) {
        <app-list-skeleton [count]="4" />
      } @else {
        <section class="card document-list">
          @for (document of list(); track document.type) {
            <div data-testid="document">
              <div class="doc-icon"><app-icon name="file" /></div>
              <div>
                <strong>{{ document.name }}</strong>
                <span>{{ describe(document) }}</span>
                <app-document-files [files]="document.files" [name]="document.name" [basePath]="'/api/documents/' + document.type" [canRemove]="canRemove(document)" [isDownload]="true" [busyId]="removing()" (removed)="remove(document, $event)" />
                @if (document.uploadedBy === 'employee') {
                  <button type="button" class="text-link" (click)="uploading.set(document)" data-testid="upload-document">{{ document.files.length ? 'Add a page or a new copy' : 'Upload' }}</button>
                }
                @if (failedType() === document.type) {
                  <span class="row-error" role="alert">That file didn't come off. Try again in a moment.</span>
                }
              </div>
              <app-status-pill [tone]="status(document).tone">{{ status(document).label }}</app-status-pill>
              <span></span>
            </div>
          } @empty {
            <p class="attendance-off">HR hasn't listed any documents yet.</p>
          }
        </section>
      }
    </div>

    <app-dialog heading="Upload a document" [isOpen]="uploading() !== undefined" (isOpenChange)="$event || uploading.set(undefined)">
      @if (uploading(); as document) {
        <app-document-upload-form [document]="document" (saved)="uploaded()" (cancelled)="uploading.set(undefined)" />
      }
    </app-dialog>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentsPage {
  private readonly api = inject(CompanyApi);
  protected readonly documents = this.api.documents();
  protected readonly list = computed(() => valueOr(this.documents, []));
  protected readonly uploading = signal<DocumentEntry | undefined>(undefined);
  protected readonly describe = describeDocument;
  protected readonly status = documentStatus;

  protected readonly removing = signal<string | undefined>(undefined);
  protected readonly failedType = signal<string | undefined>(undefined);
  // Their own files come off until HR has verified the copy.
  protected readonly canRemove = ({ uploadedBy, status }: DocumentEntry) => uploadedBy === 'employee' && (status === 'pending' || status === 'rejected');

  protected async remove({ type }: DocumentEntry, fileId: string) {
    this.removing.set(fileId);
    this.failedType.set(undefined);
    try {
      await this.api.removeDocumentFile(type, fileId);
      this.documents.reload();
    } catch (error) {
      console.error('Removing a document file failed', error);
      this.failedType.set(type);
    } finally {
      this.removing.set(undefined);
    }
  }

  protected uploaded() {
    this.uploading.set(undefined);
    this.documents.reload();
  }
}
