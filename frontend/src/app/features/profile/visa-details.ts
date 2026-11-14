import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Visa } from '../../models/employee';
import { Icon, IconName } from '../../shared/ui/icon';
import { StatusPill, Tone } from '../../shared/ui/status-pill';
import { daysUntil, formatFullDate, maldivesToday } from '../../shared/utils/date-time';
import { expiryStatus, ExpiryStatus } from '../../shared/utils/expiry';
import { plural } from '../../shared/utils/text';

const EXPIRY: Record<ExpiryStatus, { label: string; tone: Tone }> = {
  valid: { label: 'Valid', tone: 'ok' },
  expiring: { label: 'Expires soon', tone: 'late' },
  expired: { label: 'Expired', tone: 'danger' },
};

interface DocumentRow {
  name: string;
  icon: IconName;
  number: string;
  dates: string;
  countdown: string;
  status?: ExpiryStatus;
}

@Component({
  selector: 'app-visa-details',
  imports: [Icon, StatusPill],
  template: `
    <section class="card request-history">
      <div class="card-heading">
        <div>
          <span class="eyebrow">WORK VISA</span>
          <h2>Visa and work permit</h2>
        </div>
      </div>
      @if (visa()) {
        @for (document of documents(); track document.name) {
          <div class="history-row" data-testid="visa-document">
            <div class="leave-type-icon"><app-icon [name]="document.icon" [size]="18" /></div>
            <div>
              <strong>{{ document.name }}</strong>
              <span>{{ document.number }}@if (document.dates) { · {{ document.dates }}}</span>
            </div>
            <span>{{ document.countdown }}</span>
            @if (document.status; as status) {
              <app-status-pill [tone]="expiry[status].tone">{{ expiry[status].label }}</app-status-pill>
            } @else {
              <span></span>
            }
          </div>
        }
      } @else {
        <p class="attendance-off" data-testid="visa-none">
          {{ isNational() ? "Not needed. Maldivian nationals don't need a work visa." : "We don't have your visa on record. Send a copy to HR so they can track the renewal for you." }}
        </p>
      }
    </section>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VisaDetails {
  readonly visa = input<Visa>();
  readonly nationality = input.required<string>();

  private readonly today = maldivesToday();
  protected readonly expiry = EXPIRY;
  protected readonly isNational = computed(() => this.nationality() === 'Maldivian');

  protected readonly documents = computed<DocumentRow[]>(() => {
    const visa = this.visa();
    if (!visa) {
      return [];
    }
    const describe = (name: string, icon: IconName, number: string, expires: string, issued?: string): DocumentRow => {
      const daysLeft = daysUntil(expires, this.today);
      const status = expiryStatus(expires, this.today);
      return {
        name,
        icon,
        number,
        dates: issued ? `Issued ${formatFullDate(issued)}, expires ${formatFullDate(expires)}` : `Expires ${formatFullDate(expires)}`,
        status,
        countdown: status === 'valid' ? '' : daysLeft >= 0 ? `${plural(daysLeft, 'day')} left` : `${plural(-daysLeft, 'day')} ago`,
      };
    };
    return [
      describe('Work visa', 'globe', visa.visaNumber, visa.visaExpiry, visa.visaIssuedOn),
      describe('Passport', 'file', `Ending ${visa.passportLast4}`, visa.passportExpiry),
      { name: 'Work permit', icon: 'badgeCheck', number: visa.workPermitNumber, dates: '', countdown: '' },
    ];
  });
}
