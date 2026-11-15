import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { Session } from './session';

// Route guards only shape the UI. The backend is what actually protects data.
export const isSignedIn: CanMatchFn = async () => {
  const session = inject(Session);
  const router = inject(Router);
  return (await session.restore()) ? true : router.parseUrl('/login');
};

export const isManager: CanMatchFn = () => inject(Session).isManager() || inject(Router).parseUrl('/');

export const isHr: CanMatchFn = () => inject(Session).isHr() || inject(Router).parseUrl('/');

export const isSuperAdmin: CanMatchFn = () => inject(Session).isSuperAdmin() || inject(Router).parseUrl('/');
