import { TestBed } from '@angular/core/testing';
import { respond, setupHttp, text } from '../../../testing/fixtures';
import { LeaveCard } from './leave-card';

describe('LeaveCard', () => {
  it('shows annual leave left, other balances by name, and pending days', async () => {
    const http = setupHttp();
    const fixture = TestBed.createComponent(LeaveCard);
    await respond(http, {
      '/api/leave/balances': [
        { type: 'annual', entitled: 30, taken: 9, pending: 8 },
        { type: 'sick', entitled: 30, taken: 1, pending: 0 },
        { type: 'paternity', entitled: 3, taken: 0, pending: 0 },
      ],
      '/api/leave/types': [{ code: 'sick', name: 'Sick leave', allowsHalfDay: true }],
    });
    const element = fixture.nativeElement as HTMLElement;

    expect(text(element.querySelector('[data-testid=annual-left]') as HTMLElement)).toBe('13');
    expect(text(element)).toContain('Sick leave 29');
    expect(text(element)).toContain('paternity 3');
    expect(text(element)).toContain('8 days waiting for approval');
  });
});
