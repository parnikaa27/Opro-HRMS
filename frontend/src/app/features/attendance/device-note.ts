import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CompanyApi } from '../../core/company-api';
import { Icon } from '../../shared/ui/icon';
import { StatusPill } from '../../shared/ui/status-pill';
import { minutesAgo } from '../../shared/utils/date-time';
import { valueOr } from '../../shared/utils/resource';
import { plural } from '../../shared/utils/text';

// Leave location empty to list every device, as managers see.
@Component({
  selector: 'app-device-note',
  imports: [Icon, StatusPill],
  template: `
    @for (device of shown(); track device.id) {
      <div class="device-note" data-testid="device-note">
        <app-icon name="fingerprint" [size]="22" />
        <div>
          <strong>{{ device.isOnline ? 'Biometric device connected' : 'Biometric device offline' }}</strong>
          <span>{{ device.name }} · Device {{ device.id }} · Last sync {{ ago(device.lastSyncAt) }}</span>
        </div>
        <app-status-pill [tone]="device.isOnline ? 'ok' : 'danger'">{{ device.isOnline ? 'Online' : 'Offline' }}</app-status-pill>
      </div>
    }
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeviceNote {
  readonly location = input<string>();
  private readonly devices = inject(CompanyApi).devices();
  protected readonly shown = computed(() => {
    const location = this.location();
    return valueOr(this.devices, []).filter((device) => !location || device.location === location);
  });
  protected readonly ago = (iso: string) => `${plural(minutesAgo(iso), 'minute')} ago`;
}
