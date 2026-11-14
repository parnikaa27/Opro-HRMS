import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CompanyEvent, Holiday } from '../../models/company';
import { ConfirmButton } from '../../shared/ui/confirm-button';
import { Dialog } from '../../shared/ui/dialog';
import { Icon } from '../../shared/ui/icon';
import { ListSkeleton } from '../../shared/ui/list-skeleton';
import { StatusPill } from '../../shared/ui/status-pill';
import { formatDayShort, maldivesToday, yearOf } from '../../shared/utils/date-time';
import { valueOr } from '../../shared/utils/resource';
import { DecisionState } from '../team/decision-state';
import { HolidaysApi } from '../holidays/holidays-api';
import { EventForm } from './forms/event-form';
import { HolidayForm } from './forms/holiday-form';
import { HrApi } from './hr-api';

type Editing = { kind: 'holiday'; item?: Holiday } | { kind: 'event'; item?: CompanyEvent };

const byDate = <T extends { date: string }>(items: readonly T[]) => [...items].sort((first, second) => first.date.localeCompare(second.date));

@Component({
  selector: 'app-hr-calendar-page',
  imports: [ConfirmButton, Dialog, EventForm, HolidayForm, Icon, ListSkeleton, StatusPill],
  template: `
    <div class="page-view">
      <div class="page-title">
        <div>
          <span class="eyebrow">COMPANY CALENDAR</span>
          <h1>Holidays &amp; events</h1>
          <p>Everyone sees these on their calendar. Leave never counts a public holiday.</p>
        </div>
        <div class="calendar-nav">
          <button type="button" [attr.aria-label]="'Show ' + (year() - 1)" (click)="year.set(year() - 1)" data-testid="previous-year"><app-icon name="chevronLeft" /></button>
          <strong aria-live="polite" data-testid="year-label">{{ year() }}</strong>
          <button type="button" [attr.aria-label]="'Show ' + (year() + 1)" (click)="year.set(year() + 1)" data-testid="next-year"><app-icon name="chevronRight" /></button>
        </div>
      </div>

      <div class="employee-grid">
        <section class="card request-history">
          <div class="card-heading">
            <div><span class="eyebrow">{{ year() }}</span><h2>Public holidays</h2></div>
            <button type="button" class="primary-button compact" (click)="editing.set({ kind: 'holiday' })" data-testid="add-holiday"><app-icon name="plus" [size]="17" /> Add holiday</button>
          </div>
          @if (holidays.error()) {
            <p class="attendance-off">Holidays didn't load. Refresh the page to try again.</p>
          } @else if (holidays.isLoading() && holidayList().length === 0) {
            <app-list-skeleton [count]="4" />
          } @else {
            @for (holiday of holidayList(); track holiday.id) {
              <div class="history-row" data-testid="holiday-row">
                <div class="leave-type-icon"><app-icon name="calendar" [size]="18" /></div>
                <div>
                  <strong>{{ holiday.name }}</strong>
                  <span>{{ formatDayShort(holiday.date) }}</span>
                  <div class="row-actions">
                    @if (holiday.isTentative) {
                      <button type="button" class="text-link" [disabled]="rows.busyId() === holiday.id" (click)="confirm(holiday)" data-testid="confirm-holiday">Confirm date</button>
                    }
                    <button type="button" class="text-link" (click)="editing.set({ kind: 'holiday', item: holiday })" data-testid="edit-holiday">Edit</button>
                    <app-confirm-button label="Delete" [question]="'Delete ' + holiday.name + '?'" (confirmed)="remove(holiday.id, 'holiday')" />
                  </div>
                  @if (rows.failedId() === holiday.id) {
                    <p class="row-error" role="alert">That didn't save. Try again in a moment.</p>
                  }
                </div>
                <span></span>
                <app-status-pill [tone]="holiday.isTentative ? 'late' : 'ok'">{{ holiday.isTentative ? 'Tentative' : 'Confirmed' }}</app-status-pill>
              </div>
            } @empty {
              <div class="attendance-off">
                <strong>No holidays for {{ year() }} yet</strong>
                Start with the fixed civil holidays, then add the Islamic dates as they're announced.
                <div class="row-actions">
                  <button type="button" class="text-link" [disabled]="isStarting()" (click)="startYear()" data-testid="start-year">Add the civil holidays for {{ year() }}</button>
                </div>
                @if (startFailed()) {
                  <p class="row-error" role="alert">That didn't save. Try again in a moment.</p>
                }
              </div>
            }
          }
        </section>

        <section class="card request-history">
          <div class="card-heading">
            <div><span class="eyebrow">{{ year() }}</span><h2>Company events</h2></div>
            <button type="button" class="secondary-button" (click)="editing.set({ kind: 'event' })" data-testid="add-event">Add event</button>
          </div>
          @for (event of eventList(); track event.id) {
            <div class="history-row" data-testid="event-row">
              <div class="leave-type-icon"><app-icon name="sparkles" [size]="18" /></div>
              <div>
                <strong>{{ event.name }}</strong>
                <span>{{ formatDayShort(event.date) }}</span>
                <div class="row-actions">
                  <button type="button" class="text-link" (click)="editing.set({ kind: 'event', item: event })" data-testid="edit-event">Edit</button>
                  <app-confirm-button label="Delete" [question]="'Delete ' + event.name + '?'" (confirmed)="remove(event.id, 'event')" />
                </div>
                @if (rows.failedId() === event.id) {
                  <p class="row-error" role="alert">That didn't save. Try again in a moment.</p>
                }
              </div>
              <span></span>
              <span></span>
            </div>
          } @empty {
            <p class="attendance-off">No company events in {{ year() }}.</p>
          }
        </section>
      </div>
    </div>

    <app-dialog [heading]="editing()?.kind === 'event' ? 'Company event' : 'Public holiday'" [isOpen]="editing() !== undefined" (isOpenChange)="$event || editing.set(undefined)">
      @switch (editing()?.kind) {
        @case ('holiday') {
          <app-holiday-form [holiday]="editingHoliday()" (saved)="saved()" (cancelled)="editing.set(undefined)" />
        }
        @case ('event') {
          <app-event-form [event]="editingEvent()" (saved)="saved()" (cancelled)="editing.set(undefined)" />
        }
      }
    </app-dialog>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HrCalendarPage {
  private readonly hr = inject(HrApi);
  private readonly api = inject(HolidaysApi);

  protected readonly year = signal(yearOf(maldivesToday()));
  protected readonly holidays = this.api.forYear(() => String(this.year()));
  private readonly events = this.api.eventsForYear(() => String(this.year()));
  protected readonly rows = new DecisionState();
  protected readonly editing = signal<Editing | undefined>(undefined);
  protected readonly isStarting = signal(false);
  protected readonly startFailed = signal(false);

  protected readonly holidayList = computed(() => byDate(valueOr(this.holidays, [])));
  protected readonly eventList = computed(() => byDate(valueOr(this.events, [])));
  protected readonly editingHoliday = computed(() => {
    const editing = this.editing();
    return editing?.kind === 'holiday' ? editing.item : undefined;
  });
  protected readonly editingEvent = computed(() => {
    const editing = this.editing();
    return editing?.kind === 'event' ? editing.item : undefined;
  });
  protected readonly formatDayShort = formatDayShort;

  private readonly refresh = () => {
    this.holidays.reload();
    this.events.reload();
  };

  protected confirm(holiday: Holiday) {
    return this.rows.run(holiday.id, () => this.hr.saveHoliday({ ...holiday, isTentative: false }), this.refresh);
  }

  protected remove(id: string, kind: 'holiday' | 'event') {
    return this.rows.run(id, () => (kind === 'holiday' ? this.hr.deleteHoliday(id) : this.hr.deleteEvent(id)), this.refresh);
  }

  protected async startYear() {
    this.isStarting.set(true);
    this.startFailed.set(false);
    try {
      await this.hr.startYear(this.year());
      this.holidays.reload();
    } catch (error) {
      console.error('Starting the holiday year failed', error);
      this.startFailed.set(true);
    } finally {
      this.isStarting.set(false);
    }
  }

  protected saved() {
    this.editing.set(undefined);
    this.refresh();
  }
}
