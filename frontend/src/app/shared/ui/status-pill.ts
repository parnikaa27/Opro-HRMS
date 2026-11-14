import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type Tone = 'ok' | 'late' | 'danger' | 'leave' | 'sea' | 'neutral';

const TONES: Record<Tone, string> = {
  ok: 'bg-ok-soft text-ok',
  late: 'bg-late-soft text-late',
  danger: 'bg-danger-soft text-danger',
  leave: 'bg-leave-soft text-leave',
  sea: 'bg-sea-soft text-sea',
  neutral: 'bg-canvas text-soft',
};

@Component({
  selector: 'app-status-pill',
  template: `<span [class]="classes()"><ng-content /></span>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusPill {
  readonly tone = input<Tone>('neutral');
  protected readonly classes = computed(() => `inline-block rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${TONES[this.tone()]}`);
}
