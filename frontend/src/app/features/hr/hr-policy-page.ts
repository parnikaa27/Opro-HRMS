import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { LeaveType } from '../../models/leave';
import { Dialog } from '../../shared/ui/dialog';
import { ListSkeleton } from '../../shared/ui/list-skeleton';
import { valueOr } from '../../shared/utils/resource';
import { plural } from '../../shared/utils/text';
import { PolicyForm } from './forms/policy-form';
import { HrApi } from './hr-api';
import { WorkScheduleCard } from './work-schedule-card';

@Component({
  selector: 'app-hr-policy-page',
  imports: [Dialog, ListSkeleton, PolicyForm, WorkScheduleCard],
  template: `
    <div class="page-view">
      <div class="page-title">
        <div>
          <span class="eyebrow">PEOPLE &amp; CULTURE</span>
          <h1>Policies</h1>
          <p>Leave each person gets a year, and the hours everyone works. A new entitlement applies from the next leave year. To change one person's balance now, adjust it from their page.</p>
        </div>
      </div>
      @if (types.error()) {
        <p class="attendance-off">The leave policy didn't load. Refresh the page to try again.</p>
      } @else if (types.isLoading() && list().length === 0) {
        <app-list-skeleton [count]="4" />
      } @else {
        <section class="card full-table">
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th scope="col">LEAVE TYPE</th><th scope="col">DAYS PER YEAR</th><th scope="col">HALF DAYS</th><th scope="col"><span class="sr-only">Actions</span></th></tr>
              </thead>
              <tbody>
                @for (type of list(); track type.code) {
                  <tr data-testid="policy-row">
                    <td><strong>{{ type.name }}</strong></td>
                    <td>{{ type.isUnlimited ? 'No limit' : plural(type.defaultEntitlement ?? 0, 'day') }}</td>
                    <td>{{ type.allowsHalfDay ? 'Allowed' : 'Full days only' }}</td>
                    <td><button type="button" class="text-link" (click)="editing.set(type)" data-testid="edit-policy">Edit</button></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      }
      <app-work-schedule-card />
    </div>

    <app-dialog heading="Leave type" [isOpen]="editing() !== undefined" (isOpenChange)="$event || editing.set(undefined)">
      @if (editing(); as type) {
        <app-policy-form [type]="type" (saved)="saved()" (cancelled)="editing.set(undefined)" />
      }
    </app-dialog>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HrPolicyPage {
  protected readonly types = inject(HrApi).leaveTypes();
  protected readonly editing = signal<LeaveType | undefined>(undefined);
  protected readonly list = computed(() => valueOr(this.types, []));
  protected readonly plural = plural;

  protected saved() {
    this.editing.set(undefined);
    this.types.reload();
  }
}
