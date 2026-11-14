import { WritableSignal } from '@angular/core';
import { FieldTree, submit } from '@angular/forms/signals';

// Validates, runs the save, and flags a failure for the form to show. The action emits its own success.
export const submitForm = <T>(event: Event, form: FieldTree<T>, failed: WritableSignal<boolean>, action: () => Promise<unknown>) => {
  event.preventDefault();
  failed.set(false);
  return submit(form, async () => {
    try {
      await action();
    } catch (error) {
      console.error('Saving a form failed', error);
      failed.set(true);
    }
    return undefined;
  });
};
