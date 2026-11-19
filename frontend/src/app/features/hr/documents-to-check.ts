import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DocumentEntry } from '../../models/company';
import { Avatar } from '../../shared/ui/avatar';
import { Dialog } from '../../shared/ui/dialog';
import { Icon } from '../../shared/ui/icon';
import { ListSkeleton } from '../../shared/ui/list-skeleton';
import { valueOr } from '../../shared/utils/resource';
import { DocumentFiles } from '../documents/document-files';
import { DecisionState } from '../team/decision-state';
import { DeclineForm } from '../team/decline-form';
import { submittedAgo } from '../team/request-row';
import { HrApi } from './hr-api';

// Documents people uploaded, waiting for HR to check, oldest first. Part of the inbox.
@Component({
  selector: 'app-documents-to-check',
  imports: [Avatar, DeclineForm, Dialog, DocumentFiles, Icon, ListSkeleton, RouterLink],
  template: `
    <section class="card all-requests" data-testid="documents-to-check">
      <div class="card-heading">
        <div>
          <span class="eyebrow">DOCUMENTS</span>
          <h2>To check</h2>
        </div>
      </div>
      @if (waiting.error()) {
        <p class="attendance-off">Documents didn't load. Refresh the page to try again.</p>
      } @else if (waiting.isLoading() && list().length === 0) {
        <app-list-skeleton [count]="2" />
      } @else {
        @for (document of list(); track key(document)) {
          <div class="large-request inbox-request" data-testid="waiting-document">
            <app-avatar [name]="document.employeeName ?? ''" />
            <div>
              <a [routerLink]="['/hr/people', document.employeeId]" class="person-cell"><strong>{{ document.employeeName }}</strong></a>
              <span>{{ document.name }} · {{ submittedAgo(document.updatedOn ?? '') }}</span>
            </div>
            <div>
              <small>{{ document.files.length > 1 ? 'FILES' : 'FILE' }}</small>
              <app-document-files [files]="document.files" [name]="document.name" [basePath]="basePath(document)" />
            </div>
            <div class="request-actions labeled">
              <button type="button" class="decline" [disabled]="decisions.busyId() === key(document)" (click)="declining.set(document)" data-testid="send-back"><app-icon name="x" [size]="16" /> Send back</button>
              <button type="button" class="approve" [disabled]="decisions.busyId() === key(document)" (click)="verify(document)" data-testid="verify"><app-icon name="check" [size]="16" /> Verify</button>
            </div>
            @if (decisions.failedId() === key(document)) {
              <p class="row-error" role="alert">That didn't save. Try again in a moment.</p>
            }
          </div>
        } @empty {
          <p class="attendance-off">Nothing to check. Uploads from the Documents page land here.</p>
        }
      }
    </section>

    <app-dialog heading="Send back" [isOpen]="declining() !== undefined" (isOpenChange)="$event || declining.set(undefined)">
      @if (declining(); as document) {
        <app-decline-form eyebrow="DOCUMENTS" [heading]="'Send back ' + firstName(document) + '’s ' + document.name.toLowerCase() + '?'" confirmLabel="Send back" placeholder="The photo page is cut off. Could you scan it again?" [name]="document.employeeName ?? ''" (declined)="sendBack(document, $event)" (cancelled)="declining.set(undefined)" />
      }
    </app-dialog>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentsToCheck {
  private readonly api = inject(HrApi);
  protected readonly waiting = this.api.waitingDocuments();
  protected readonly list = computed(() => valueOr(this.waiting, []));
  protected readonly decisions = new DecisionState();
  protected readonly declining = signal<DocumentEntry | undefined>(undefined);
  protected readonly submittedAgo = submittedAgo;
  protected readonly key = ({ employeeId, type }: DocumentEntry) => `${employeeId}/${type}`;
  protected readonly firstName = ({ employeeName }: DocumentEntry) => (employeeName ?? '').split(' ')[0];
  protected readonly basePath = ({ employeeId, type }: DocumentEntry) =>
    `/api/hr/employees/${encodeURIComponent(employeeId ?? '')}/documents/${encodeURIComponent(type)}`;

  protected verify(document: DocumentEntry) {
    return this.decisions.run(this.key(document), () => this.api.decideDocument(document.employeeId ?? '', document.type, 'verified'), () => this.waiting.reload());
  }

  protected async sendBack(document: DocumentEntry, note: string) {
    this.declining.set(undefined);
    await this.decisions.run(this.key(document), () => this.api.decideDocument(document.employeeId ?? '', document.type, 'rejected', note), () => this.waiting.reload());
  }
}
