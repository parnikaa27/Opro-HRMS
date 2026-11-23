import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Employee } from '../../models/employee';
import { Icon } from '../../shared/ui/icon';
import { ListSkeleton } from '../../shared/ui/list-skeleton';
import { valueOr } from '../../shared/utils/resource';
import { EmployeeForm } from './forms/employee-form';
import { HrApi } from './hr-api';

// Adding someone, or editing their details. Long enough to deserve a page rather than a modal.
@Component({
  selector: 'app-hr-employee-page',
  imports: [EmployeeForm, Icon, ListSkeleton, RouterLink],
  template: `
    <div class="page-view">
      <a [routerLink]="backLink()" class="text-link back-link"><app-icon name="chevronLeft" [size]="15" /> {{ employeeId() ? 'Back to their page' : 'People' }}</a>
      <div class="page-title">
        <div>
          <span class="eyebrow">People</span>
          <h1>{{ heading() }}</h1>
          <p>{{ employeeId() ? 'Changes show on their profile and ID card straight away.' : 'They can sign in from their first day. Annual, sick and family leave start full.' }}</p>
        </div>
      </div>
      @if (person.error() || everyone.error()) {
        <p class="attendance-off">Their details didn't load. Refresh the page to try again.</p>
      } @else if (isLoading()) {
        <app-list-skeleton [count]="4" />
      } @else {
        <app-employee-form [employee]="employee()" [people]="people()" (saved)="open($event)" (cancelled)="back()" />
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HrEmployeePage {
  private readonly router = inject(Router);
  private readonly api = inject(HrApi);
  // From the route. Missing on /hr/people/new.
  readonly employeeId = input<string>();

  protected readonly everyone = this.api.employees();
  protected readonly person = this.api.employee(() => this.employeeId() ?? '', { isEnabled: () => this.employeeId() !== undefined });
  protected readonly employee = computed(() => valueOr(this.person, undefined));
  protected readonly people = computed(() => valueOr(this.everyone, []));
  protected readonly isLoading = computed(() => this.everyone.isLoading() || (this.employeeId() !== undefined && !this.employee()));
  protected readonly heading = computed(() => {
    const name = this.employee()?.fullName.split(' ')[0];
    return name ? `Edit ${name}’s details` : 'Add a person';
  });
  protected readonly backLink = computed(() => (this.employeeId() ? ['/hr/people', this.employeeId()] : ['/hr/people']));

  protected open({ id }: Employee) {
    return this.router.navigate(['/hr/people', id]);
  }

  protected back() {
    return this.router.navigate(this.backLink());
  }
}
