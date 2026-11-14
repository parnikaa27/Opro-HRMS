import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Visa } from '../../models/employee';
import { StatusPill, Tone } from '../../shared/ui/status-pill';
import { daysUntil, formatFullDate, maldivesToday } from '../../shared/utils/date-time';
import { expiryStatus, ExpiryStatus } from '../../shared/utils/expiry';
import { plural } from '../../shared/utils/text';

const EXPIRY: Record<ExpiryStatus, { label: string; tone: Tone }> = {
  valid: { label: 'Valid', tone: 'ok' },
  expiring: { label: 'Expires soon', tone: 'late' },
  expired: { label: 'Expired', tone: 'danger' },
};

@Component({
  selector: 'app-visa-details',
  imports: [StatusPill],
  template: `
    @if (visa(); as record) {
      <dl class="divide-y divide-line rounded-2xl border border-line bg-card shadow-lift">
        @for (document of documents(); track document.name) {
          <div class="flex flex-wrap items-start justify-between gap-3 px-5 py-4" data-testid="visa-document">
            <div>
              <dt class="font-medium">{{ document.name }}</dt>
              <dd class="mt-0.5 text-sm text-soft">{{ document.number }}</dd>
              <dd class="mt-0.5 text-sm text-soft">{{ document.dates }}</dd>
            </div>
            <dd class="flex flex-col items-end gap-1 text-xs text-soft">
              <app-status-pill [tone]="expiry[document.status].tone">{{ expiry[document.status].label }}</app-status-pill>
              {{ document.countdown }}
            </dd>
          </div>
        }
        <div class="px-5 py-4">
          <dt class="font-medium">Work permit</dt>
          <dd class="mt-0.5 text-sm text-soft">{{ record.workPermitNumber }}</dd>
        </div>
      </dl>
    } @else {
      <p class="rounded-2xl border border-line bg-card px-5 py-4 text-sm text-soft shadow-lift" data-testid="visa-none">
        {{ isNational() ? "Not needed. Maldivian nationals don't need a work visa." : "We don't have your visa on record. Send a copy to HR so they can track the renewal for you." }}
      </p>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VisaDetails {
  readonly visa = input<Visa>();
  readonly nationality = input.required<string>();

  private readonly today = maldivesToday();
  protected readonly expiry = EXPIRY;
  protected readonly isNational = computed(() => this.nationality() === 'Maldivian');

  protected readonly documents = computed(() => {
    const visa = this.visa();
    if (!visa) {
      return [];
    }
    const describe = (name: string, number: string, expires: string, issued?: string) => {
      const daysLeft = daysUntil(expires, this.today);
      const status = expiryStatus(expires, this.today);
      const countdown = daysLeft >= 0 ? `${plural(daysLeft, 'day')} left` : `${plural(-daysLeft, 'day')} ago`;
      return {
        name,
        number,
        dates: issued ? `Issued ${formatFullDate(issued)}, expires ${formatFullDate(expires)}` : `Expires ${formatFullDate(expires)}`,
        status,
        countdown: status === 'valid' ? '' : countdown,
      };
    };
    return [
      describe('Work visa', visa.visaNumber, visa.visaExpiry, visa.visaIssuedOn),
      describe('Passport', `Ending ${visa.passportLast4}`, visa.passportExpiry),
    ];
  });
}
