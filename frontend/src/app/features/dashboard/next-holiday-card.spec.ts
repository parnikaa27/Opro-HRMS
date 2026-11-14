import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NOW, respond, setupHttp, text } from '../../../testing/fixtures';
import { NextHolidayCard } from './next-holiday-card';

describe('NextHolidayCard', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    http = setupHttp();
  });

  afterEach(() => vi.useRealTimers());

  const render = async (thisYear: object[], nextYear: object[] = []) => {
    const fixture = TestBed.createComponent(NextHolidayCard);
    await respond(http, { '/api/holidays?year=2026': thisYear, '/api/holidays?year=2027': nextYear });
    return fixture.nativeElement as HTMLElement;
  };

  it('shows the next holiday and the next long weekend', async () => {
    const root = await render(
      [
        { date: '2026-11-03', name: 'Victory Day', isTentative: false },
        { date: '2026-12-01', name: 'Made up Tuesday', isTentative: true },
      ],
      [{ date: '2027-01-03', name: 'Sunday holiday', isTentative: false }],
    );

    expect(text(root.querySelector('[data-testid=next-holiday]') as HTMLElement)).toBe('01 DEC Made up Tuesday Tuesday · Tentative');
    expect(text(root.querySelector('.holiday-countdown') as HTMLElement)).toBe('Your next long weekend is in 50 days');
  });

  it('counts a Thursday holiday from the day itself', async () => {
    const root = await render([{ date: '2026-11-19', name: 'Thursday off', isTentative: false }]);

    expect(text(root.querySelector('.holiday-countdown') as HTMLElement)).toBe('Your next long weekend is in 7 days');
  });

  it('says when nothing is coming up', async () => {
    const root = await render([]);

    expect(text(root)).toContain('No more holidays on the calendar yet.');
    expect(root.querySelector('.holiday-countdown')).toBeNull();
  });
});
