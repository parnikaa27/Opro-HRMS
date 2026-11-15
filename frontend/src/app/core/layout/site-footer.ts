import { ChangeDetectionStrategy, Component } from '@angular/core';
import { COMPANY } from '../config';
import { Logo } from '../../shared/ui/logo';
import { maldivesToday, yearOf } from '../../shared/utils/date-time';

@Component({
  selector: 'app-site-footer',
  imports: [Logo],
  template: `
    <footer class="no-print">
      <div>
        <app-logo />
        <span>{{ company.tagline }}</span>
      </div>
      <p>© {{ year }} {{ company.legalName }} · {{ company.address }}</p>
      <div>
        <a [href]="company.privacyUrl">Privacy</a>
        <a [href]="company.policiesUrl">HR policies</a>
        <a [href]="'mailto:' + company.hrEmail">Support</a>
      </div>
    </footer>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SiteFooter {
  protected readonly company = COMPANY;
  protected readonly year = yearOf(maldivesToday());
}
