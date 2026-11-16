import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DocumentType } from '../../models/company';
import { ConfirmButton } from '../../shared/ui/confirm-button';
import { Dialog } from '../../shared/ui/dialog';
import { ListSkeleton } from '../../shared/ui/list-skeleton';
import { valueOr } from '../../shared/utils/resource';
import { DocumentTypeForm } from './forms/document-type-form';
import { HrApi } from './hr-api';

// Editing means a type is open in the form. "new" means adding one.
type Editing = DocumentType | 'new' | undefined;

// HR's list of documents: who uploads each, whether it expires, and who needs it. Part of Policies.
@Component({
  selector: 'app-document-types-card',
  imports: [ConfirmButton, Dialog, DocumentTypeForm, ListSkeleton],
  template: `
    <section class="card full-table" data-testid="document-types">
      <div class="card-heading">
        <div>
          <span class="eyebrow">EMPLOYEE FILES</span>
          <h2>Documents</h2>
        </div>
        <button type="button" class="primary-button compact" (click)="editing.set('new')" data-testid="add-doc-type">Add document</button>
      </div>
      @if (types.error()) {
        <p class="attendance-off">The document list didn't load. Refresh the page to try again.</p>
      } @else if (types.isLoading() && list().length === 0) {
        <app-list-skeleton [count]="3" />
      } @else {
        <div class="table-wrap">
          <table class="stacks">
            <thead>
              <tr>
                <th scope="col">DOCUMENT</th><th scope="col">UPLOADED BY</th><th scope="col">EXPIRES</th><th scope="col">NEEDED FROM</th>
                <th scope="col"><span class="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              @for (type of list(); track type.code) {
                <tr data-testid="doc-type-row">
                  <td><strong>{{ type.name }}</strong></td>
                  <td data-label="UPLOADED BY">{{ type.uploadedBy === 'employee' ? 'The employee' : 'HR' }}</td>
                  <td data-label="EXPIRES">{{ type.hasExpiry ? 'Yes' : 'No' }}</td>
                  <td data-label="NEEDED FROM">{{ type.isForExpatriatesOnly ? 'Expatriates only' : 'Everyone' }}</td>
                  <td class="row-actions">
                    <button type="button" class="text-link" (click)="editing.set(type)" data-testid="edit-doc-type">Edit</button>
                    <app-confirm-button label="Remove" [question]="'Remove ' + type.name.toLowerCase() + '?'" yes="Yes, remove it" testId="remove-doc-type" (confirmed)="remove(type)" />
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="5">No documents yet. Add the ones Opro keeps for each person.</td></tr>
              }
            </tbody>
          </table>
        </div>
        <p class="table-note">Removing one nobody has uploaded deletes it. Otherwise it's retired: nobody is asked for it, and copies on file stay.</p>
        @if (removeFailed()) {
          <p class="row-error" role="alert">That didn't remove. Try again in a moment.</p>
        }
      }
    </section>

    <app-dialog heading="Document" [isOpen]="editing() !== undefined" (isOpenChange)="$event || editing.set(undefined)">
      @if (editing(); as open) {
        <app-document-type-form [type]="open === 'new' ? undefined : open" (saved)="saved()" (cancelled)="editing.set(undefined)" />
      }
    </app-dialog>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentTypesCard {
  private readonly api = inject(HrApi);
  protected readonly types = this.api.documentTypes();
  protected readonly editing = signal<Editing>(undefined);
  protected readonly removeFailed = signal(false);
  protected readonly list = computed(() => valueOr(this.types, []).filter(({ retiredOn }) => !retiredOn));

  protected saved() {
    this.editing.set(undefined);
    this.types.reload();
  }

  protected async remove({ code }: DocumentType) {
    this.removeFailed.set(false);
    try {
      await this.api.removeDocumentType(code);
      this.types.reload();
    } catch (error) {
      console.error('Removing a document type failed', error);
      this.removeFailed.set(true);
    }
  }
}
