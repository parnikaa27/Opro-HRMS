import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { click, fail, NOW, respond, settle, setupHttp, text, texts } from '../../../testing/fixtures';
import { HrAnnouncementsPage } from './hr-announcements-page';

const URL = '/api/announcements';
const NOTES = [
  { id: 'AN-1', title: 'Visa renewals need 60 days', body: 'Send documents early.', publishedOn: '2026-10-28' },
  { id: 'AN-2', title: 'New fingerprint readers', body: 'Register this month.', publishedOn: '2026-11-12' },
];

describe('HrAnnouncementsPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    http = setupHttp();
  });

  afterEach(() => vi.useRealTimers());

  const render = async (notes: object[] = NOTES) => {
    const fixture = TestBed.createComponent(HrAnnouncementsPage);
    await respond(http, { [URL]: notes });
    return fixture.nativeElement as HTMLElement;
  };

  it('lists notes newest first', async () => {
    const root = await render();

    expect(texts(root, 'announcement-row')).toEqual([
      'New fingerprint readers Register this month. Posted 12 Nov Edit Delete',
      'Visa renewals need 60 days Send documents early. Posted 28 Oct Edit Delete',
    ]);
  });

  it('takes a note down after asking once', async () => {
    const root = await render();

    click(root, 'delete');
    expect(text(root.querySelector('[role=group]') as HTMLElement)).toBe('Take this down for everyone? Yes, take it down Keep it');
    click(root, 'confirm-yes');
    http.expectOne('/api/hr/announcements/AN-2').flush(null);
    await settle();
    await respond(http, { [URL]: [NOTES[0]] });

    expect(texts(root, 'announcement-row')).toHaveLength(1);
  });

  it('opens the form to write or edit a note', async () => {
    const root = await render();

    click(root, 'edit-announcement');
    expect((root.querySelector('[data-testid=announcement-title]') as HTMLInputElement).value).toBe('New fingerprint readers');
    (root.querySelector('dialog .secondary-button') as HTMLButtonElement).click();
    TestBed.tick();

    click(root, 'new-announcement');
    expect((root.querySelector('[data-testid=announcement-title]') as HTMLInputElement).value).toBe('');
  });

  it('has an empty state and an error state', async () => {
    expect(text(await render([]))).toContain('Nothing posted.');

    const broken = TestBed.createComponent(HrAnnouncementsPage);
    await fail(http, URL);
    expect(text(broken.nativeElement)).toContain("Announcements didn't load");
  });
});
