import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { StatusPill } from '../../shared/ui/status-pill';
import { maldivesToday } from '../../shared/utils/date-time';
import { valueOr } from '../../shared/utils/resource';
import { AllowanceApi, describeMonthly, GRANT_STATUS, money } from './allowance-api';

// On someone's profile: what they get every month, and one-off grants. Read only; HR changes them.
@Component({
  selector: 'app-allowances-card',
  imports: [StatusPill],
  template: `
    <section class="card card-pad" data-testid="allowances-card">
      <div class="card-heading"><div><span class="eyebrow">ON TOP OF PAY</span><h2>Allowances</h2></div></div>
      @if (allowances.error()) {
        <p class="attendance-off">Your allowances didn't load. Refresh the page to try again.</p>
      } @else {
        @for (allowance of current(); track allowance.id) {
          <div class="goal-line" data-testid="my-allowance"><strong>{{ allowance.typeName }}</strong><span>{{ describe(allowance, today) }}</span></div>
        } @empty {
          <p class="card-note">No monthly allowances. HR adds them, and you'll be told.</p>
        }
        @for (grant of grants(); track grant.id) {
          <div class="goal-line" data-testid="my-grant">
            <strong>{{ grant.typeName }}, {{ money(grant.amount, grant.currency) }} once</strong>
            <span>{{ grant.reason }} <app-status-pill [tone]="grant.status === 'approved' ? 'ok' : 'late'">{{ status[grant.status] }}</app-status-pill></span>
          </div>
        }
      }
    </section>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AllowancesCard {
  protected readonly allowances = inject(AllowanceApi).mine();
  protected readonly today = maldivesToday();
  // Still paid, or still to start. Declined grants aren't theirs to see.
  protected readonly current = computed(() => valueOr(this.allowances, { monthly: [], grants: [] }).monthly.filter(({ endsOn }) => !endsOn || endsOn >= this.today));
  protected readonly grants = computed(() => valueOr(this.allowances, { monthly: [], grants: [] }).grants.filter(({ status }) => status !== 'rejected'));
  protected readonly describe = describeMonthly;
  protected readonly money = money;
  protected readonly status = GRANT_STATUS;
}
