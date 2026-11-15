import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';
import { routes } from './app.routes';
import { savedChangesInterceptor } from './core/saved-changes';
import { sessionExpiredInterceptor } from './core/session-expired.interceptor';
import { Theme } from './core/theme';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding(), withViewTransitions()),
    provideHttpClient(withFetch(), withInterceptors([sessionExpiredInterceptor, savedChangesInterceptor])),
    // Applies a saved light or dark choice before the first screen renders.
    provideAppInitializer(() => {
      inject(Theme);
    }),
  ],
};
