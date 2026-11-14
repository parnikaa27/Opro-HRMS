import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { byTestId, click, fail, fill, NOW, respond, settle, setupHttp, text, texts } from '../../../testing/fixtures';
import { HrCalendarPage } from './hr-calendar-page';

const HOLIDAYS = '/api/holidays?year=2026';
const EVENTS = '/api/events?year=2026';
const HOLIDAY_LIST = [
  { id: 'HD-2', name: 'Mawlid al Nabi', date: '2026-08-26', isTentative: true },
  { id: 'HD-1', name: "New Year's Day", date: '2026-01-01', isTentative: false },
];

describe('HrCalendarPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    http = setupHttp();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const render = async (holidays: object[] = HOLIDAY_LIST) => {
    const fixture = TestBed.createComponent(HrCalendarPage);
    await respond(http, { [HOLIDAYS]: holidays, [EVENTS]: [{ id: 'EV-1', name: 'Team review', date: '2026-12-02' }] });
    return fixture.nativeElement as HTMLElement;
  };

  const reloaded = (holidays: object[] = HOLIDAY_LIST) => respond(http, { [HOLIDAYS]: holidays, [EVENTS]: [] });

  it('lists the year’s holidays by date with their status, and events', async () => {
    const root = await render();

    expect(texts(root, 'holiday-row')).toEqual(["New Year's Day Thu 1 Jan Edit Delete Confirmed", 'Mawlid al Nabi Wed 26 Aug Confirm date Edit Delete Tentative']);
    expect(texts(root, 'event-row')).toEqual(['Team review Wed 2 Dec Edit Delete']);
  });

  it('confirms a tentative date', async () => {
    const root = await render();

    click(root, 'confirm-holiday');
    const request = http.expectOne('/api/hr/holidays/HD-2');
    expect(request.request.body).toEqual({ name: 'Mawlid al Nabi', date: '2026-08-26', isTentative: false });
    request.flush({});
    await reloaded();
  });

  it('deletes after asking once, and shows when that fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const root = await render();

    byTestId(root, 'delete')[0].click();
    TestBed.tick();
    expect(text(root.querySelector('[role=group]') as HTMLElement)).toBe("Delete New Year's Day? Yes, delete it Keep it");
    click(root, 'confirm-yes');
    http.expectOne('/api/hr/holidays/HD-1').flush('', { status: 500, statusText: 'Server Error' });
    await settle();

    expect(byTestId(root, 'holiday-row')[0].querySelector('[role=alert]')).not.toBeNull();
  });

  it('adds holidays and events through dialogs', async () => {
    const root = await render();

    click(root, 'add-holiday');
    fill(root, 'holiday-name', 'Founders Day');
    fill(root, 'holiday-date', '2026-12-20');
    (root.querySelector('dialog button[type=submit]') as HTMLButtonElement).click();
    await settle();
    http.expectOne('/api/hr/holidays').flush({});
    await reloaded();
    expect(root.querySelector('dialog')?.open).toBe(false);

    click(root, 'add-event');
    expect(text(root.querySelector('dialog h2') as HTMLElement)).toBe('Add an event');
  });

  it('starts an empty year with the civil holidays, and moves between years', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const root = await render([]);

    click(root, 'start-year');
    http.expectOne('/api/hr/holidays/start-year').flush('', { status: 500, statusText: 'Server Error' });
    await settle();
    expect(text(root)).toContain("That didn't save.");

    click(root, 'start-year');
    expect(http.expectOne('/api/hr/holidays/start-year').request.body).toEqual({ year: 2026 });

    click(root, 'next-year');
    expect(texts(root, 'year-label')).toEqual(['2027']);
    click(root, 'previous-year');
    expect(texts(root, 'year-label')).toEqual(['2026']);
  });

  it('says when holidays fail to load', async () => {
    const fixture = TestBed.createComponent(HrCalendarPage);
    await fail(http, HOLIDAYS);

    expect(text(fixture.nativeElement)).toContain("Holidays didn't load");
  });
});
