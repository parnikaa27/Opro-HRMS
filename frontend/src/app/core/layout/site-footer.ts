import { ChangeDetectionStrategy, Component } from '@angular/core';
import { COMPANY } from '../config';
import { maldivesToday, yearOf } from '../../shared/utils/date-time';

@Component({
  selector: 'app-site-footer',
  template: `
    <footer class="border-t border-line no-print">
      <div class="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-sm text-soft sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p>© {{ year }} {{ company.name }}, {{ company.address }}</p>
        <p>
          Questions about leave or your visa? Write to
          <a [href]="'mailto:' + company.hrEmail" class="text-sea underline-offset-4 hover:underline">{{ company.hrEmail }}</a>
        </p>
      </div>
    </footer>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteFooter {
  protected readonly company = COMPANY;
  protected readonly year = yearOf(maldivesToday());
}
