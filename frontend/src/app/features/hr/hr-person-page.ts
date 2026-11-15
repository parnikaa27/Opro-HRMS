import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConfirmButton } from '../../shared/ui/confirm-button';
import { Dialog } from '../../shared/ui/dialog';
import { Icon } from '../../shared/ui/icon';
import { ListSkeleton } from '../../shared/ui/list-skeleton';
import { SuccessState } from '../../shared/ui/success-state';
import { formatFullDate, formatShortDate, maldivesToday, monthOf, yearOf } from '../../shared/utils/date-time';
import { valueOr } from '../../shared/utils/resource';
import { plural } from '../../shared/utils/text';
import { toAttendanceRow } from '../attendance/attendance-rows';
import { AttendanceTable } from '../attendance/attendance-table';
import { VisaCard } from '../dashboard/visa-card';
import { HolidaysApi } from '../holidays/holidays-api';
import { LeaveBalances } from '../leave/leave-balances';
import { LeaveRequests } from '../leave/leave-requests';
import { EmployeeCard } from '../profile/employee-card';
import { TeamApi } from '../team/team-api';
import { AdjustBalanceForm } from './forms/adjust-balance-form';
import { LeaveDaysForm } from './forms/leave-days-form';
import { RecordLeaveForm } from './forms/record-leave-form';
import { LeavingForm } from './forms/leaving-form';
import { PhotoForm } from './forms/photo-form';
import { VisaForm } from './forms/visa-form';
import { HrApi } from './hr-api';
import { HrFlightCard } from './hr-flight-card';
import { PersonMenu } from './person-menu';
import { PunchEditor } from './punch-editor';

type Action = 'adjust' | 'record' | 'visa' | 'leaving' | 'days';

const SUCCESS: Record<Action, { heading: string; body: string }> = {
  adjust: { heading: 'Balance adjusted', body: 'The change and your reason are in their log below.' },
  days: { heading: 'Leave days saved', body: 'They’ve been told, and the change is in their log below.' },
  record: { heading: 'Leave recorded', body: 'It’s saved as approved and shows on their calendar.' },
  visa: { heading: 'Papers updated', body: 'Expiry warnings now follow the new dates.' },
  leaving: { heading: 'Last day saved', body: 'They keep access until then. Any leave booked after that day is cancelled.' },
};

