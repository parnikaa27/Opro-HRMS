import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { COMP_OFF, LeaveType } from '../../models/leave';
import { ConfirmButton } from '../../shared/ui/confirm-button';
import { Dialog } from '../../shared/ui/dialog';
import { ListSkeleton } from '../../shared/ui/list-skeleton';
import { valueOr } from '../../shared/utils/resource';
import { plural } from '../../shared/utils/text';
import { ExchangeRatesCard } from './exchange-rates-card';
import { PolicyForm } from './forms/policy-form';
import { HrApi } from './hr-api';
import { WorkScheduleCard } from './work-schedule-card';

// Editing means a type is open in the form. "new" means adding one.
type Editing = LeaveType | 'new' | undefined;

@Component({
  selector: 'app-hr-policy-page',
  imports: [ConfirmButton, Dialog, ExchangeRatesCard, ListSkeleton, PolicyForm, WorkScheduleCard],
  template: `
    <div class="page-view">
      <div class="page-title">
        <div>
          <span class="eyebrow">PEOPLE &amp; CULTURE</span>
          <h1>Policies</h1>
          <p>Leave each person gets a year, the hours everyone works, and the rates for flight allowances. To change one person's leave, go to their page.</p>
        </div>
        <div class="title-actions">
          <button type="button" class="primary-button compact" (click)="editing.set('new')" data-testid="add-policy">Add leave type</button>
        </div>
      </div>
      @if (types.error()) {
        <p class="attendance-off">The leave policy didn't load. Refresh the page to try again.</p>
      } @else if (types.isLoading() && list().length === 0) {
        <app-list-skeleton [count]="4" />
      } @else {
        <section class="card full-table">
          <div class="table-wrap">
            <table class="stacks">
              <thead>
                <tr>
                  <th scope="col">LEAVE TYPE</th><th scope="col">DAYS PER YEAR</th><th scope="col">HALF DAYS</th><th scope="col">GIVEN TO</th><th scope="col">AT YEAR END</th>
                  <th scope="col"><span class="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                @for (type of list(); track type.code) {
                  <tr data-testid="policy-row">
                    <td><strong>{{ type.name }}</strong></td>
                    <td data-label="DAYS PER YEAR">{{ daysLabel(type) }}</td>
                    <td data-label="HALF DAYS">{{ type.allowsHalfDay ? 'Allowed' : 'Full days only' }}</td>
                    <td data-label="GIVEN TO">{{ type.code === compOff ? 'Earned by working days off' : type.isForEveryone ? 'Everyone' : 'People HR picks' }}</td>
                    <td data-label="AT YEAR END">{{ type.isUnlimited ? '' : type.carriesForward ? 'Carries up to ' + plural(type.carryForwardCap ?? 0, 'day') : 'Lapses' }}</td>
                    <td class="row-actions">
                      @if (type.code !== compOff) {
                        <button type="button" class="text-link" (click)="editing.set(type)" data-testid="edit-policy">Edit</button>
                        <app-confirm-button label="Remove" [question]="'Remove ' + type.name.toLowerCase() + '?'" yes="Yes, remove it" testId="remove-policy" (confirmed)="remove(type)" />
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <p class="table-note">Removing a type nobody has used deletes it. A used one is retired: nobody can book it, and past leave keeps its name.</p>
          @if (removeFailed()) {
            <p class="row-error" role="alert">That didn't remove. Try again in a moment.</p>
          }
        </section>
      }
      <app-work-schedule-card />
      <app-exchange-rates-card />
    </div>

    <app-dialog heading="Leave type" [isOpen]="editing() !== undefined" (isOpenChange)="$event || editing.set(undefined)">
      @if (editing(); as open) {
        <app-policy-form [type]="open === 'new' ? undefined : open" (saved)="saved()" (cancelled)="editing.set(undefined)" />
      }
    </app-dialog>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HrPolicyPage {
  private readonly api = inject(HrApi);
  protected readonly types = this.api.leaveTypes();
  protected readonly editing = signal<Editing>(undefined);
  protected readonly removeFailed = signal(false);
  protected readonly list = computed(() => valueOr(this.types, []).filter(({ retiredOn }) => !retiredOn));
  protected readonly compOff = COMP_OFF;
  protected readonly plural = plural;
  protected readonly daysLabel = (type: LeaveType) =>
    type.isUnlimited ? 'No limit' : type.code === COMP_OFF ? 'Earned' : plural(type.defaultEntitlement ?? 0, 'day');

  protected saved() {
    this.editing.set(undefined);
    this.types.reload();
  }

  protected async remove({ code }: LeaveType) {
    this.removeFailed.set(false);
    try {
      await this.api.removeLeaveType(code);
      this.types.reload();
    } catch (error) {
      console.error('Removing a leave type failed', error);
      this.removeFailed.set(true);
    }
  }
}
