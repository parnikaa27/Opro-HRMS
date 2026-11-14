import { Component } from '@angular/core';
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { employee, manager, respond, setupHttp, text } from '../../../testing/fixtures';
import { Session } from '../session';
import { Theme } from '../theme';
import { Shell } from './shell';

@Component({ template: '' })
class Blank {}

const NOTIFICATIONS = [
  { id: 'NT-1', kind: 'leave', text: 'Your leave was approved', createdOn: '2026-11-10', isRead: false },
  { id: 'NT-2', kind: 'visa', text: 'Visa reminder', createdOn: '2026-11-01', isRead: true },
];

describe('app shell', () => {
  let http: HttpTestingController;
  let session: Session;

  beforeEach(() => {
    http = setupHttp([{ path: '', component: Shell, children: [{ path: '**', component: Blank }] }]);
    session = TestBed.inject(Session);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  const render = async (url: string, notifications: object[] = NOTIFICATIONS) => {
    const harness = await RouterTestingHarness.create(url);
    await respond(http, { '/api/notifications': notifications });
    return harness.routeNativeElement?.ownerDocument.body ?? document.body;
  };

  const navLabels = (page: HTMLElement) => [...page.querySelectorAll('app-portal-nav')][0].querySelectorAll('a');

  it('shows the personal nav, no view switch and the footer for employees', async () => {
    session.user.set(employee());
    const page = await render('/');

    expect([...navLabels(page)].map((link) => text(link))).toEqual(['Home', 'Attendance', 'Leave', 'Holidays', 'Profile']);
    expect(page.querySelector('[data-testid=view-team]')).toBeNull();
    expect(text(page.querySelector('footer') as HTMLElement)).toContain('hr@opro.mv');
  });

  it('shows the team nav and marks team view as pressed on team pages', async () => {
    session.user.set(manager());
    const page = await render('/team/approvals');

    expect([...navLabels(page)].map((link) => text(link))).toEqual(['Today', 'Approvals', 'Attendance', 'Calendar']);
    expect(page.querySelector('[data-testid=view-team]')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('switches view through the session', async () => {
    session.user.set(manager());
    const switchView = vi.spyOn(session, 'switchView').mockResolvedValue();
    const page = await render('/');

    (page.querySelector('[data-testid=view-team]') as HTMLButtonElement).click();

    expect(switchView).toHaveBeenCalledWith('team');
  });

  it('counts unread notifications and marks them read', async () => {
    session.user.set(employee());
    const page = await render('/');
    expect(page.querySelector('[data-testid=notifications-button]')?.getAttribute('aria-label')).toBe('Notifications, 1 unread');

    (page.querySelector('[data-testid=mark-all-read]') as HTMLButtonElement).click();
    http.expectOne('/api/notifications/read').flush(null);
    await new Promise((resolve) => setTimeout(resolve));
    await respond(http, { '/api/notifications': NOTIFICATIONS.map((item) => ({ ...item, isRead: true })) });

    expect(page.querySelector('[data-testid=notifications-button]')?.getAttribute('aria-label')).toBe('Notifications');
  });

  it('tells the user when marking read fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    session.user.set(employee());
    const page = await render('/');

    (page.querySelector('[data-testid=mark-all-read]') as HTMLButtonElement).click();
    http.expectOne('/api/notifications/read').flush('', { status: 500, statusText: 'Server Error' });
    await respond(http, {});

    expect(page.querySelector('[data-testid=notifications-panel] [role=alert]')).not.toBeNull();
  });

  it('shows a calm empty state with no notifications', async () => {
    session.user.set(employee());
    const page = await render('/', []);

    expect(text(page.querySelector('[data-testid=notifications-panel]') as HTMLElement)).toContain('Nothing new');
  });

  it('changes the theme and signs out from the account menu', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    session.user.set(employee());
    const signOut = vi.spyOn(session, 'signOut').mockRejectedValue(new Error('offline'));
    const page = await render('/');

    const darkButton = [...page.querySelectorAll('#account-panel button')].find((button) => text(button as HTMLElement) === 'dark') as HTMLButtonElement;
    darkButton.click();
    (page.querySelector('[data-testid=sign-out]') as HTMLButtonElement).click();

    expect(TestBed.inject(Theme).choice()).toBe('dark');
    expect(signOut).toHaveBeenCalled();
  });

  it('moves focus to the main content from the skip button', async () => {
    session.user.set(employee());
    const page = await render('/');

    (page.querySelector('app-shell > button') as HTMLButtonElement).click();

    expect(document.activeElement?.id).toBe('main');
  });
});
