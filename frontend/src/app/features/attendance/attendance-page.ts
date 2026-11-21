import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Session } from '../../core/session';
import { Dialog } from '../../shared/ui/dialog';
import { Icon } from '../../shared/ui/icon';
import { ListSkeleton } from '../../shared/ui/list-skeleton';
import { MonthPicker } from '../../shared/ui/month-picker';
import { SuccessState } from '../../shared/ui/success-state';
import { downloadCsv } from '../../shared/utils/csv';
import { formatMonth, maldivesToday, monthOf } from '../../shared/utils/date-time';
import { valueOr } from '../../shared/utils/resource';
import { AttendanceApi } from './attendance-api';
import { toAttendanceRow } from './attendance-rows';
import { summarise } from './attendance-summary';
import { AttendanceTable } from './attendance-table';
import { CorrectionForm } from './correction-form';
import { CorrectionList } from './correction-list';
import { PunchButton } from './punch-button';
import { SummaryRow } from './summary-row';

@Component({
  selector: 'app-attendance-page',
  imports: [AttendanceTable, CorrectionForm, CorrectionList, Dialog, Icon, ListSkeleton, MonthPicker, PunchButton, SuccessState, SummaryRow],
  template: `
    <div class="page-view">
      <div class="page-title">
        <div>
          <span class="eyebrow">ATTENDANCE RECORDS</span>
          <h1>My attendance</h1>
          <p>Review your punches, work hours and monthly attendance record.</p>
        </div>
        <div class="title-actions">
          <button type="button" class="secondary-button" (click)="isFixing.set(true)" data-testid="open-fix">Fix a punch</button>
          <button type="button" class="download-button" (click)="exportReport()" data-testid="export-report"><app-icon name="download" [size]="17" /> Export report</button>
          @if (todayRecord(); as day) {
            <app-punch-button [day]="day" (punched)="todayPunched()" />
          }
        </div>
      </div>

      @if (attendance.error()) {
        <p class="attendance-off">This month's attendance didn't load. Refresh the page to try again.</p>
      } @else {
        <app-summary-row [summary]="summary()" [overtimeClaims]="monthOvertime()" />
        <section class="card full-table">
          <div class="card-heading">
            <div>
              <span class="eyebrow">{{ monthLabel() }}</span>
              <h2>Attendance log</h2>
            </div>
            <app-month-picker [(month)]="month" [latest]="currentMonth" />
          </div>
          @if (attendance.isLoading() && rows().length === 0) {
            <app-list-skeleton [count]="5" />
          } @else {
            <app-attendance-table [rows]="rows()" />
          }
        </section>
      }

      @if (corrections.error()) {
        <p class="attendance-off">Your punch fixes didn't load. Refresh the page to try again.</p>
      } @else {
        <app-correction-list [corrections]="correctionList()" />
      }
    </div>

    <app-dialog heading="Fix a punch" [(isOpen)]="isFixing">
      @if (wasRaised()) {
        @if (isSuperAdmin()) {
          <app-success-state heading="Punch fixed" body="It’s on your record now, as yours need nobody’s sign off." (done)="closeFix()" />
        } @else {
          <app-success-state heading="Fix requested" body="Your manager has been told. You'll see the decision here and in your notifications." (done)="closeFix()" />
        }
      } @else {
        <app-correction-form [date]="today" (raised)="onRaised()" (cancelled)="closeFix()" />
      }
    </app-dialog>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AttendancePage {
  private readonly api = inject(AttendanceApi);
  protected readonly isSuperAdmin = inject(Session).isSuperAdmin;

  protected readonly today = maldivesToday();
  protected readonly currentMonth = monthOf(this.today);
  protected readonly month = signal(this.currentMonth);
  protected readonly monthLabel = computed(() => formatMonth(this.month()).toUpperCase());
  private readonly overtime = this.api.overtime();
  protected readonly monthOvertime = computed(() => valueOr(this.overtime, []).filter(({ date }) => date.startsWith(this.month())));

  protected readonly attendance = this.api.month(this.month);
  protected readonly corrections = this.api.corrections();
  protected readonly correctionList = computed(() => valueOr(this.corrections, []));

  private readonly days = computed(() => valueOr(this.attendance, []).filter(({ date }) => date <= this.today));
  // Punching lives with this month's log, so it only shows while today is on screen.
  protected readonly todayRecord = computed(() => this.days().find(({ date }) => date === this.today));
  protected readonly summary = computed(() => summarise(this.days()));
  protected readonly rows = computed(() =>
    this.days()
      .filter(({ status }) => status !== 'weekend')
      .sort((first, second) => second.date.localeCompare(first.date))
      .map((day) => toAttendanceRow(day, this.today)),
  );

  protected readonly isFixing = signal(false);
  protected readonly wasRaised = signal(false);

  protected todayPunched() {
    this.attendance.reload();
  }

  protected onRaised() {
    this.wasRaised.set(true);
    this.corrections.reload();
  }

  protected closeFix() {
    this.isFixing.set(false);
    this.wasRaised.set(false);
  }

  protected exportReport() {
    downloadCsv(`attendance-${this.month()}.csv`, [
      ['Date', 'Day', 'Punch in', 'Punch out', 'Work hours', 'Status'],
      ...this.rows().map((row) => [row.date, row.day, row.punchIn, row.punchOut, row.hours, row.status.label]),
    ]);
  }
}
