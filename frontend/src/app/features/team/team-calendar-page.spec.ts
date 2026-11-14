import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { fail, NOW, respond, setupHttp, text, texts } from '../../../testing/fixtures';
import { TeamCalendarPage } from './team-calendar-page';

describe('TeamCalendarPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    http = setupHttp();
  });

  afterEach(() => vi.useRealTimers());

  const render = async (leave: object[], holidays: object[] = []) => {
    const fixture = TestBed.createComponent(TeamCalendarPage);
    await respond(http, { '/api/team/leave-requests': leave, '/api/holidays?year=2026': holidays });
    return fixture.nativeElement as HTMLElement;
  };

  it('puts people and holidays on their days, skips weekends and ignores rejected leave', async () => {
    const root = await render(
      [
        { employeeId: 'M', employeeName: 'Mariyam Nisha', from: '2026-11-19', to: '2026-11-22', status: 'pending' },
        { employeeId: 'K', employeeName: 'Kasun Perera', from: '2026-11-04', to: '2026-11-04', status: 'approved' },
        { employeeId: 'G', employeeName: 'Grace Mendoza', from: '2026-11-26', to: '2026-11-26', status: 'rejected' },
      ],
      [{ date: '2026-11-11', name: 'Republic Day', isTentative: false }],
    );

    // Each cell carries the phone label ("Wed 4 Nov") and the grid label ("4"). Drop the second.
    expect(texts(root, 'calendar-day').map((cell) => cell.replace(/^(\w+ \d+ \w+) \d+/, '$1'))).toEqual([
      'Wed 4 Nov Kasun Perera',
      'Wed 11 Nov Republic Day',
      'Thu 19 Nov Mariyam Nisha',
      'Sun 22 Nov Mariyam Nisha',
    ]);
    expect(root.querySelector('[title="Mariyam Nisha, waiting for your decision"]')?.className).toContain('border-dashed');
    expect(root.querySelectorAll('ol > li')).toHaveLength(30 + 0);
  });

  it('says when everyone is in all month', async () => {
    expect(text(await render([]))).toContain("Everyone's in all month.");
  });

  it('explains when team leave fails to load', async () => {
    const fixture = TestBed.createComponent(TeamCalendarPage);
    await fail(http, '/api/team/leave-requests');

    expect(text(fixture.nativeElement)).toContain("Team leave didn't load");
  });
});
