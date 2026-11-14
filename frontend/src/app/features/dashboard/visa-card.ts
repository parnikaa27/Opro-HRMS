import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Employee } from '../../models/employee';
import { Icon, IconName } from '../../shared/ui/icon';
import { StatusPill, Tone } from '../../shared/ui/status-pill';
import { daysUntil, formatCompactDate, formatFullDate, maldivesToday } from '../../shared/utils/date-time';
import { expiryStatus, ExpiryStatus } from '../../shared/utils/expiry';
import { plural } from '../../shared/utils/text';

const PERCENT = 100;

const STATE: Record<ExpiryStatus, { pill: string; tone: Tone; note: string; icon: IconName }> = {
  valid: { pill: 'Valid', tone: 'ok', note: 'No action needed right now', icon: 'shieldCheck' },
  expiring: { pill: 'Expires soon', tone: 'late', note: 'Send your renewal documents to HR', icon: 'alert' },
  expired: { pill: 'Expired', tone: 'danger', note: 'Speak to HR today', icon: 'alert' },
};

@Component({
  selector: 'app-visa-card',
  imports: [Icon, StatusPill],
  template: `
    <section class="card visa-card" data-testid="visa-card">
      <div class="card-heading">
        <div>
          <span class="eyebrow">WORK VISA</span>
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
          {{ isNational() ? "Maldivian nationals don't need a work visa." : "We don't have your visa on record. Send a copy to HR so they can track the renewal." }}
        </p>
      }
    </section>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VisaCard {
  readonly employee = input.required<Employee>();
  // A manager reading someone else's card gets wording about them, not "you".
  readonly isOwn = input(true);
  private readonly today = maldivesToday();

  protected readonly isNational = computed(() => this.employee().nationality === 'Maldivian');
  protected readonly visaState = computed(() => {
    const visa = this.employee().visa;
    return visa ? STATE[expiryStatus(visa.visaExpiry, this.today)] : undefined;
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
    const state = this.visaState();
    if (visa && state?.pill === 'Valid' && expiryStatus(visa.passportExpiry, this.today) !== 'valid') {
      return { icon: 'alert' as const, text: `${this.isOwn() ? 'Your' : 'Their'} passport expires on ${formatFullDate(visa.passportExpiry)}. ${this.isOwn() ? 'Start' : 'Ask them to start'} the renewal.` };
    }
    const text = state?.note ?? '';
    return { icon: state?.icon ?? ('shieldCheck' as const), text: this.isOwn() ? text : text.replace('Send your', 'Ask them to send their').replace('Speak to HR today', 'Make sure HR knows today') };
  });

  protected readonly formatCompactDate = formatCompactDate;
}
