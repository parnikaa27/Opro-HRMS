import { Component } from '@angular/core';
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { click, employee, manager, respond, setupHttp, settle, text, texts } from '../../../testing/fixtures';
import { SavedChanges } from '../saved-changes';
import { Session } from '../session';
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

  const render = async (url: string, responses: Record<string, object> = {}) => {
    await RouterTestingHarness.create(url);
    await respond(http, { '/api/notifications': NOTIFICATIONS, ...responses });
    return document.body;
  };

  const navLabels = (page: HTMLElement) => [...page.querySelectorAll('.sidebar nav a')].map((link) => text(link));

  it('gives employees the personal nav, no view switch, and the footer', async () => {
    session.user.set(employee());
    const page = await render('/');

    expect(navLabels(page)).toEqual(['Overview', 'Attendance', 'Leave', 'Calendar', 'Documents']);
    expect(page.querySelector('.role-switch')).toBeNull();
    expect(text(page.querySelector('footer') as HTMLElement)).toContain('Opro Pvt Ltd · Malé, Republic of Maldives');
    expect(text(page.querySelector('.location-card') as HTMLElement)).toBe('Current office Hulhumalé, Maldives');
    expect(text(page.querySelector('.profile-button') as HTMLElement)).toBe('KP Kasun Perera Employee · OPR-0018');
  });

  it('gives managers the team nav with a count of what is waiting', async () => {
    session.user.set(manager({ workLocation: 'Malé office', designation: 'Operations Manager' }));
    const page = await render('/team/approvals', {
      '/api/team/leave-requests?status=pending': [{ id: 'LR-1' }, { id: 'LR-2' }],
      '/api/team/corrections?status=pending': [{ id: 'AC-1' }],
    });

    expect(navLabels(page)).toEqual(['Overview', 'People', 'Attendance', 'Leave 3', 'Calendar']);
    expect(page.querySelector('[data-testid=view-team]')?.getAttribute('aria-pressed')).toBe('true');
    expect(text(page.querySelector('.profile-button small') as HTMLElement)).toBe('Operations Manager');
  });

  it('gives HR the company nav with waiting leave and open inbox counts', async () => {
    session.user.set(employee({ fullName: 'Aishath Shifa', designation: 'HR Manager', roles: ['EMPLOYEE', 'HR'] }));
    const page = await render('/hr', {
      '/api/hr/leave-requests?status=pending': [{ id: 'LR-1' }],
      '/api/hr/corrections?status=pending': [{ id: 'AC-1' }],
      '/api/hr/change-requests': [{ id: 'CR-1', status: 'open' }, { id: 'CR-2', status: 'done' }],
    });

    expect(navLabels(page)).toEqual(['Overview', 'People', 'Leave 2', 'Calendar', 'Visas', 'Inbox 1', 'Announcements', 'Leave policy']);
    expect([...page.querySelectorAll('.role-switch button')].map((button) => text(button))).toEqual(['Employee', 'HR']);
    expect(page.querySelector('[data-testid=view-hr]')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('refreshes the counts after anything is saved', async () => {
    session.user.set(manager());
    const page = await render('/team', { '/api/team/leave-requests?status=pending': [{ id: 'LR-1' }], '/api/team/corrections?status=pending': [] });
    expect(navLabels(page)).toContain('Leave 1');

    TestBed.inject(SavedChanges).count.update((count) => count + 1);
    await respond(http, { '/api/team/leave-requests?status=pending': [], '/api/team/corrections?status=pending': [] });

    expect(navLabels(page)).toContain('Leave');
  });

  it('switches view through the session', async () => {
    session.user.set(manager());
    const switchView = vi.spyOn(session, 'switchView').mockResolvedValue();
    const page = await render('/');

    click(page, 'view-team');

    expect(switchView).toHaveBeenCalledWith('team');
  });

  it('shows notifications with titles, marks them read, and closes on an outside click', async () => {
    session.user.set(employee());
    const page = await render('/');
    expect(page.querySelector('[data-testid=notifications-button]')?.getAttribute('aria-label')).toBe('Notifications, 1 unread');

    click(page, 'notifications-button');
    expect(texts(page, 'notifications-panel')[0]).toContain('Notifications 1 new Leave request updated Your leave was approved');

    click(page, 'mark-all-read');
    http.expectOne('/api/notifications/read').flush(null);
    await settle();
    await respond(http, { '/api/notifications': NOTIFICATIONS.map((item) => ({ ...item, isRead: true })) });
    expect(page.querySelector('[data-testid=notifications-button]')?.getAttribute('aria-label')).toBe('Notifications');

    page.querySelector('main')?.click();
    TestBed.tick();
    expect(page.querySelector('[data-testid=notifications-panel]')).toBeNull();
  });

  it('tells the user when marking read fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    session.user.set(employee());
    const page = await render('/');
    click(page, 'notifications-button');

    click(page, 'mark-all-read');
    http.expectOne('/api/notifications/read').flush('', { status: 500, statusText: 'Server Error' });
    await settle();
    expect(page.querySelector('[data-testid=notifications-panel] [role=alert]')).not.toBeNull();
  });

  it('has a calm empty state for notifications', async () => {
    session.user.set(employee());
    const page = await render('/', { '/api/notifications': [] });

    click(page, 'notifications-button');

    expect(texts(page, 'notifications-panel')[0]).toContain('All caught up');
  });

  it('signs out from the profile menu and from the sidebar', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    session.user.set(employee());
    const signOut = vi.spyOn(session, 'signOut').mockRejectedValue(new Error('offline'));
    const page = await render('/');

    click(page, 'account-button');
    expect(page.querySelector('.profile-popover a')?.getAttribute('href')).toBe('/profile');
    click(page, 'sign-out');
    click(page, 'sidebar-sign-out');
    await settle();

    expect(signOut).toHaveBeenCalledTimes(2);
  });

  it('searches pages, and people for managers, then goes to the first match on Enter', async () => {
    session.user.set(manager());
    const page = await render('/team');
    const input = page.querySelector('[data-testid=search-input]') as HTMLInputElement;

    input.value = 'rahim';
    input.dispatchEvent(new Event('input'));
    TestBed.tick();
    await respond(http, { '/api/team': [{ ...employee({ id: 'OPR-0021', fullName: 'Rahim Uddin' }) }] });
    expect(texts(page, 'search-results')).toEqual(['Rahim Uddin Person']);

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await settle();
    expect(TestBed.inject(Router).url).toBe('/team/OPR-0021');
    expect(input.value).toBe('');
  });

  it('lets HR search everyone and opens their HR page', async () => {
    session.user.set(employee({ roles: ['EMPLOYEE', 'HR'] }));
    const page = await render('/hr');
    const input = page.querySelector('[data-testid=search-input]') as HTMLInputElement;

    input.value = 'priya';
    input.dispatchEvent(new Event('input'));
    TestBed.tick();
    await respond(http, { '/api/hr/employees': [employee({ id: 'OPR-0015', fullName: 'Priya Nair' })] });

    expect(page.querySelector('[data-testid=search-results] a')?.getAttribute('href')).toBe('/hr/people/OPR-0015');
  });

  it('says when nothing matches, and focuses search with ⌘K', async () => {
    session.user.set(employee());
    const page = await render('/');
    const input = page.querySelector('[data-testid=search-input]') as HTMLInputElement;

    input.value = 'zzz';
    input.dispatchEvent(new Event('input'));
    TestBed.tick();
    expect(texts(page, 'search-results')).toEqual(['Nothing matches “zzz”.']);

    input.blur();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }));
    expect(document.activeElement).toBe(input);
  });

  it('opens and closes the phone menu, and the skip button focuses the content', async () => {
    session.user.set(employee());
    const page = await render('/');

    click(page, 'open-menu');
    expect(page.querySelector('.sidebar')?.classList).toContain('open');
    (page.querySelector('.sidebar-backdrop') as HTMLButtonElement).click();
    TestBed.tick();
    expect(page.querySelector('.sidebar')?.classList).not.toContain('open');

    (page.querySelector('app-shell > button') as HTMLButtonElement).click();
    expect(document.activeElement?.id).toBe('main');
  });
});
