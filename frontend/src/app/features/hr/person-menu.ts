import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Dismiss } from '../../shared/ui/dismiss';
import { Icon } from '../../shared/ui/icon';

// The less frequent things HR does to a record, kept out of the title so the daily ones stand out.
@Component({
  selector: 'app-person-menu',
  imports: [Icon, RouterLink],
  template: `
    <button type="button" class="secondary-button" [attr.aria-expanded]="isOpen()" (click)="isOpen.set(!isOpen())" data-testid="person-menu">More <app-icon name="chevronDown" [size]="15" /></button>
    @if (isOpen()) {
      <div class="notification-popover profile-popover person-popover">
        <a [routerLink]="['/hr/people', employeeId(), 'edit']" data-testid="edit-person">Edit details and manager</a>
        <button type="button" (click)="choose(photo)" data-testid="change-photo">Change photo</button>
        @if (!isLeaving()) {
          <button type="button" class="danger" (click)="choose(leaving)" data-testid="mark-leaving">Mark as leaving</button>
        }
      </div>
    }
  `,
  host: { class: 'notification-wrap' },
  hostDirectives: [Dismiss],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonMenu {
  readonly employeeId = input.required<string>();
  readonly isLeaving = input(false);
  readonly photo = output();
  readonly leaving = output();
  protected readonly isOpen = signal(false);
  private readonly closeOnDismiss = inject(Dismiss).dismissed.subscribe(() => this.isOpen.set(false));

  protected choose(action: { emit: () => void }) {
    this.isOpen.set(false);
    action.emit();
  }
}
