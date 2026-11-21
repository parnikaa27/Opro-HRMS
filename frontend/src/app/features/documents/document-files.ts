import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DocumentFile } from '../../models/company';
import { Icon } from '../../shared/ui/icon';

// A document's files, one link each ("Page 1", "Page 2"), with a cross to take a wrong one off when allowed.
@Component({
  selector: 'app-document-files',
  imports: [Icon],
  template: `
    @if (files().length) {
      <ul class="document-files" [attr.aria-label]="name() + ' files'">
        @for (file of files(); track file.id; let index = $index) {
          <li data-testid="document-file-link">
            @if (isDownload()) {
              <a class="text-link" [href]="basePath() + '/files/' + file.id" download [attr.aria-label]="'Download ' + name() + (files().length > 1 ? ', page ' + (index + 1) : '')">{{ files().length > 1 ? 'Page ' + (index + 1) : 'Download' }}</a>
            } @else {
              <a class="text-link" [href]="basePath() + '/files/' + file.id" target="_blank" rel="noopener">{{ files().length > 1 ? 'Page ' + (index + 1) : 'Open' }}</a>
            }
            @if (canRemove()) {
              <button type="button" class="icon-button small" [disabled]="busyId() === file.id" (click)="removed.emit(file.id)" [attr.aria-label]="'Remove ' + (files().length > 1 ? 'page ' + (index + 1) + ' of ' : '') + name().toLowerCase()" data-testid="remove-file">
                <app-icon name="x" [size]="13" />
              </button>
            }
          </li>
        }
      </ul>
    }
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentFiles {
  readonly files = input.required<readonly DocumentFile[]>();
  readonly name = input.required<string>();
  // Where this document's files are served, without the trailing /files.
  readonly basePath = input.required<string>();
  readonly canRemove = input(false);
  // Someone's own copies download; HR's open in a new tab.
  readonly isDownload = input(false);
  readonly busyId = input<string>();
  readonly removed = output<string>();
}
