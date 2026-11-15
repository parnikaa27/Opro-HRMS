import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Session } from '../../core/session';
import { click, manager, NOW, respond, setupHttp, text, texts } from '../../../testing/fixtures';
import { CalendarPage } from './calendar-page';

const HOLIDAYS = [
  { date: '2026-11-11', name: 'Republic Day', isTentative: false },
  { date: '2026-12-01', name: 'Made up day', isTentative: true },
];

describe('CalendarPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    http = setupHttp();
  });

  afterEach(() => vi.useRealTimers());

  const render = async (showsTeamLeave = false) => {
    const fixture = TestBed.createComponent(CalendarPage);
    fixture.componentRef.setInput('showsTeamLeave', showsTeamLeave);
    await respond(http, {
      '/api/holidays?year=2026': HOLIDAYS,
      '/api/holidays?year=2027': [{ date: '2027-01-01', name: "New Year's Day", isTentative: false }],
      '/api/events?year=2026': [{ id: 'EV-1', date: '2026-11-19', name: 'Team review' }],
      '/api/team/leave-requests': [
        { employeeId: 'M', employeeName: 'Sneha Kulkarni', from: '2026-11-19', to: '2026-11-21', status: 'pending' },
        { employeeId: 'K', employeeName: 'Arjun Reddy', from: '2026-11-04', to: '2026-11-04', status: 'approved' },
        { employeeId: 'G', employeeName: 'Kavya Menon', from: '2026-11-26', to: '2026-11-26', status: 'rejected' },
      ],
    });
    return fixture.nativeElement as HTMLElement;
  };

  const cell = (root: HTMLElement, day: number) => texts(root, 'calendar-day')[day - 1];

  it('lays out the month from Sunday with holidays, events and today', async () => {
    const root = await render();

    expect(root.querySelectorAll('.calendar-days > div')).toHaveLength(35);
    expect(root.querySelectorAll('.calendar-days > .muted')).toHaveLength(5);
    expect(cell(root, 11)).toBe('11 Republic Day');
    expect(cell(root, 19)).toBe('19 Team review');
    expect(root.querySelector('.calendar-days > .today')?.textContent).toContain('12');
  });

  it('lists the next three holidays across the year end', async () => {
    const root = await render();

    expect(texts(root, 'upcoming-holiday')).toEqual(['01 DEC Made up day Tuesday · Tentative date', "01 JAN New Year's Day Friday · Public holiday"]);
  });

  it('adds who is away for managers, skipping weekends and declined leave', async () => {
    TestBed.inject(Session).user.set(manager());
    const root = await render(true);

    expect(cell(root, 4)).toBe('4 Arjun Reddy');
    expect(cell(root, 19)).toBe('19 Team review Sneha Kulkarni');
    expect(cell(root, 20)).toBe('20');
    expect(cell(root, 26)).toBe('26');
    expect(root.querySelector('small.pending')?.getAttribute('title')).toBe('Sneha Kulkarni, waiting for approval');
  });

  it('moves between months', async () => {
    const root = await render();

    click(root, 'next-month');
    expect(text(root.querySelector('[data-testid=month-label]') as HTMLElement)).toBe('December 2026');
    click(root, 'previous-month');
    click(root, 'previous-month');
    expect(text(root.querySelector('[data-testid=month-label]') as HTMLElement)).toBe('October 2026');
  });
});
