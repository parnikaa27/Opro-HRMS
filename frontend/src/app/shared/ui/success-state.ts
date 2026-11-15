import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Icon } from './icon';

@Component({
  selector: 'app-success-state',
  imports: [Icon],
  template: `
    <div class="success-state" role="status" data-testid="success-state">
      <div><app-icon name="check" [size]="28" /></div>
      <h2>{{ heading() }}</h2>
      <p>{{ body() }}</p>
      <button type="button" class="primary-button" (click)="done.emit()">Done</button>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SuccessState {
  readonly heading = input.required<string>();
  readonly body = input.required<string>();
  readonly done = output();
}
