import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormField, form, maxLength, required, submit } from '@angular/forms/signals';
import { ExitItem } from '../../models/exit';
import { ConfirmButton } from '../../shared/ui/confirm-button';
import { FieldError } from '../../shared/ui/field-error';
import { ListSkeleton } from '../../shared/ui/list-skeleton';
import { serverReason } from '../../shared/utils/form-submit';
import { valueOr } from '../../shared/utils/resource';
import { ExitApi } from './exit-api';

const MAX_NAME = 60;

// HR's list of what comes back before someone leaves. Each one is ticked off on the person's page.
@Component({
  selector: 'app-exit-items-card',
  imports: [ConfirmButton, FieldError, FormField, ListSkeleton],
  template: `
    <section class="card request-history" data-testid="exit-items">
      <div class="card-heading"><div><span class="eyebrow">LEAVING OPRO</span><h2>What comes back</h2></div></div>
      @if (items.error()) {
        <p class="attendance-off">The list didn't load. Refresh the page to try again.</p>
      } @else if (items.isLoading() && list().length === 0) {
        <app-list-skeleton [count]="2" />
      } @else {
        @for (item of list(); track item.id) {
          <div class="history-row exit-row" data-testid="exit-item-row">
            <div><strong>{{ item.name }}</strong></div>
            <span></span>
            <span class="row-actions">
              <app-confirm-button label="Remove" [question]="'Remove ' + item.name.toLowerCase() + '?'" yes="Yes, remove it" testId="remove-exit-item" (confirmed)="remove(item)" />
            </span>
          </div>
        } @empty {
          <p class="attendance-off">Nothing on the list. Add what people hand back, like a laptop or keys.</p>
        }
        <form class="inline-add" novalidate (submit)="add($event)">
          <label>
            <span class="sr-only">Something people hand back</span>
            <input [formField]="itemForm.name" placeholder="Parking pass" data-testid="exit-item-name" aria-describedby="exit-item-error" />
          </label>
          <button type="submit" class="secondary-button" [disabled]="itemForm().submitting()" data-testid="add-exit-item">Add</button>
        </form>
        <app-field-error id="exit-item-error" [errors]="itemForm.name().errors()" [isTouched]="itemForm.name().touched()" />
        @if (failure()) {
          <p class="row-error" role="alert">{{ failure() }}</p>
        }
        <p class="table-note">Someone who resigned can only be marked as leaving once every item is ticked off on their page.</p>
      }
    </section>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExitItemsCard {
  private readonly api = inject(ExitApi);
  protected readonly items = this.api.items();
  protected readonly list = computed(() => valueOr(this.items, []));
  protected readonly failure = signal<string | undefined>(undefined);
  protected readonly draft = signal({ name: '' });
  protected readonly itemForm = form(this.draft, (path) => {
    required(path.name, { message: 'Name what comes back.' });
    maxLength(path.name, MAX_NAME, { message: `Keep it under ${MAX_NAME} characters.` });
  });

  protected add(event: Event) {
    event.preventDefault();
    this.failure.set(undefined);
    return submit(this.itemForm, async () => {
      try {
        await this.api.addItem(this.draft().name.trim());
        this.draft.set({ name: '' });
        this.itemForm().reset();
        this.items.reload();
      } catch (error) {
        console.error('Adding an exit item failed', error);
        this.failure.set(serverReason(error) ?? "That didn't save. Try again in a moment.");
      }
      return undefined;
    });
  }

  protected async remove({ id }: ExitItem) {
    this.failure.set(undefined);
    try {
      await this.api.removeItem(id);
      this.items.reload();
    } catch (error) {
      console.error('Removing an exit item failed', error);
      this.failure.set("That didn't remove. Try again in a moment.");
    }
  }
}
