import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { Session } from '../../core/session';
import { AttendanceDay, WorkMode } from '../../models/attendance';
import { Dialog } from '../../shared/ui/dialog';
import { Icon } from '../../shared/ui/icon';
import { ModalHeading } from '../../shared/ui/modal-heading';
import { serverReason } from '../../shared/utils/form-submit';
import { currentLocation, LocationError } from '../../shared/utils/location';
import { AttendanceApi } from './attendance-api';

const FAILED = "That punch didn't save. Try again in a moment.";

// Punching in asks once where you're working. After that the day is set, so punching out is one tap.
@Component({
  selector: 'app-punch-button',
  imports: [Dialog, Icon, ModalHeading],
  template: `
    <button type="button" class="primary-button compact" [disabled]="busy() !== undefined" (click)="start()" data-testid="punch-button">
      <app-icon [name]="isIn() ? 'logout' : 'clock'" [size]="17" />
      {{ isLocating() ? 'Finding you…' : busy() ? 'Punching…' : isIn() ? 'Punch out' : 'Punch in' }}
    </button>
    @if (error() && !isChoosing()) {
      <p class="punch-error" role="alert" data-testid="punch-error">{{ error() }}</p>
    }

    <!-- Usually a punch in. A day that started with a punch added by hand asks on the way out instead. -->
    <app-dialog [heading]="isIn() ? 'Punch out' : 'Punch in'" [(isOpen)]="isChoosing">
      <app-modal-heading [eyebrow]="isIn() ? 'Punch out' : 'Punch in'" heading="Where are you working today?" intro="You choose once a day. Every punch that day follows the same choice." />
      <div class="work-mode-options">
        <button type="button" [disabled]="busy() !== undefined" (click)="punch('office')" data-testid="punch-office">
          <app-icon name="mapPin" [size]="22" />
          <strong>{{ busy() === 'office' ? 'Finding you…' : 'At the office' }}</strong>
          <span>Your location is checked once to confirm you're at an Opro office. It isn't stored.</span>
        </button>
        <button type="button" [disabled]="busy() !== undefined" (click)="punch('resort')" data-testid="punch-resort">
          <app-icon name="palm" [size]="22" />
          <strong>{{ busy() === 'resort' ? 'Finding you…' : 'At a resort' }}</strong>
          <span>Your location is checked once to confirm you're at a client resort. It isn't stored.</span>
        </button>
        <button type="button" [disabled]="busy() !== undefined" (click)="punch('home')" data-testid="punch-home">
          <app-icon name="house" [size]="22" />
          <strong>From home</strong>
          <span>No location needed.{{ isSuperAdmin() ? '' : ' Your manager approves the day afterwards.' }}</span>
        </button>
      </div>
      @if (error()) {
        <p class="punch-error" role="alert">{{ error() }}</p>
      }
    </app-dialog>
  `,
  host: { class: 'punch-control' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PunchButton {
  private readonly api = inject(AttendanceApi);
  protected readonly isSuperAdmin = inject(Session).isSuperAdmin;

  readonly day = input<AttendanceDay>();
  readonly punched = output<AttendanceDay>();

  protected readonly isChoosing = signal(false);
  protected readonly busy = signal<WorkMode | undefined>(undefined);
  protected readonly error = signal<string | undefined>(undefined);
  protected readonly isIn = computed(() => this.day()?.punches.at(-1)?.direction === 'in');
  // Office and resort punches need the phone's location. Home doesn't.
  protected readonly isLocating = computed(() => this.busy() !== undefined && this.busy() !== 'home');

  protected start() {
    const mode = this.day()?.workMode;
    this.error.set(undefined);
    if (mode) {
      void this.punch(mode);
    } else {
      this.isChoosing.set(true);
    }
  }

  protected async punch(mode: WorkMode) {
    this.busy.set(mode);
    this.error.set(undefined);
    try {
      const location = mode === 'home' ? undefined : await currentLocation();
      this.punched.emit(await this.api.punch(mode, location));
      this.isChoosing.set(false);
    } catch (error) {
      console.error('Punching failed', error);
      this.error.set(serverReason(error) ?? (error instanceof LocationError ? error.message : FAILED));
    } finally {
      this.busy.set(undefined);
    }
  }
}
