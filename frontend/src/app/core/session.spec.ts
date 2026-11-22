import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { employee, manager, setupHttp } from '../../testing/fixtures';
import { Session } from './session';

describe('Session', () => {
  let http: HttpTestingController;
  let session: Session;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    http = setupHttp();
    session = TestBed.inject(Session);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('loads the signed in user once and reuses it', async () => {
    const restoring = session.restore();
    http.expectOne('/api/me').flush(employee());

    expect(await restoring).toEqual(employee());
    expect(await session.restore()).toEqual(employee());
    http.verify();
  });

  it('treats a 401 as signed out without logging an error', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const restoring = session.restore();
    http.expectOne('/api/me').flush('', { status: 401, statusText: 'Unauthorized' });

    expect(await restoring).toBeUndefined();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('logs other failures and still reports signed out', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const restoring = session.restore();
    http.expectOne('/api/me').flush('', { status: 500, statusText: 'Server Error' });

    expect(await restoring).toBeUndefined();
    expect(consoleError).toHaveBeenCalled();
  });

  it('sends a manager back to the team view if that is where they left off', async () => {
    localStorage.setItem('opro.view', 'team');
    const signingIn = session.signIn('OPR-0004');
    http.expectOne('/api/session/login').flush(null);
    await Promise.resolve();
    http.expectOne('/api/me').flush(manager());
    await signingIn;

    expect(session.isManager()).toBe(true);
    expect(navigate).toHaveBeenCalledWith('/team');
  });

  it('sends HR back to the HR view, but never someone without the role', async () => {
    localStorage.setItem('opro.view', 'hr');
    const signingIn = session.signIn('OPR-0002');
    http.expectOne('/api/session/login').flush(null);
    await Promise.resolve();
    http.expectOne('/api/me').flush(employee({ roles: ['EMPLOYEE', 'HR'] }));
    await signingIn;
    expect(navigate).toHaveBeenLastCalledWith('/hr');

    const asManager = session.signIn('OPR-0004');
    http.expectOne('/api/session/login').flush(null);
    await Promise.resolve();
    http.expectOne('/api/me').flush(manager());
    await asManager;
    expect(navigate).toHaveBeenLastCalledWith('/');
  });

  it('sends a super admin back to the company view', async () => {
    localStorage.setItem('opro.view', 'company');
    const signingIn = session.signIn('OPR-0001');
    http.expectOne('/api/session/login').flush(null);
    await Promise.resolve();
    http.expectOne('/api/me').flush(employee({ roles: ['EMPLOYEE', 'SUPER_ADMIN'] }));
    await signingIn;

    expect(navigate).toHaveBeenLastCalledWith('/company');
  });

  it('starts employees on home even if a team preference is stored', async () => {
    localStorage.setItem('opro.view', 'team');
    const signingIn = session.signIn('OPR-0018');
    http.expectOne('/api/session/login').flush(null);
    await Promise.resolve();
    http.expectOne('/api/me').flush(employee());
    await signingIn;

    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('loads the new person when someone else was signed in on the page', async () => {
    session.user.set(employee({ id: 'OPR-0018', fullName: 'Arjun Reddy' }));

    const signingIn = session.signIn('OPR-0004');
    http.expectOne('/api/session/login').flush(null);
    await Promise.resolve();
    http.expectOne('/api/me').flush(manager());
    await signingIn;

    expect(session.user()?.id).toBe(manager().id);
  });

  it('remembers the chosen view and goes there', async () => {
    await session.switchView('team');

    expect(localStorage.getItem('opro.view')).toBe('team');
    expect(navigate).toHaveBeenCalledWith('/team');
  });

  it('clears the user on sign out even when the server call fails', async () => {
    session.user.set(employee());
    const signingOut = session.signOut();
    http.expectOne('/api/session/logout').flush('', { status: 500, statusText: 'Server Error' });

    await expect(signingOut).rejects.toBeTruthy();
    expect(session.user()).toBeUndefined();
    expect(navigate).toHaveBeenCalledWith('/login');
  });
});
