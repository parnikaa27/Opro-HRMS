import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
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
            @if (isEditable()) {
              <th scope="col"><span class="sr-only">Actions</span></th>
            }
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.date) {
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
              @if (isEditable()) {
                <td><button type="button" class="text-link" (click)="edit.emit(row.date)" data-testid="edit-punches">Fix punches</button></td>
              }
            </tr>
          } @empty {
            <tr>
              <td [attr.colspan]="isEditable() ? 6 : 5">No punches recorded yet.</td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AttendanceTable {
  readonly rows = input.required<readonly AttendanceRow[]>();
  // HR fixes punches from one person's page. Everyone else reads.
  readonly isEditable = input(false);
  readonly edit = output<string>();
}
