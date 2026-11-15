import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { addMonths, formatMonth } from '../utils/date-time';
import { Icon } from './icon';

const MONTHS_SHOWN = 6;

// The design's date chip: pick one of the last few months.
@Component({
  selector: 'app-month-picker',
  imports: [Icon],
  template: `
    <label class="filter-chip">
      <app-icon name="calendar" [size]="16" />
      <select #picker aria-label="Month" [value]="month()" (change)="month.set(picker.value)" data-testid="month-picker">
        @for (option of months(); track option) {
          <option [value]="option" [selected]="option === month()">{{ formatMonth(option) }}</option>
        }
      </select>
      <app-icon name="chevronDown" [size]="14" />
    </label>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonthPicker {
  readonly month = model.required<string>();
  readonly latest = input.required<string>();
  protected readonly months = computed(() => Array.from({ length: MONTHS_SHOWN }, (_, index) => addMonths(this.latest(), -index)));
  protected readonly formatMonth = formatMonth;
}