@Component({
  selector: 'app-hr-person-page',
  imports: [AdjustBalanceForm, AttendanceTable, ConfirmButton, Dialog, EmployeeCard, HrFlightCard, Icon, LeaveBalances, LeaveDaysForm, LeaveRequests, LeavingForm, ListSkeleton, PersonMenu, PhotoForm, PunchEditor, RecordLeaveForm, RouterLink, SuccessState, VisaCard, VisaForm],
  template: `
    <div class="page-view">
      <a routerLink="/hr/people" class="text-link back-link"><app-icon name="chevronLeft" [size]="15" /> People</a>

      @if (isNotFound()) {
        <div class="page-title"><div><span class="eyebrow">PEOPLE</span><h1>Nobody by that ID</h1><p>Check the link, or find them on the People page.</p></div></div>
      } @else if (person.error()) {
        <p class="attendance-off">This person's details didn't load. Refresh the page to try again.</p>
      } @else if (person.isLoading() && !employee()) {
        <app-list-skeleton [count]="4" />
      } @else if (employee(); as employee) {
        <div class="page-title">
          <div>
            <span class="eyebrow">{{ employee.department }}</span>
            <h1>{{ employee.fullName }}</h1>
            <p>{{ employee.designation }}, {{ employee.workLocation }}</p>
          </div>
          <div class="title-actions">
            <!-- Both forms start from the leave types, so they wait for them rather than resetting under someone's typing. -->
            <button type="button" class="secondary-button" [disabled]="isTypesLoading()" (click)="action.set('days')" data-testid="open-days">Leave days</button>
            <button type="button" class="secondary-button" [disabled]="isTypesLoading()" (click)="action.set('adjust')" data-testid="open-adjust">Adjust balance</button>
            <button type="button" class="secondary-button" (click)="action.set('visa')" data-testid="open-visa">Update visa</button>
            <button type="button" class="primary-button compact" [disabled]="isTypesLoading()" (click)="action.set('record')" data-testid="open-record"><app-icon name="plus" [size]="17" /> Record leave</button>
            <app-person-menu [employeeId]="employee.id" [isLeaving]="employee.lastDay !== undefined" (leaving)="action.set('leaving')" (photo)="isChangingPhoto.set(true)" />
          </div>
        </div>
        @if (employee.lastDay; as lastDay) {
          <p class="leaving-note" data-testid="leaving-note">
            <strong>{{ lastDay < today ? 'Left on ' + formatFullDate(lastDay) : 'Last day ' + formatFullDate(lastDay) }}</strong>
            {{ employee.leavingReason }}
            @if (lastDay >= today) {
              <app-confirm-button label="They're staying" question="Cancel their leaving?" yes="Yes, they're staying" testId="cancel-leaving" (confirmed)="cancelLeaving(employee.id)" />
            }
            @if (cancelFailed()) {
              <span role="alert">That didn't save. Try again in a moment.</span>
            }
          </p>
        }

        <app-leave-balances [balances]="employee.leaveBalances" [types]="typeList()" />

        <div class="employee-grid">
          <div class="main-column">
            <section class="card full-table">
              <div class="card-heading"><div><span class="eyebrow">THIS MONTH</span><h2>Attendance log</h2></div></div>
              <app-attendance-table [rows]="rows()" [isEditable]="true" (edit)="editingDate.set($event)" />
            </section>
            <app-leave-requests [requests]="requests()" [types]="typeList()" [isReadOnly]="true" heading="Their leave requests" certificatePath="/api/hr/leave-requests" />
            <section class="card request-history">
              <div class="card-heading"><div><span class="eyebrow">AUDIT LOG</span><h2>Balance changes</h2></div></div>
              @for (change of adjustments(); track change.id) {
                <div class="history-row" data-testid="adjustment">
                  <div class="leave-type-icon"><app-icon name="file" [size]="18" /></div>
                  <div>
                    <strong>{{ change.days > 0 ? '+' : '' }}{{ plural(change.days, 'day') }} {{ typeName(change.type).toLowerCase() }}</strong>
                    <span>{{ change.reason }} · {{ change.byName ?? change.by }}, {{ formatShortDate(change.on) }}</span>
                  </div>
                  <span></span>
                  <span></span>
                </div>
              } @empty {
                <p class="attendance-off">No manual changes. Balances follow the leave policy.</p>
              }
            </section>
          </div>
          <div class="side-column">
            <app-employee-card [employee]="employee" />
            <app-visa-card [employee]="employee" reader="hr" />
            <app-hr-flight-card [employeeId]="employee.id" />
          </div>
        </div>

        <app-dialog heading="Photo" [isOpen]="isChangingPhoto()" (isOpenChange)="isChangingPhoto.set($event)">
          @if (isChangingPhoto()) {
            <app-photo-form [employeeId]="employee.id" [name]="employee.fullName" [photoUrl]="employee.photoUrl" (saved)="photoSaved()" (cancelled)="isChangingPhoto.set(false)" />
          }
        </app-dialog>

        <app-dialog heading="Fix punches" [isOpen]="editingDay() !== undefined" (isOpenChange)="$event || editingDate.set(undefined)">
          @if (editingDay(); as day) {
            <app-punch-editor [day]="day" [name]="employee.fullName" [edits]="editsFor(day.date)" (saved)="punchSaved()" (closed)="editingDate.set(undefined)" />
          }
        </app-dialog>

        <app-dialog heading="HR action" [isOpen]="action() !== undefined" (isOpenChange)="$event || close()">
          @if (done(); as finished) {
            <app-success-state [heading]="success[finished].heading" [body]="success[finished].body" (done)="close()" />
          } @else {
            @switch (action()) {
              @case ('days') {
                <app-leave-days-form [employeeId]="employee.id" [name]="employee.fullName" [types]="typeList()" [balances]="employee.leaveBalances" (saved)="finish('days')" (cancelled)="close()" />
              }
              @case ('adjust') {
                <app-adjust-balance-form [employeeId]="employee.id" [name]="employee.fullName" [types]="typeList()" (saved)="finish('adjust')" (cancelled)="close()" />
              }
              @case ('record') {
                <app-record-leave-form [employeeId]="employee.id" [name]="employee.fullName" [types]="recordTypes()" [holidays]="holidayDates()" (saved)="finish('record')" (cancelled)="close()" />
              }
              @case ('visa') {
                <app-visa-form [employeeId]="employee.id" [name]="employee.fullName" [visa]="employee.visa" (saved)="finish('visa')" (cancelled)="close()" />
              }
              @case ('leaving') {
                <app-leaving-form [employeeId]="employee.id" [name]="employee.fullName" [joinedOn]="employee.joinedOn" [reports]="reports()" (saved)="finish('leaving')" (cancelled)="close()" />
              }
            }
          }
        </app-dialog>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HrPersonPage {
  private readonly hr = inject(HrApi);
  private readonly holidaysApi = inject(HolidaysApi);
  protected readonly today = maldivesToday();

  readonly employeeId = input.required<string>();

  protected readonly person = this.hr.employee(this.employeeId);
  private readonly attendance = this.hr.attendance(this.employeeId, () => monthOf(this.today));
  private readonly punchEdits = this.hr.punchEdits(this.employeeId, () => monthOf(this.today));
  private readonly leave = inject(TeamApi).leaveRequests({ scope: () => 'hr' });
  private readonly types = this.hr.leaveTypes();
  private readonly everyone = this.hr.employees();
  private readonly thisYear = this.holidaysApi.forYear(() => String(yearOf(this.today)));
  private readonly nextYear = this.holidaysApi.forYear(() => String(yearOf(this.today) + 1));

  protected readonly action = signal<Action | undefined>(undefined);
  protected readonly done = signal<Action | undefined>(undefined);
  protected readonly editingDate = signal<string | undefined>(undefined);
  protected readonly isChangingPhoto = signal(false);
  protected readonly cancelFailed = signal(false);
  protected readonly editingDay = computed(() => valueOr(this.attendance, []).find(({ date }) => date === this.editingDate()));
  protected readonly success = SUCCESS;

  protected readonly employee = computed(() => valueOr(this.person, undefined));
  protected readonly isNotFound = computed(() => {
    const error = this.person.error()?.cause ?? this.person.error();
    return error instanceof HttpErrorResponse && error.status === HttpStatusCode.NotFound;
  });
  protected readonly typeList = computed(() => valueOr(this.types, []));
  protected readonly isTypesLoading = computed(() => this.types.isLoading());
  // Same rule as applying: only types they hold a balance for, plus unlimited ones.
  protected readonly recordTypes = computed(() => {
    const held = new Set(this.employee()?.leaveBalances.map(({ type }) => type));
    return this.typeList().filter(({ code, isUnlimited, retiredOn }) => !retiredOn && (isUnlimited || held.has(code)));
  });
  protected readonly holidayDates = computed(() => new Set([...valueOr(this.thisYear, []), ...valueOr(this.nextYear, [])].map(({ date }) => date)));
  protected readonly rows = computed(() =>
    valueOr(this.attendance, [])
      .filter((day) => day.date <= this.today && day.status !== 'weekend')
      .sort((first, second) => second.date.localeCompare(first.date))
      .map((day) => toAttendanceRow(day, this.today)),
  );
  protected readonly requests = computed(() => valueOr(this.leave, []).filter(({ employeeId }) => employeeId === this.employeeId()));
  protected readonly adjustments = computed(() => this.employee()?.adjustments ?? []);
  protected readonly reports = computed(() => valueOr(this.everyone, []).filter(({ managerId }) => managerId === this.employeeId()));

  protected readonly editsFor = (date: string) => valueOr(this.punchEdits, []).filter((change) => change.date === date);
  protected readonly typeName = (code: string) => this.typeList().find((type) => type.code === code)?.name ?? code;
  protected readonly formatShortDate = formatShortDate;
  protected readonly formatFullDate = formatFullDate;
  protected readonly plural = plural;

  protected finish(action: Action) {
    this.done.set(action);
    this.person.reload();
    if (action === 'record' || action === 'leaving') {
      this.leave.reload();
    }
  }

  protected async cancelLeaving(id: string) {
    this.cancelFailed.set(false);
    try {
      await this.hr.cancelLeaving(id);
      this.person.reload();
    } catch (error) {
      console.error('Cancelling a leaving date failed', error);
      this.cancelFailed.set(true);
    }
  }

  protected photoSaved() {
    this.isChangingPhoto.set(false);
    this.person.reload();
  }

  protected punchSaved() {
    this.attendance.reload();
    this.punchEdits.reload();
  }

  protected close() {
    this.action.set(undefined);
    this.done.set(undefined);
  }
}
