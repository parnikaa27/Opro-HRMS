import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DocumentEntry } from '../../models/company';
import { Avatar } from '../../shared/ui/avatar';
import { ListSkeleton } from '../../shared/ui/list-skeleton';
import { valueOr } from '../../shared/utils/resource';
import { documentStatus } from '../documents/document-status';
import { HrApi } from './hr-api';

const PREVIEW = 6;

// Who still has to hand something in, and what: missing, sent back or expired. On HR's overview.
@Component({
  selector: 'app-documents-to-collect',
  imports: [Avatar, ListSkeleton, RouterLink],
  template: `
    <section class="card card-pad to-collect" data-testid="documents-to-collect">
      <div class="card-heading">
        <div>
          <span class="eyebrow">Documents</span>
          <h2>To collect</h2>
        </div>
        @if (list().length) {
          <span class="alert-count">{{ list().length }}</span>
        }
      </div>
      @if (toCollect.error()) {
        <p class="attendance-off">This didn't load. Refresh the page to try again.</p>
      } @else if (toCollect.isLoading() && list().length === 0) {
        <app-list-skeleton [count]="3" />
      } @else {
        @for (person of shown(); track person.employeeId) {
          <a class="visa-alert" [routerLink]="['/hr/people', person.employeeId]" data-testid="to-collect">
            <app-avatar [name]="person.employeeName" />
            <div>
              <strong>{{ person.employeeName }}</strong>
              <span>{{ describe(person.documents) }}</span>
            </div>
            <b>{{ person.documents.length }}</b>
          </a>
        } @empty {
          <p class="attendance-off">Everyone has handed in everything on the list.</p>
        }
        @if (list().length > preview) {
          <button type="button" class="text-link" (click)="isShowingAll.set(!isShowingAll())" data-testid="show-all-to-collect">
            {{ isShowingAll() ? 'Show fewer' : 'Show all ' + list().length }}
          </button>
        }
      }
    </section>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentsToCollect {
  protected readonly toCollect = inject(HrApi).documentsToCollect();
  protected readonly list = computed(() => valueOr(this.toCollect, []));
  protected readonly preview = PREVIEW;
  protected readonly isShowingAll = signal(false);
  protected readonly shown = computed(() => (this.isShowingAll() ? this.list() : this.list().slice(0, PREVIEW)));
  // "National ID (missing), visa copy (expired)"
  protected readonly describe = (documents: readonly DocumentEntry[]) =>
    documents.map((document) => `${document.name} (${documentStatus(document).label.toLowerCase()})`).join(', ');
}
