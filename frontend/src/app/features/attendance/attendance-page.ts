import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AttendanceDay, AttendanceStatus } from '../../models/attendance';
import { Dialog } from '../../shared/ui/dialog';
import { MonthSwitcher } from '../../shared/ui/month-switcher';
import { formatDuration, maldivesToday, monthOf } from '../../shared/utils/date-time';
import { valueOr } from '../../shared/utils/resource';
import { AttendanceApi } from './attendance-api';
import { AttendanceDays, FixRequest } from './attendance-days';
import { CorrectionForm } from './correction-form';
import { CorrectionList } from './correction-list';
import { ListSkeleton } from '../../shared/ui/list-skeleton';

@Component({
  selector: 'app-attendance-page',
  imports: [ListSkeleton, Dialog, MonthSwitcher, AttendanceDays, CorrectionForm, CorrectionList],
  template: `
    <header class="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="font-display text-3xl tracking-tight sm:text-4xl">Attendance</h1>
        <p class="mt-2 text-soft">Every punch the device recorded, day by day.</p>
      </div>
      <button type="button" class="btn-primary" (click)="openFix({ date: today, kind: 'missed-out' })" data-testid="open-fix">Fix a punch</button>
    </header>

    <app-month-switcher class="mb-4 block" [(month)]="month" [latest]="currentMonth" />

    @if (attendance.error()) {
      <p class="text-sm text-danger">This month's attendance didn't load. Refresh the page to try again.</p>
    } @else if (attendance.isLoading() && days().length === 0) {
      <app-list-skeleton [count]="5" />
    } @else {
      <div class="@container mb-4">
        <dl class="grid grid-cols-2 gap-3 @md:grid-cols-3 @4xl:grid-cols-6" [attr.aria-busy]="attendance.isLoading()">
          @for (stat of summary(); track stat.label) {
            <div class="rounded-2xl bg-card px-4 py-3 shadow-lift">
              <dt class="eyebrow">{{ stat.label }}</dt>
              <dd class="mt-1 text-2xl font-medium whitespace-nowrap" [attr.data-testid]="'stat-' + stat.key">{{ stat.value }}</dd>
            </div>
          }
        </dl>
      </div>
      <app-attendance-days [days]="days()" (fix)="openFix($event)" />
    }

    <section class="mt-10" aria-labelledby="fixes-heading">
      <h2 id="fixes-heading" class="eyebrow mb-3">Punch fixes you asked for</h2>
      @if (corrections.error()) {
        <p class="text-sm text-danger">These didn't load. Refresh the page to try again.</p>
      } @else if (corrections.isLoading() && correctionList().length === 0) {
        <app-list-skeleton [count]="2" />
      } @else {
        <app-correction-list [corrections]="correctionList()" />
      }
    </section>

    <app-dialog heading="Fix a punch" [(isOpen)]="isFixing">
      <app-correction-form [date]="fixing().date" [kind]="fixing().kind" (raised)="onRaised()" />
    </app-dialog>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AttendancePage {
  private readonly api = inject(AttendanceApi);

  protected readonly today = maldivesToday();
  protected readonly currentMonth = monthOf(this.today);
  protected readonly month = signal(this.currentMonth);

  protected readonly attendance = this.api.month(this.month);
  protected readonly corrections = this.api.corrections();
  protected readonly correctionList = computed(() => valueOr(this.corrections, []));

  protected readonly days = computed(() =>
    valueOr(this.attendance, [])
      .filter((day) => day.date <= this.today)
      .sort((first, second) => second.date.localeCompare(first.date)),
  );

  protected readonly summary = computed(() => {
    const days = this.days();
    const count = (statuses: AttendanceStatus[]) => String(days.filter((day) => statuses.includes(day.status)).length);
    const total = (pick: (day: AttendanceDay) => number) => formatDuration(days.reduce((sum, day) => sum + pick(day), 0));
    return [
      { key: 'on-time', label: 'On time', value: count(['present']) },
      { key: 'late', label: 'Late', value: count(['late', 'half-day']) },
      { key: 'missed', label: 'Missed', value: count(['absent', 'incomplete']) },
      { key: 'leave', label: 'On leave', value: count(['on-leave']) },
      { key: 'worked', label: 'Worked', value: total((day) => day.workedMinutes) },
      { key: 'overtime', label: 'Overtime', value: total((day) => day.overtimeMinutes) },
    ];
  });

  protected readonly isFixing = signal(false);
  protected readonly fixing = signal<FixRequest>({ date: this.today, kind: 'missed-out' });

  protected openFix(request: FixRequest) {
    this.fixing.set(request);
    this.isFixing.set(true);
  }

  protected onRaised() {
    this.isFixing.set(false);
    this.corrections.reload();
  }
}
