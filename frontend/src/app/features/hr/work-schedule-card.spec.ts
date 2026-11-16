import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { WorkSchedule } from '../../models/attendance';
import { click, fail, fill, NOW, respond, settle, setupHttp, text, texts } from '../../../testing/fixtures';
import { WorkScheduleCard } from './work-schedule-card';

const URL = '/api/hr/schedules';
const version = (overrides: Partial<WorkSchedule>): WorkSchedule => ({
  id: 'WS', effectiveFrom: '2024-01-01', shiftStart: '09:00', shiftEnd: '17:00', graceMinutes: 15, halfDayMinutes: 240,
  reason: 'Company hours', setBy: 'OPR-0002', setByName: 'Ananya Iyer', setOn: '2023-12-10', ...overrides,
});
const VERSIONS = [
  version({ id: 'WS-3', effectiveFrom: '2026-12-01', shiftStart: '08:30', shiftEnd: '16:30', reason: 'Earlier start', setOn: '2026-11-11' }),
  version({ id: 'WS-2', effectiveFrom: '2025-06-01', graceMinutes: 10, setByName: undefined }),
  version({ id: 'WS-1' }),
];

describe('WorkScheduleCard', () => {
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

  const render = async (versions = VERSIONS) => {
    const fixture = TestBed.createComponent(WorkScheduleCard);
    await respond(http, { [URL]: versions });
    return fixture.nativeElement as HTMLElement;
  };

  it('shows the coming change, the one in force and the ones before', async () => {
    const root = await render();

    expect(texts(root, 'schedule-row')).toEqual([
      '08:30 AM to 04:30 PM, late after 15 minutes Half day under 4 hours Earlier start · Ananya Iyer, 11 Nov 2026 Cancel this change Starts 1 Dec',
      '09:00 AM to 05:00 PM, late after 10 minutes Half day under 4 hours Company hours · OPR-0002, 10 Dec 2023 In force',
      '09:00 AM to 05:00 PM, late after 15 minutes Half day under 4 hours Company hours · Ananya Iyer, 10 Dec 2023 From 01 Jan 2024',
    ]);
  });

  it('cancels a coming change after asking, and says when that fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const root = await render();

    click(root, 'cancel-schedule');
    click(root, 'confirm-yes');
    http.expectOne(`${URL}/WS-3`).flush('', { status: 500, statusText: 'Server Error' });
    await settle();
    expect(root.querySelector('[data-testid=schedule-row] [role=alert]')).not.toBeNull();

    click(root, 'cancel-schedule');
    click(root, 'confirm-yes');
    http.expectOne(`${URL}/WS-3`).flush(null);
    await settle();
    expect(http.match(URL)).toHaveLength(1);
  });

  it('opens the form on the rules in force and reloads after saving', async () => {
    const root = await render();

    click(root, 'change-schedule');
    expect((root.querySelector('[data-testid=schedule-grace]') as HTMLInputElement).value).toBe('10');
    fill(root, 'schedule-from', '2027-01-03');
    fill(root, 'schedule-reason', 'New year hours');
    click(root, 'schedule-submit');
    await settle();
    http.expectOne((request) => request.method === 'POST' && request.url === URL).flush({});
    await settle();

    expect(root.querySelector('dialog')?.open).toBe(false);
    expect(http.match(URL)).toHaveLength(1);
  });

  it('says when the schedule fails to load', async () => {
    const fixture = TestBed.createComponent(WorkScheduleCard);
    await fail(http, URL);

    expect(text(fixture.nativeElement)).toContain("The work schedule didn't load");
  });
});
