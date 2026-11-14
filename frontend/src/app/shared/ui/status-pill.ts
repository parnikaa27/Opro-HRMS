import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type Tone = 'ok' | 'late' | 'danger' | 'leave' | 'sea' | 'neutral';

// Maps our meaning onto the pill colours the design defines.
const VARIANT: Record<Tone, string> = {
  ok: '',
  sea: '',
  late: 'late',
  danger: 'declined',
  leave: 'on-leave',
  neutral: 'neutral',
};

@Component({
  selector: 'app-status-pill',
  template: `<span [class]="classes()"><i></i><ng-content /></span>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusPill {
  readonly tone = input<Tone>('ok');
  protected readonly classes = computed(() => `status-pill ${VARIANT[this.tone()]}`.trim());
}
