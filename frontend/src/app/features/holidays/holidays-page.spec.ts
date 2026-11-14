import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Holiday } from '../../models/company';
import { click, fail, NOW, respond, setupHttp, text } from '../../../testing/fixtures';
import { HolidaysPage } from './holidays-page';

const YEAR_2026: Holiday[] = [
  { date: '2026-12-01', name: 'Made up day', isTentative: true },
  { date: '2026-08-14', name: 'National Day', isTentative: true },
  { date: '2026-11-12', name: 'Today day', isTentative: false },
  { date: '2026-11-03', name: 'Victory Day', isTentative: false },
];

describe('HolidaysPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    http = setupHttp();
  });

  afterEach(() => vi.useRealTimers());

  const render = async (holidays: Holiday[] = YEAR_2026) => {
    const fixture = TestBed.createComponent(HolidaysPage);
    await respond(http, { '/api/holidays?year=2026': holidays });
    return fixture.nativeElement as HTMLElement;
  };

  const rows = (root: HTMLElement) => [...root.querySelectorAll('[data-testid=holiday]')];

  it('groups by month in date order and counts what is left this year', async () => {
    const root = await render();

    expect([...root.querySelectorAll('h3')].map((heading) => text(heading))).toEqual(['August 2026', 'November 2026', 'December 2026']);
    expect(rows(root).map((row) => text(row))).toEqual([
      'Fri 14 Aug National Day',
      'Tue 3 Nov Victory Day',
      'Thu 12 Nov Today day Today',
      'Tue 1 Dec Made up day Tentative in 19 days',
    ]);
    expect(text(root.querySelector('[data-testid=holidays-summary]') as HTMLElement)).toBe('4 public holidays this year, 2 still to come.');
  });

  it('highlights the next holiday', async () => {
    const root = await render();

    const highlighted = rows(root).filter((row) => row.classList.contains('bg-sea-soft'));
    expect(highlighted.map((row) => text(row))).toEqual(['Thu 12 Nov Today day Today']);
  });

  it('moves one year either side and no further', async () => {
    const root = await render();

    click(root, 'next-year');
    await respond(http, { '/api/holidays?year=2027': [{ date: '2027-01-01', name: "New Year's Day", isTentative: false }] });
    expect(text(root.querySelector('[data-testid=year-label]') as HTMLElement)).toBe('2027');
    expect(text(root.querySelector('[data-testid=holidays-summary]') as HTMLElement)).toBe('1 public holiday in 2027.');
    expect((root.querySelector('[data-testid=next-year]') as HTMLButtonElement).disabled).toBe(true);

    click(root, 'previous-year');
    click(root, 'previous-year');
    await respond(http, { '/api/holidays?year=2025': [] });
    expect((root.querySelector('[data-testid=previous-year]') as HTMLButtonElement).disabled).toBe(true);
    expect(text(root.querySelector('[data-testid=holidays-empty]') as HTMLElement)).toBe("HR hasn't published the holidays for 2025 yet.");
  });

  it('explains when the calendar fails to load', async () => {
    const fixture = TestBed.createComponent(HolidaysPage);
    await fail(http, '/api/holidays?year=2026');

    expect(text(fixture.nativeElement)).toContain("The holiday calendar didn't load");
  });
});
