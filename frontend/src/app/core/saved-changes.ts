import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { tap } from 'rxjs';

// Counts successful saves, so numbers outside the page that saved (the nav badges) can catch up.
@Injectable({ providedIn: 'root' })
export class SavedChanges {
  readonly count = signal(0);
}

const READS = new Set(['GET', 'HEAD']);

export const savedChangesInterceptor: HttpInterceptorFn = (request, next) => {
  if (READS.has(request.method)) {
    return next(request);
  }
  const saved = inject(SavedChanges);
  return next(request).pipe(
    tap((event) => {
      if (event instanceof HttpResponse) {
        saved.count.update((count) => count + 1);
      }
    }),
  );
};
