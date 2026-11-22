import { ChangeDetectionStrategy, Component, computed, input, linkedSignal } from '@angular/core';
import { StatusPill, Tone } from '../../shared/ui/status-pill';

export interface AttendanceRow {
  date: string;
  day: string;
  dateLabel: string;
  punchIn: string;
  punchOut: string;
  hours: string;
  status: { label: string; tone: Tone };
  isEdited: boolean;
  homeNote?: string;
}

@Component({
  selector: 'app-attendance-table',
  imports: [StatusPill],
  template: `
    <div class="table-wrap">
      <table class="stacks">
        <thead>
          <tr>
            <th scope="col">DAY</th>
            <th scope="col">PUNCH IN</th>
            <th scope="col">PUNCH OUT</th>
            <th scope="col">WORK HOURS</th>
            <th scope="col">STATUS</th>
          </tr>
        </thead>
        <tbody>
          @for (row of shown(); track row.date) {
            <tr data-testid="attendance-row">
              <td>
                <strong>{{ row.day }}</strong>
                <span>{{ row.dateLabel }}</span>
              </td>
              <td data-label="PUNCH IN">{{ row.punchIn }}</td>
              <td data-label="PUNCH OUT">{{ row.punchOut }}</td>
              <td data-label="WORK HOURS"><b>{{ row.hours }}</b></td>
              <td data-label="STATUS">
                <app-status-pill [tone]="row.status.tone">{{ row.status.label }}</app-status-pill>
                @if (row.isEdited) {
                  <span class="edited-note" data-testid="corrected">Corrected</span>
                }
                @if (row.homeNote) {
                  <span class="edited-note" data-testid="home-day">{{ row.homeNote }}</span>
                }
              </td>
            </tr>
          } @empty {
            <tr>
              <td colspan="5">No punches recorded yet.</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
    @if (hidden() > 0) {
      <button type="button" class="text-link show-more" (click)="showMore()" data-testid="show-more-days">Show {{ nextCount() }} more {{ nextCount() === 1 ? 'day' : 'days' }}</button>
    } @else if (pageSize() && rows().length > (pageSize() ?? 0)) {
      <button type="button" class="text-link show-more" (click)="showFewer()" data-testid="show-fewer-days">Show fewer</button>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AttendanceTable {
  readonly rows = input.required<readonly AttendanceRow[]>();
  // When set, the log opens on this many days and grows by as many each time, so the sections below stay in reach.
  readonly pageSize = input<number>();

  // Back to the first page whenever the month changes.
  private readonly limit = linkedSignal({ source: this.rows, computation: () => this.pageSize() ?? Infinity });
  protected readonly shown = computed(() => this.rows().slice(0, this.limit()));
  protected readonly hidden = computed(() => this.rows().length - this.shown().length);
  protected readonly nextCount = computed(() => Math.min(this.hidden(), this.pageSize() ?? 0));

  protected showMore() {
    this.limit.update((limit) => limit + (this.pageSize() ?? 0));
  }

  protected showFewer() {
    this.limit.set(this.pageSize() ?? Infinity);
  }
}
