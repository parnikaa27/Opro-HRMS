import { TestBed } from '@angular/core/testing';
import { fail, respond, setupHttp, text } from '../../../testing/fixtures';
import { LeaveBalanceCard } from './leave-balance-card';

describe('LeaveBalanceCard', () => {
  it('adds up what is left and shows the first two types', async () => {
    const http = setupHttp();
    const fixture = TestBed.createComponent(LeaveBalanceCard);
    await respond(http, {
      '/api/leave/balances': [
        { type: 'annual', entitled: 30, taken: 9, pending: 8 },
        { type: 'sick', entitled: 30, taken: 29, pending: 0 },
        { type: 'family', entitled: 10, taken: 0, pending: 0 },
      ],
      '/api/leave/types': [{ code: 'annual', name: 'Annual leave', allowsHalfDay: true }],
    });
    const root = fixture.nativeElement as HTMLElement;

    expect(text(root.querySelector('[data-testid=days-available]') as HTMLElement)).toBe('24');
    expect(text(root.querySelector('.mini-stats') as HTMLElement)).toBe('Annual leave 13 days sick 1 day');
    expect(root.querySelector('[data-testid=request-leave]')?.getAttribute('href')).toBe('/leave?apply=1');
  });

  it('says so when balances fail to load', async () => {
    const http = setupHttp();
    const fixture = TestBed.createComponent(LeaveBalanceCard);
    await fail(http, '/api/leave/balances');

    expect(text(fixture.nativeElement)).toContain("Your balance didn't load");
  });
});
