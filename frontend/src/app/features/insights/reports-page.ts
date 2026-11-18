import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Icon } from '../../shared/ui/icon';
import { ListSkeleton } from '../../shared/ui/list-skeleton';
import { MonthPicker } from '../../shared/ui/month-picker';
import { maldivesToday, monthOf, yearOf } from '../../shared/utils/date-time';
import { ExportFormat, exportReport } from '../../shared/utils/export';
import { valueOr } from '../../shared/utils/resource';
import { LeaveApi } from '../leave/leave-api';
import { InsightsApi } from './insights-api';
import { buildReport, MIX_BY, MixBy, ReportKind, REPORTS } from './reports';

const FORMATS: readonly { value: ExportFormat; label: string }[] = [
  { value: 'csv', label: 'CSV' },
  { value: 'xlsx', label: 'Excel' },
  { value: 'pdf', label: 'PDF' },
];
const YEARS_BACK = 2;

// Every report as a table to check on screen, then save as CSV, Excel or PDF. Shared by HR and super admins.
@Component({
  selector: 'app-reports-page',
  imports: [Icon, ListSkeleton, MonthPicker],
  template: `
    <div class="page-view">
      <div class="page-title">
        <div>
          <span class="eyebrow">REPORTS</span>
          <h1>Reports</h1>
          <p>Pick a report, check it on screen, then save it as CSV, Excel or PDF. What you see is exactly what you get.</p>
        </div>
      </div>

      <section class="card all-requests">
        <div class="request-tabs" role="tablist" aria-label="Report">
          @for (report of reports; track report.kind) {
            <button type="button" role="tab" [class.active]="kind() === report.kind" [attr.aria-selected]="kind() === report.kind" (click)="kind.set(report.kind)" [attr.data-testid]="'report-' + report.kind">{{ report.label }}</button>
          }
        </div>
        <p class="card-text">{{ about() }}</p>

        <div class="report-tools">
          @if (kind() === 'movement' || kind() === 'leave') {
            <label class="filter-chip">
              <select #picked aria-label="Year" (change)="year.set(+picked.value)" data-testid="report-year">
                @for (option of years; track option) {
                  <option [value]="option" [selected]="option === year()">{{ option }}</option>
                }
              </select>
            </label>
          } @else if (kind() === 'attendance') {
            <app-month-picker [(month)]="month" [latest]="currentMonth" />
          } @else if (kind() === 'mix') {
            <label class="filter-chip">
              <select #by aria-label="Group by" (change)="mixBy.set(asMixBy(by.value))" data-testid="mix-by">
                @for (option of mixOptions; track option.value) {
                  <option [value]="option.value" [selected]="option.value === mixBy()">By {{ option.label.toLowerCase() }}</option>
                }
              </select>
            </label>
          }
          <span class="report-exports">
            @for (format of formats; track format.value) {
              <button type="button" class="download-button" [disabled]="!table() || busy()" (click)="save(format.value)" [attr.data-testid]="'export-' + format.value">
                <app-icon name="download" [size]="16" /> {{ format.label }}
              </button>
            }
          </span>
        </div>
        @if (failed()) {
          <p class="row-error" role="alert">That didn't save. Try again in a moment.</p>
        }

        @if (facts.error()) {
          <p class="attendance-off">The reports didn't load. Refresh the page to try again.</p>
        } @else if (!table()) {
          <app-list-skeleton [count]="4" />
        } @else if (table(); as report) {
          <div class="table-wrap">
            <table class="stacks" data-testid="report-table">
              <caption class="sr-only">{{ report.title }}</caption>
              <thead>
                <tr>
                  @for (column of report.columns; track $index) {
                    <th scope="col">{{ column }}</th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (row of report.rows; track $index) {
                  <tr data-testid="report-row">
                    @for (cell of row; track $index) {
                      <td [attr.data-label]="report.columns[$index]">{{ cell }}</td>
                    }
                  </tr>
                } @empty {
                  <tr><td [attr.colspan]="report.columns.length">Nothing for this period.</td></tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsPage {
  private readonly api = inject(InsightsApi);
  private readonly today = maldivesToday();

  protected readonly reports = REPORTS;
  protected readonly formats = FORMATS;
  protected readonly mixOptions = MIX_BY;
  protected readonly currentMonth = monthOf(this.today);
  protected readonly years = Array.from({ length: YEARS_BACK }, (_, index) => yearOf(this.today) - index);

  protected readonly kind = signal<ReportKind>('headcount');
  protected readonly year = signal(yearOf(this.today));
  protected readonly month = signal(this.currentMonth);
  protected readonly mixBy = signal<MixBy>('department');
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);

  protected readonly facts = this.api.insights();
  private readonly attendance = this.api.attendance(() => (this.kind() === 'attendance' ? this.month() : undefined));
  private readonly types = inject(LeaveApi).types();

  protected readonly about = computed(() => REPORTS.find(({ kind }) => kind === this.kind())?.about ?? '');
  protected readonly table = computed(() => {
    const facts = valueOr(this.facts, undefined);
    if (!facts || (this.kind() === 'attendance' && this.attendance.isLoading())) {
      return undefined;
    }
    const names = new Map(valueOr(this.types, []).map(({ code, name }) => [code, name]));
    return buildReport(this.kind(), facts, {
      year: this.year(),
      month: this.month(),
      mixBy: this.mixBy(),
      attendance: valueOr(this.attendance, []),
      typeName: (code) => names.get(code) ?? code,
    });
  });

  protected readonly asMixBy = (value: string) => MIX_BY.find((option) => option.value === value)?.value ?? 'department';

  protected async save(format: ExportFormat) {
    const table = this.table();
    if (!table) {
      return;
    }
    this.busy.set(true);
    this.failed.set(false);
    try {
      await exportReport(table, format);
    } catch (error) {
      console.error('Saving a report failed', error);
      this.failed.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
