import { TestBed } from '@angular/core/testing';
import { CanMatchFn, Router, UrlTree } from '@angular/router';
import { employee, manager, setupHttp } from '../../testing/fixtures';
import { isManager, isSignedIn } from './guards';
import { Session } from './session';

// The guards ignore the route snapshot, so an empty stand in is enough.
const snapshot = {} as Parameters<CanMatchFn>[2];
const run = (guard: CanMatchFn) => TestBed.runInInjectionContext(() => guard({}, [], snapshot));

describe('route guards', () => {
  beforeEach(() => setupHttp());

  it('lets a signed in user through', async () => {
    vi.spyOn(TestBed.inject(Session), 'restore').mockResolvedValue(employee());

    expect(await run(isSignedIn)).toBe(true);
  });

  it('sends everyone else to the login page', async () => {
    vi.spyOn(TestBed.inject(Session), 'restore').mockResolvedValue(undefined);

    const result = await run(isSignedIn);

    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/login');
  });

  it('only lets managers into team pages', () => {
    const session = TestBed.inject(Session);
    session.user.set(employee());
    expect(TestBed.inject(Router).serializeUrl(run(isManager) as UrlTree)).toBe('/');

    session.user.set(manager());
    expect(run(isManager)).toBe(true);
  });
});
