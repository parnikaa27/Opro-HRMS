import { TestBed } from '@angular/core/testing';
import { texts } from '../../../testing/fixtures';
import { LeaveBalances } from './leave-balances';

describe('LeaveBalances', () => {
  it('rings the first two balances, says what carried over, and shows the rest as special leave', async () => {
    const fixture = TestBed.createComponent(LeaveBalances);
    fixture.componentRef.setInput('types', [
      { code: 'annual', name: 'Annual leave', allowsHalfDay: true },
      { code: 'sick', name: 'Sick leave', allowsHalfDay: true },
      { code: 'family', name: 'Family responsibility leave', allowsHalfDay: true },
    ]);
    fixture.componentRef.setInput('balances', [
      { type: 'annual', entitled: 30, taken: 9, pending: 8, carriedOver: 5 },
      { type: 'sick', entitled: 0, taken: 0, pending: 0 },
      { type: 'family', entitled: 10, taken: 3, pending: 0 },
      { type: 'study', entitled: 2, taken: 0, pending: 0 },
    ]);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    expect(texts(root, 'leave-balance')).toEqual([
      '13 annual days Annual leave 13 of 30 days available, 5 carried over',
      '0 sick days Sick leave 0 of 0 days available',
      'Family responsibility leave 7 days available Caring for a sick family member',
      'study 2 days available',
    ]);
    expect((root.querySelector('.progress-track i') as HTMLElement).style.width).toBe('43.3333%');
    expect(root.querySelectorAll('.progress-track')[1].classList).toContain('amber');
  });
});
