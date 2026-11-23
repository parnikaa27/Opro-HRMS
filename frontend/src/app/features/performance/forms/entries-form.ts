import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { applyEach, FormField, form, maxLength, required, submit } from '@angular/forms/signals';
import { PlanEntry, PlanSection } from '../../../models/performance';
import { FieldError } from '../../../shared/ui/field-error';
import { Icon } from '../../../shared/ui/icon';
import { ModalHeading } from '../../../shared/ui/modal-heading';
import { serverReason } from '../../../shared/utils/form-submit';
import { PerformanceApi } from '../performance-api';
import { sectionInfo } from '../plan-sections';

const MAX_ENTRIES = 20;
const MAX_TITLE = 120;
const MAX_DETAILS = 1000;
const FAILED = "That didn't save. Try again in a moment.";

interface Row {
  title: string;
  details: string;
  targetOn: string;
}

// A new object each time: the form tells rows apart by identity.
const emptyRow = (): Row => ({ title: '', details: '', targetOn: '' });
const isBlank = ({ title, details, targetOn }: Row) => !title.trim() && !details.trim() && !targetOn;

// One section of someone's plan: as many entries as they like, each with a cross to take it off. Saving keeps it as a
// draft; the whole plan goes to their HOD from the page.
@Component({
  selector: 'app-entries-form',
  imports: [FieldError, FormField, Icon, ModalHeading],
  template: `
    <app-modal-heading eyebrow="Your plan" [heading]="info().title" [intro]="info().ask" />
    <form novalidate (submit)="save($event)">
      @for (entry of entriesForm.rows; track $index; let index = $index) {
        <fieldset class="entry-fields" data-testid="entry-fields">
          <legend>{{ info().titleLabel }} {{ index + 1 }}</legend>
          <button type="button" class="entry-remove" (click)="remove(index)" [attr.aria-label]="'Remove ' + info().entryLabel + ' ' + (index + 1)" data-testid="remove-entry">
            <app-icon name="x" [size]="16" />
          </button>
          <label>{{ info().titleLabel }} <input [formField]="entry.title" [placeholder]="info().titleExample" data-testid="entry-title" [attr.aria-describedby]="'entry-title-error-' + index" /></label>
          <app-field-error [id]="'entry-title-error-' + index" [errors]="entry.title().errors()" [isTouched]="entry.title().touched()" />
          @if (info().detailsLabel) {
            <div class="form-row">
              <label>{{ info().detailsLabel }} <input [formField]="entry.details" [placeholder]="info().detailsExample ?? ''" data-testid="entry-details" /></label>
              @if (info().hasTarget) {
                <label>By when <input type="date" [formField]="entry.targetOn" data-testid="entry-target" /></label>
              }
            </div>
          }
        </fieldset>
      } @empty {
        <p class="card-note">Nothing here yet. Add your first {{ info().entryLabel }}.</p>
      }
      @if (draft().rows.length < maxEntries) {
        <button type="button" class="secondary-button add-entry" (click)="add()" data-testid="add-entry"><app-icon name="plus" [size]="16" /> Add {{ draft().rows.length ? 'another' : 'a' }} {{ info().entryLabel }}</button>
      }
      @if (failure()) {
        <p role="alert" data-testid="entries-error">{{ failure() }}</p>
      }
      <div class="modal-actions">
        <button type="button" class="secondary-button" (click)="cancelled.emit()">Cancel</button>
        <button type="submit" class="primary-button" [disabled]="entriesForm().submitting()" data-testid="entries-save">Save</button>
      </div>
    </form>
  `,
  host: { class: 'contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntriesForm {
  private readonly api = inject(PerformanceApi);
  readonly section = input.required<PlanSection>();
  readonly entries = input<readonly PlanEntry[]>([]);
  readonly saved = output();
  readonly cancelled = output();

  protected readonly maxEntries = MAX_ENTRIES;
  protected readonly info = computed(() => sectionInfo(this.section()));
  protected readonly failure = signal<string | undefined>(undefined);
  protected readonly draft = linkedSignal<{ rows: Row[] }>(() => {
    const own = this.entries().filter(({ section }) => section === this.section());
    return { rows: own.length ? own.map(({ title, details, targetOn }) => ({ title, details: details ?? '', targetOn: targetOn ?? '' })) : [emptyRow()] };
  });
  protected readonly entriesForm = form(this.draft, (path) => {
    applyEach(path.rows, (row) => {
      required(row.title, { message: 'Give it a title, or take it off with the cross.' });
      maxLength(row.title, MAX_TITLE, { message: `Keep it under ${MAX_TITLE} characters.` });
      maxLength(row.details, MAX_DETAILS, { message: `Keep it under ${MAX_DETAILS} characters.` });
    });
  });

  protected add() {
    this.draft.update(({ rows }) => ({ rows: [...rows, emptyRow()] }));
  }

  protected remove(index: number) {
    this.draft.update(({ rows }) => ({ rows: rows.filter((_, position) => position !== index) }));
  }

  protected save(event: Event) {
    event.preventDefault();
    this.failure.set(undefined);
    // A row left completely empty is dropped rather than flagged.
    this.draft.update(({ rows }) => ({ rows: rows.filter((row) => !isBlank(row)) }));
    return submit(this.entriesForm, async () => {
      try {
        await this.api.writeSection(this.section(), this.draft().rows.map(({ title, details, targetOn }) => ({
          title: title.trim(),
          ...(details.trim() && { details: details.trim() }),
          ...(targetOn && this.info().hasTarget && { targetOn }),
        })));
        this.saved.emit();
      } catch (error) {
        console.error('Saving a plan section failed', error);
        this.failure.set(serverReason(error) ?? FAILED);
      }
      return undefined;
    });
  }
}
