import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { COMPANY } from '../../core/config';
import { Employee } from '../../models/employee';
import { formatFullDate } from '../../shared/utils/date-time';
import { initialsOf } from '../../shared/utils/initials';

interface IdCardRow {
  label: string;
  value: string;
  detail?: string;
}

// Both sides are sized in cqw, so the same markup prints at real ID card size (85.6 × 54 mm).
@Component({
  selector: 'app-id-card',
  template: `
    <div class="grid justify-items-start gap-5 @3xl:grid-cols-2 print:grid-cols-1 print:gap-6">
      <article class="id-side" aria-label="ID card front" data-testid="id-card-front">
        <header class="flex items-center justify-between bg-sea px-[5cqw] py-[2.6cqw] text-on-sea">
          <span class="font-display text-[6cqw] leading-none font-bold tracking-tight">opro</span>
          <span class="text-[2.6cqw] tracking-[0.12em] uppercase">Staff ID</span>
        </header>
        <div class="flex flex-1 items-center gap-[4.5cqw] px-[5cqw]">
          <span class="grid size-[19cqw] shrink-0 place-items-center rounded-full bg-coral-soft text-[6.5cqw] font-medium text-coral" aria-hidden="true">
            {{ initials() }}
          </span>
          <div class="min-w-0">
            <p class="font-display text-[6.2cqw] leading-tight font-bold">{{ employee().fullName }}</p>
            <p class="mt-[0.8cqw] text-[3.4cqw]">{{ employee().designation }}</p>
            <p class="text-[3.2cqw] text-soft">{{ employee().department }}</p>
          </div>
        </div>
        <footer class="flex items-end justify-between border-t border-line px-[5cqw] py-[2.8cqw] text-[3cqw]">
          <span>
            <span class="block text-[2.4cqw] tracking-[0.1em] text-soft uppercase">Employee ID</span>
            <span class="text-[4cqw] font-medium tracking-wide" data-testid="id-card-number">{{ employee().id }}</span>
          </span>
          <span class="rounded-full bg-coral-soft px-[2.4cqw] py-[0.6cqw] font-medium text-coral">Blood {{ employee().bloodGroup }}</span>
        </footer>
      </article>

      <article class="id-side" aria-label="ID card back" data-testid="id-card-back">
        <dl class="grid flex-1 grid-cols-[auto_minmax(0,1fr)] content-center gap-x-[4cqw] gap-y-[1.6cqw] px-[5cqw] py-[4cqw] text-[3.1cqw]">
          @for (row of backRows(); track row.label) {
            <dt class="text-soft">{{ row.label }}</dt>
            <dd class="min-w-0">
              <span class="block truncate">{{ row.value }}</span>
              @if (row.detail) {
                <span class="block">{{ row.detail }}</span>
              }
            </dd>
          }
        </dl>
        <footer class="border-t border-line px-[5cqw] py-[2.4cqw] text-[2.6cqw] text-soft">
          If found, please return to {{ company.name }}, {{ company.address }}.
        </footer>
      </article>
    </div>
  `,
  host: { class: '@container block' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IdCard {
  readonly employee = input.required<Employee>();

  protected readonly company = COMPANY;
  protected readonly initials = computed(() => initialsOf(this.employee().fullName));
  protected readonly backRows = computed<IdCardRow[]>(() => {
    const { email, phone, joinedOn, workLocation, emergencyContact } = this.employee();
    return [
      { label: 'Email', value: email },
      { label: 'Phone', value: phone },
      { label: 'Based at', value: workLocation },
      { label: 'Joined', value: formatFullDate(joinedOn) },
      { label: 'In an emergency', value: `${emergencyContact.name}, ${emergencyContact.relation.toLowerCase()}`, detail: emergencyContact.phone },
    ];
  });
}
