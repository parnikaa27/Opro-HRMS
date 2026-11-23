import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { MonthlyAllowance } from '../../models/allowance';
import { Dialog } from '../../shared/ui/dialog';
import { ListSkeleton } from '../../shared/ui/list-skeleton';
import { StatusPill } from '../../shared/ui/status-pill';
import { maldivesToday, monthOf } from '../../shared/utils/date-time';
import { valueOr } from '../../shared/utils/resource';
import { DecisionState } from '../team/decision-state';
import { AllowanceApi, describeMonthly, GRANT_STATUS, money } from './allowance-api';
import { MonthlyAllowanceForm } from './monthly-allowance-form';

// On HR's page for someone: their monthly allowances to add, change or stop, and their one-off grants. Never HR's own.
@Component({
  selector: 'app-hr-allowances-card',
  imports: [Dialog, ListSkeleton, MonthlyAllowanceForm, StatusPill],
  template: `
    <section class="card request-history" data-testid="hr-allowances">
      <div class="card-heading">
        <div><span class="eyebrow">On top of pay</span><h2>Allowances</h2></div>
        @if (!isOwn()) {
          <button type="button" class="secondary-button" (click)="editing.set('new')" data-testid="add-allowance">Add</button>
        }
      </div>
      @if (allowances.error()) {
        <p class="attendance-off">Their allowances didn't load. Refresh the page to try again.</p>
      } @else if (allowances.isLoading() && monthly().length === 0) {
        <app-list-skeleton [count]="2" />
      } @else {
        @for (allowance of monthly(); track allowance.id) {
          <div class="history-row exit-row" data-testid="hr-allowance">
            <div><strong>{{ allowance.typeName }}</strong><span>{{ describe(allowance, today) }}{{ allowance.note ? ' · ' + allowance.note : '' }}</span></div>
            <span></span>
            @if (!isOwn() && !allowance.endsOn) {
              <span class="row-actions">
                <button type="button" class="text-link" (click)="editing.set(allowance)" data-testid="change-allowance">Change</button>
                @if (allowance.startsOn <= today) {
                  <button type="button" class="text-link danger" [disabled]="decisions.busyId() === allowance.id" (click)="stop(allowance)" data-testid="stop-allowance">Stop after this month</button>
                }
              </span>
            } @else {
              <span></span>
            }
            @if (decisions.failedId() === allowance.id) {
              <p class="row-error" role="alert">That didn't save. Try again in a moment.</p>
            }
          </div>
        } @empty {
          <p class="attendance-off">No monthly allowances.</p>
        }
        @for (grant of grants(); track grant.id) {
          <div class="history-row exit-row" data-testid="hr-grant">
            <div><strong>{{ grant.typeName }}, {{ money(grant.amount, grant.currency) }} once</strong><span>{{ grant.reason }} · from {{ grant.grantedByName }}</span></div>
            <app-status-pill [tone]="grant.status === 'approved' ? 'ok' : grant.status === 'rejected' ? 'danger' : 'late'">{{ status[grant.status] }}</app-status-pill>
            <span></span>
          </div>
        }
      }
    </section>

    <app-dialog heading="Allowance" [isOpen]="editing() !== undefined" (isOpenChange)="$event || editing.set(undefined)">
      @if (editing(); as open) {
        <app-monthly-allowance-form [employeeId]="employeeId()" [types]="activeTypes()" [current]="open === 'new' ? undefined : open" (saved)="saved()" (cancelled)="editing.set(undefined)" />
      }
    </app-dialog>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HrAllowancesCard {
  private readonly api = inject(AllowanceApi);
  readonly employeeId = input.required<string>();
  readonly isOwn = input(false);

  protected readonly allowances = this.api.of(this.employeeId);
  private readonly types = this.api.types();
  protected readonly activeTypes = computed(() => valueOr(this.types, []).filter(({ retiredOn }) => !retiredOn));
  protected readonly monthly = computed(() => valueOr(this.allowances, { monthly: [], grants: [] }).monthly);
  protected readonly grants = computed(() => valueOr(this.allowances, { monthly: [], grants: [] }).grants);
  protected readonly editing = signal<MonthlyAllowance | 'new' | undefined>(undefined);
  protected readonly decisions = new DecisionState();
  protected readonly today = maldivesToday();
  protected readonly describe = describeMonthly;
  protected readonly money = money;
  protected readonly status = GRANT_STATUS;

  protected stop({ id, typeCode }: MonthlyAllowance) {
    return this.decisions.run(id, () => this.api.stopMonthly(this.employeeId(), typeCode, monthOf(this.today)), () => this.allowances.reload());
  }

  protected saved() {
    this.editing.set(undefined);
    this.allowances.reload();
  }
}
