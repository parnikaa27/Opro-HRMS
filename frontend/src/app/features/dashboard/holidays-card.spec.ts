import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { fail, NOW, respond, setupHttp, text } from '../../../testing/fixtures';
import { HolidaysCard } from './holidays-card';

describe('HolidaysCard', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    http = setupHttp();
  });

  afterEach(() => vi.useRealTimers());

  it('shows the next three holidays across the year boundary', async () => {
    const fixture = TestBed.createComponent(HolidaysCard);
    await respond(http, {
      '/api/holidays?year=2026': [
        { date: '2026-11-03', name: 'Victory Day', isTentative: false },
        { date: '2026-12-01', name: 'Made up day', isTentative: true },
      ],
      '/api/holidays?year=2027': [
        { date: '2027-01-01', name: "New Year's Day", isTentative: false },
        { date: '2027-02-07', name: 'First day of Ramadan', isTentative: true },
        { date: '2027-03-09', name: 'Eid al Fitr', isTentative: true },
      ],
    });
    const holidays = [...(fixture.nativeElement as HTMLElement).querySelectorAll('[data-testid=upcoming-holiday]')].map((item) => text(item as HTMLElement));

    expect(holidays).toEqual([
      '1 Dec Made up day in 19 days Tentative',
      "1 Jan New Year's Day in 50 days",
      '7 Feb First day of Ramadan in 87 days Tentative',
    ]);
  });

  it('has something to say when the calendar is empty', async () => {
    const fixture = TestBed.createComponent(HolidaysCard);
    await respond(http, { '/api/holidays?year=2026': [], '/api/holidays?year=2027': [] });

    expect(text(fixture.nativeElement)).toContain('No more holidays');
  });

  it('shows an error if either year fails', async () => {
    const fixture = TestBed.createComponent(HolidaysCard);
    await fail(http, '/api/holidays?year=2027');

    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid=card-error]')).not.toBeNull();
  });
});
