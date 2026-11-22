import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Dialog } from '../../shared/ui/dialog';
import { StatusPill } from '../../shared/ui/status-pill';
import { formatShortDate } from '../../shared/utils/date-time';
import { valueOr } from '../../shared/utils/resource';
import { AllowanceApi, GRANT_STATUS, money } from './allowance-api';
import { GrantForm } from './grant-form';

// On an HOD's page for one report: one-off allowances they've had, and granting another.
@Component({
  selector: 'app-team-grants-card',
  imports: [Dialog, GrantForm, StatusPill],
  template: `
    <section class="card request-history" data-testid="team-grants">
      <div class="card-heading">
        <div><span class="eyebrow">ALLOWANCES</span><h2>One-off allowances</h2></div>
        <button type="button" class="secondary-button" (click)="isGranting.set(true)" data-testid="grant-allowance">Grant one</button>
      </div>
      @if (grants.error()) {
        <p class="attendance-off">Allowances didn't load. Refresh the page to try again.</p>
      } @else {
        @for (grant of theirs(); track grant.id) {
          <div class="history-row exit-row" data-testid="team-grant">
            <div><strong>{{ grant.typeName }}, {{ money(grant.amount, grant.currency) }}</strong><span>{{ grant.reason }} · {{ formatShortDate(grant.grantedOn) }}{{ grant.decisionNote ? ' · “' + grant.decisionNote + '”' : '' }}</span></div>
            <app-status-pill [tone]="grant.status === 'approved' ? 'ok' : grant.status === 'rejected' ? 'danger' : 'late'">{{ status[grant.status] }}</app-status-pill>
            <span></span>
          </div>
        } @empty {
          <p class="attendance-off">None yet. Grant one for something out of the ordinary, like taxis while the ferry was off.</p>
        }
      }
    </section>

    <app-dialog heading="One-off allowance" [(isOpen)]="isGranting">
      @if (isGranting()) {
        <app-grant-form [employeeId]="employeeId()" [name]="name()" [types]="activeTypes()" (saved)="granted()" (cancelled)="isGranting.set(false)" />
      }
    </app-dialog>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeamGrantsCard {
  private readonly api = inject(AllowanceApi);
  readonly employeeId = input.required<string>();
  readonly name = input.required<string>();

  protected readonly grants = this.api.teamGrants();
  private readonly types = this.api.types();
  protected readonly activeTypes = computed(() => valueOr(this.types, []).filter(({ retiredOn }) => !retiredOn));
  protected readonly theirs = computed(() => valueOr(this.grants, []).filter(({ employeeId }) => employeeId === this.employeeId()));
  protected readonly isGranting = signal(false);
  protected readonly money = money;
  protected readonly status = GRANT_STATUS;
  protected readonly formatShortDate = formatShortDate;

  protected granted() {
    this.isGranting.set(false);
    this.grants.reload();
  }
}
