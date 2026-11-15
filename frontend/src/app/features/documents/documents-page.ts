import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CompanyApi } from '../../core/company-api';
import { EmployeeDocument } from '../../models/company';
import { Icon } from '../../shared/ui/icon';
import { ListSkeleton } from '../../shared/ui/list-skeleton';
import { StatusPill } from '../../shared/ui/status-pill';
import { formatCompactDate } from '../../shared/utils/date-time';
import { valueOr } from '../../shared/utils/resource';

const describe = ({ expiresOn, updatedOn, status }: EmployeeDocument) =>
  expiresOn ? `PDF · Expires ${formatCompactDate(expiresOn)}` : updatedOn ? `PDF · Updated ${formatCompactDate(updatedOn)}` : `PDF · ${status === 'verified' ? 'Verified' : 'Waiting for HR'}`;

@Component({
  selector: 'app-documents-page',
  imports: [Icon, ListSkeleton, StatusPill],
  template: `
    <div class="page-view">
      <div class="page-title">
        <div>
          <span class="eyebrow">EMPLOYEE FILES</span>
          <h1>Documents</h1>
          <p>Your verified employment and compliance documents.</p>
        </div>
      </div>
      @if (documents.error()) {
        <p class="attendance-off">Your documents didn't load. Refresh the page to try again.</p>
      } @else if (documents.isLoading() && list().length === 0) {
        <app-list-skeleton [count]="4" />
      } @else {
        <section class="card document-list">
          @for (document of list(); track document.id) {
            <div data-testid="document">
              <div class="doc-icon"><app-icon name="file" /></div>
              <div>
                <strong>{{ document.name }}</strong>
                <span>{{ describe(document) }}</span>
              </div>
              <app-status-pill [tone]="document.status === 'verified' ? 'ok' : 'late'">{{ document.status === 'verified' ? 'Verified' : 'Pending' }}</app-status-pill>
              <a class="icon-button" [href]="'/api/documents/' + document.id + '/file'" download [attr.aria-label]="'Download ' + document.name">
                <app-icon name="download" [size]="17" />
              </a>
            </div>
          } @empty {
            <p class="attendance-off">No documents yet. HR adds them here once they're on file.</p>
          }
        </section>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentsPage {
  protected readonly documents = inject(CompanyApi).documents();
  protected readonly list = computed(() => valueOr(this.documents, []));
  protected readonly describe = describe;
}
