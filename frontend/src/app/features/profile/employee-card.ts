import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Employee } from '../../models/employee';
import { Icon } from '../../shared/ui/icon';
import { Logo } from '../../shared/ui/logo';
import { initialsOf } from '../../shared/utils/initials';

// The dark staff card from the design. The printable two sided card lives in IdCard.
@Component({
  selector: 'app-employee-card',
  imports: [Icon, Logo],
  template: `
    <section class="id-card" aria-label="Staff card" data-testid="employee-card">
      <div class="id-top">
        <app-logo [isCompact]="true" />
        <span>EMPLOYEE</span>
      </div>
      <div class="id-profile">
        <div class="portrait-wrap">
          <div class="portrait-initials" aria-hidden="true">{{ initials() }}</div>
          <i></i>
        </div>
        <div>
          <h2>{{ employee().fullName }}</h2>
          <p>{{ employee().designation }}</p>
          <span data-testid="employee-id">{{ employee().id }}</span>
        </div>
      </div>
      <div class="id-details">
        <div><app-icon name="mail" [size]="15" /><span>{{ employee().email }}</span></div>
        <div><app-icon name="phone" [size]="15" /><span>{{ employee().phone }}</span></div>
        <div><app-icon name="briefcase" [size]="15" /><span>{{ employee().department }} · {{ employee().employmentType }}</span></div>
      </div>
      <div class="id-footer">
        <span><app-icon name="badgeCheck" [size]="15" /> Active employee</span>
        <b>OPRO · MALDIVES</b>
      </div>
    </section>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmployeeCard {
  readonly employee = input.required<Employee>();
  protected readonly initials = computed(() => initialsOf(this.employee().fullName));
}
