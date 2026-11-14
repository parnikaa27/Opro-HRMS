import { TestBed } from '@angular/core/testing';
import { Session } from '../../core/session';
import { employee, NOW, respond, setupHttp, text } from '../../../testing/fixtures';
import { DashboardPage, greetingFor } from './dashboard-page';

describe('DashboardPage', () => {
  afterEach(() => vi.useRealTimers());

  it('greets by first name with the date, and shows announcements', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    const http = setupHttp();
    TestBed.inject(Session).user.set(employee());

    const fixture = TestBed.createComponent(DashboardPage);
    await respond(http, {
      '/api/announcements': [{ id: 'AN-1', title: 'Year end dinner', body: 'Bring your family.', publishedOn: '2026-11-08' }],
    });
    const element = fixture.nativeElement as HTMLElement;

    expect(text(element.querySelector('[data-testid=greeting]') as HTMLElement)).toBe('Morning, Kasun.');
    expect(text(element)).toContain('Thursday 12 November');
    expect(text(element)).toContain('Year end dinner');
  });

  it.each([
    [9, 'Morning'],
    [14, 'Afternoon'],
    [20, 'Evening'],
  ])('says the right greeting at %i:00', (hour, greeting) => {
    expect(greetingFor(hour)).toBe(greeting);
  });
});
