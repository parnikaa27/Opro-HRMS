import { HttpErrorResponse, HttpInterceptorFn, HttpStatusCode } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { Session } from './session';

export const sessionExpiredInterceptor: HttpInterceptorFn = (request, next) => {
  const session = inject(Session);
  return next(request).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === HttpStatusCode.Unauthorized && session.user()) {
        session.clear();
      }
      return throwError(() => error);
    }),
  );
};
