import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormField, form, maxLength, required, submit } from '@angular/forms/signals';
import { AllowanceType } from '../../models/allowance';
import { ConfirmButton } from '../../shared/ui/confirm-button';
import { FieldError } from '../../shared/ui/field-error';
import { ListSkeleton } from '../../shared/ui/list-skeleton';
import { serverReason } from '../../shared/utils/form-submit';
import { valueOr } from '../../shared/utils/resource';
import { AllowanceApi } from './allowance-api';

const MAX_NAME = 60;

// HR's list of kinds of allowance, in Policies. A used one is retired rather than deleted.
@Component({
  selector: 'app-allowance-types-card',
  imports: [ConfirmButton, FieldError, FormField, ListSkeleton],
  template: `
    <section class="card request-history" data-testid="allowance-types">
      <div class="card-heading"><div><span class="eyebrow">On top of pay</span><h2>Allowances</h2></div></div>
      @if (types.error()) {
        <p class="attendance-off">The list didn't load. Refresh the page to try again.</p>
      } @else if (types.isLoading() && list().length === 0) {
        <app-list-skeleton [count]="2" />
      } @else {
        @for (type of list(); track type.code) {
          <div class="history-row exit-row" data-testid="allowance-type-row">
            <div><strong>{{ type.name }}</strong></div>
            <span></span>
            <span class="row-actions">
              <app-confirm-button label="Remove" [question]="'Remove ' + type.name.toLowerCase() + '?'" yes="Yes, remove it" testId="remove-allowance-type" (confirmed)="remove(type)" />
            </span>
          </div>
        } @empty {
          <p class="attendance-off">No allowances on the list. Add the kinds Opro pays, like housing.</p>
        }
        <form class="inline-add" novalidate (submit)="add($event)">
          <label>
            <span class="sr-only">A kind of allowance</span>
            <input [formField]="typeForm.name" placeholder="Uniform" data-testid="allowance-type-name" aria-describedby="allowance-type-error" />
          </label>
          <button type="submit" class="secondary-button" [disabled]="typeForm().submitting()" data-testid="add-allowance-type">Add</button>
        </form>
        <app-field-error id="allowance-type-error" [errors]="typeForm.name().errors()" [isTouched]="typeForm.name().touched()" />
        @if (failure()) {
          <p class="row-error" role="alert">{{ failure() }}</p>
        }
        <p class="table-note">Removing one nobody has had deletes it. Otherwise it's retired: nobody can be given it, and history keeps its name.</p>
      }
    </section>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AllowanceTypesCard {
  private readonly api = inject(AllowanceApi);
  protected readonly types = this.api.types();
  protected readonly list = computed(() => valueOr(this.types, []).filter(({ retiredOn }) => !retiredOn));
  protected readonly failure = signal<string | undefined>(undefined);
  protected readonly draft = signal({ name: '' });
  protected readonly typeForm = form(this.draft, (path) => {
    required(path.name, { message: 'Name the allowance.' });
    maxLength(path.name, MAX_NAME, { message: `Keep it under ${MAX_NAME} characters.` });
  });

  protected add(event: Event) {
    event.preventDefault();
    this.failure.set(undefined);
    return submit(this.typeForm, async () => {
      try {
        await this.api.addType(this.draft().name.trim());
        this.draft.set({ name: '' });
        this.typeForm().reset();
        this.types.reload();
      } catch (error) {
        console.error('Adding an allowance type failed', error);
        this.failure.set(serverReason(error) ?? "That didn't save. Try again in a moment.");
      }
      return undefined;
    });
  }

  protected async remove({ code }: AllowanceType) {
    this.failure.set(undefined);
    try {
      await this.api.removeType(code);
      this.types.reload();
    } catch (error) {
      console.error('Removing an allowance type failed', error);
      this.failure.set("That didn't remove. Try again in a moment.");
    }
  }
}
