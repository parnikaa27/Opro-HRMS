import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AttendanceDay } from '../../models/attendance';
import { click, settle, setupHttp, text, TODAY } from '../../../testing/fixtures';
import { PunchButton } from './punch-button';

const PUNCH = '/api/attendance/punch';
const AT_THE_OFFICE = { latitude: 4.1757, longitude: 73.5094, accuracy: 18 };

const day = (overrides: Partial<AttendanceDay> = {}): AttendanceDay => ({
  employeeId: 'E', date: TODAY, status: 'not-in-yet', punches: [], workedMinutes: 0, overtimeMinutes: 0, ...overrides,
});

// The browser's location, as the test wants it: found, or refused with a GeolocationPositionError code.
const placeBrowser = (outcome: typeof AT_THE_OFFICE | { code: number }) =>
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: (found: PositionCallback, failed: PositionErrorCallback) =>
        'code' in outcome ? failed(outcome as GeolocationPositionError) : found({ coords: outcome } as GeolocationPosition),
    },
  });

describe('PunchButton', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    http = setupHttp();
    placeBrowser(AT_THE_OFFICE);
  });

  afterEach(() => vi.restoreAllMocks());

  const render = (today: AttendanceDay = day()) => {
    const fixture = TestBed.createComponent(PunchButton);
    fixture.componentRef.setInput('day', today);
    const punched = vi.fn();
    fixture.componentInstance.punched.subscribe(punched);
    TestBed.tick();
    return { root: fixture.nativeElement as HTMLElement, punched };
  };

  const dialog = (root: HTMLElement) => root.querySelector('dialog') as HTMLDialogElement;

  it('asks where they are working, then punches in from the office with the location', async () => {
    const { root, punched } = render();

    click(root, 'punch-button');
    expect(text(dialog(root))).toContain('PUNCH IN Where are you working today? You choose once a day.');
    click(root, 'punch-office');
    await settle();

    const request = http.expectOne(PUNCH);
    expect(request.request.body).toEqual({ mode: 'office', ...AT_THE_OFFICE });
    request.flush(day({ workMode: 'office' }));
    await settle();

    expect(punched).toHaveBeenCalledWith(day({ workMode: 'office' }));
    expect(dialog(root).open).toBe(false);
  });

  it('punches in from home without asking for a location', async () => {
    const { root } = render();

    click(root, 'punch-button');
    click(root, 'punch-home');
    await settle();

    expect(http.expectOne(PUNCH).request.body).toEqual({ mode: 'home' });
  });

  it('punches out the way the day started, in one tap', async () => {
    const { root } = render(day({ workMode: 'home', punches: [{ at: `${TODAY}T08:55:00+05:00`, direction: 'in', device: 'Home' }] }));

    expect(text(root.querySelector('[data-testid=punch-button]') as HTMLElement)).toBe('Punch out');
    click(root, 'punch-button');
    await settle();

    expect(dialog(root).open).toBe(false);
    expect(http.expectOne(PUNCH).request.body).toEqual({ mode: 'home' });
  });

  it('asks on the way out when the day started with a punch added by hand', () => {
    const { root } = render(day({ punches: [{ at: `${TODAY}T08:55:00+05:00`, direction: 'in' }] }));

    click(root, 'punch-button');

    expect(text(dialog(root))).toContain('PUNCH OUT Where are you working today?');
  });

  it('shows why the server refused, like being too far from the office', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { root, punched } = render();

    click(root, 'punch-button');
    click(root, 'punch-office');
    await settle();
    http.expectOne(PUNCH).flush({ message: 'You’re 1.6 km from Malé office.' }, { status: 409, statusText: 'Conflict' });
    await settle();

    expect(text(dialog(root).querySelector('[role=alert]') as HTMLElement)).toBe('You’re 1.6 km from Malé office.');
    expect(punched).not.toHaveBeenCalled();
  });

  it('says how to fix a blocked location, without calling the server', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    placeBrowser({ code: 1 });
    const { root } = render(day({ workMode: 'office', punches: [{ at: `${TODAY}T08:55:00+05:00`, direction: 'in' }] }));

    click(root, 'punch-button');
    await settle();

    http.expectNone(PUNCH);
    expect(text(root.querySelector('[data-testid=punch-error]') as HTMLElement)).toBe('Location is blocked for the portal. Allow it in your browser settings and try again.');
  });

  it('says so when the location cannot be found or the save fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    placeBrowser({ code: 3 });
    const { root } = render(day({ workMode: 'office', punches: [{ at: `${TODAY}T08:55:00+05:00`, direction: 'in' }] }));

    click(root, 'punch-button');
    await settle();
    expect(text(root.querySelector('[data-testid=punch-error]') as HTMLElement)).toContain("We couldn't find where you are.");

    placeBrowser(AT_THE_OFFICE);
    click(root, 'punch-button');
    await settle();
    http.expectOne(PUNCH).flush('', { status: 500, statusText: 'Server Error' });
    await settle();
    expect(text(root.querySelector('[data-testid=punch-error]') as HTMLElement)).toBe("That punch didn't save. Try again in a moment.");
  });
});
