import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
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

const EXPLAINED = new Set<number>([HttpStatusCode.BadRequest, HttpStatusCode.Conflict]);

// When the server refuses a save for a reason the person can fix, it says why. Show that instead of a generic error.
export const serverReason = (error: unknown) => {
  if (!(error instanceof HttpErrorResponse) || !EXPLAINED.has(error.status)) {
    return undefined;
  }
  const body: unknown = error.error;
  return typeof body === 'object' && body !== null && 'message' in body && typeof body.message === 'string' ? body.message : undefined;
};
