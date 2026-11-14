import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const PATHS = {
  home: 'M4 11 12 4l8 7M6 9.5V20h12V9.5M10 20v-5h4v5',
  clock: 'M4 12a8 8 0 1 0 16 0a8 8 0 1 0-16 0M12 8v4l3 2',
  leave: 'M4 11a8 8 0 0 1 16 0ZM12 11v7a2 2 0 0 1-4 0',
  calendar: 'M5 6h14v14H5zM5 10h14M9 4v4M15 4v4',
  user: 'M8 8a4 4 0 1 0 8 0a4 4 0 1 0-8 0M5 20a7 7 0 0 1 14 0',
  team: 'M5.5 8a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0M3 20a6 6 0 0 1 12 0M15.5 4.6a3.5 3.5 0 0 1 0 6.8M17.5 14.3A6 6 0 0 1 21 20',
  approvals: 'M4 12a8 8 0 1 0 16 0a8 8 0 1 0-16 0M8.5 12.5l2.5 2.5 4.5-5',
  grid: 'M5 5h6v6H5zM13 5h6v6h-6zM5 13h6v6H5zM13 13h6v6h-6z',
  bell: 'M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15ZM10 20.5a2 2 0 0 0 4 0',
  logout: 'M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  alert: 'M12 4 3 20h18ZM12 10v4M12 17v.01',
} as const;

export type IconName = keyof typeof PATHS;

@Component({
  selector: 'app-icon',
  template: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="size-full"><path [attr.d]="path()" /></svg>`,
  host: { class: 'inline-block size-5 shrink-0' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Icon {
  readonly name = input.required<IconName>();
  protected readonly path = computed(() => PATHS[this.name()]);
}
