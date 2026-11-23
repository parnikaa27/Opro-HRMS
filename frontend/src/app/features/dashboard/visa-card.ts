import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Employee } from '../../models/employee';
import { Icon, IconName } from '../../shared/ui/icon';
import { StatusPill, Tone } from '../../shared/ui/status-pill';
import { daysUntil, formatCompactDate, formatFullDate, maldivesToday } from '../../shared/utils/date-time';
import { expiryStatus, ExpiryStatus } from '../../shared/utils/expiry';
import { plural } from '../../shared/utils/text';

const PERCENT = 100;

export type VisaReader = 'self' | 'manager' | 'hr';

const STATE: Record<ExpiryStatus, { pill: string; tone: Tone; icon: IconName }> = {
  valid: { pill: 'Valid', tone: 'ok', icon: 'shieldCheck' },
  expiring: { pill: 'Expires soon', tone: 'late', icon: 'alert' },
  expired: { pill: 'Expired', tone: 'danger', icon: 'alert' },
};

// The same facts, worded for whoever is reading the card.
const NOTES: Record<VisaReader, Record<ExpiryStatus | 'passport' | 'missing', string>> = {
  self: {
    valid: 'No action needed right now',
    expiring: 'Send your renewal documents to HR',
    expired: 'Speak to HR today',
    passport: 'Your passport expires on {date}. Start the renewal.',
    missing: "We don't have your visa on record. Send a copy to HR so they can track the renewal.",
  },
  manager: {
    valid: 'No action needed right now',
    expiring: 'Ask them to send their renewal documents to HR',
    expired: 'Make sure HR knows today',
    passport: 'Their passport expires on {date}. Ask them to start the renewal.',
    missing: "HR doesn't have their visa on record yet.",
  },
  hr: {
    valid: 'No action needed right now',
    expiring: 'Ask them for their renewal documents',
    expired: 'Their visa has lapsed. Start the renewal today',
    passport: 'Their passport expires on {date}. Ask them to start the renewal.',
    missing: 'No visa on record. Add it with Update visa.',
  },
};

@Component({
  selector: 'app-visa-card',
  imports: [Icon, StatusPill],
  template: `
    <section class="card visa-card" data-testid="visa-card">
      <div class="card-heading">
        <div>
          <span class="eyebrow">Work visa</span>
          <h2>Visa status</h2>
        </div>
        @if (visaState(); as state) {
          <app-status-pill [tone]="state.tone">{{ state.pill }}</app-status-pill>
        } @else {
          <app-status-pill tone="neutral">{{ isNational() ? 'Not needed' : 'Missing' }}</app-status-pill>
        }
      </div>
      @if (employee().visa; as visa) {
        <div class="visa-main">
          <div class="visa-icon"><app-icon name="globe" [size]="26" /></div>
          <div>
            <span>Employment Visa</span>
            <strong>{{ visa.visaNumber }}</strong>
          </div>
        </div>
        <div class="visa-dates">
          <div>
            <span>Expiry date</span>
            <strong>{{ formatCompactDate(visa.visaExpiry) }}</strong>
          </div>
          <div>
            <span>Time remaining</span>
            <strong>{{ remaining() }}</strong>
          </div>
        </div>
        <div class="progress-track" aria-hidden="true"><i [style.width.%]="usedPercent()"></i></div>
        <small class="visa-note"><app-icon [name]="note().icon" [size]="14" /> {{ note().text }}</small>
      } @else {
        <p class="attendance-off">
          {{ isNational() ? "Maldivian nationals don't need a work visa." : notes().missing }}
        </p>
      }
    </section>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VisaCard {
  readonly employee = input.required<Employee>();
  readonly reader = input<VisaReader>('self');
  private readonly today = maldivesToday();

  protected readonly notes = computed(() => NOTES[this.reader()]);
  protected readonly isNational = computed(() => this.employee().nationality === 'Maldivian');
  private readonly status = computed(() => {
    const visa = this.employee().visa;
    return visa ? expiryStatus(visa.visaExpiry, this.today) : undefined;
  });
  protected readonly visaState = computed(() => {
    const status = this.status();
    return status ? STATE[status] : undefined;
  });
  protected readonly remaining = computed(() => {
    const days = daysUntil(this.employee().visa?.visaExpiry ?? this.today, this.today);
    return days >= 0 ? plural(days, 'day') : `Expired ${plural(-days, 'day')} ago`;
  });
  protected readonly usedPercent = computed(() => {
    const visa = this.employee().visa;
    if (!visa) {
      return 0;
    }
    const total = daysUntil(visa.visaExpiry, visa.visaIssuedOn);
    return total > 0 ? Math.min(PERCENT, (daysUntil(this.today, visa.visaIssuedOn) / total) * PERCENT) : PERCENT;
  });
  // A passport running out matters even while the visa itself is fine.
  protected readonly note = computed(() => {
    const visa = this.employee().visa;
    const status = this.status();
    if (visa && status === 'valid' && expiryStatus(visa.passportExpiry, this.today) !== 'valid') {
      return { icon: 'alert' as const, text: this.notes().passport.replace('{date}', formatFullDate(visa.passportExpiry)) };
    }
    return { icon: this.visaState()?.icon ?? ('shieldCheck' as const), text: status ? this.notes()[status] : '' };
  });

  protected readonly formatCompactDate = formatCompactDate;
}
