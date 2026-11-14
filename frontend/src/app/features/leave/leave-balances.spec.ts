import { TestBed } from '@angular/core/testing';
import { text } from '../../../testing/fixtures';
import { LeaveBalances } from './leave-balances';

describe('LeaveBalances', () => {
  it('shows what is left, what is taken and what is waiting', async () => {
    const fixture = TestBed.createComponent(LeaveBalances);
    fixture.componentRef.setInput('types', [{ code: 'annual', name: 'Annual leave', allowsHalfDay: true }]);
    fixture.componentRef.setInput('balances', [
      { type: 'annual', entitled: 30, taken: 9, pending: 8 },
      { type: 'paternity', entitled: 0, taken: 0, pending: 0 },
    ]);
    await fixture.whenStable();

    const tiles = [...(fixture.nativeElement as HTMLElement).querySelectorAll('[data-testid=leave-balance]')].map((tile) => text(tile));
    expect(tiles).toEqual(['Annual leave 13 of 30 left 9 taken, 8 waiting for approval', 'paternity 0 of 0 left 0 taken']);
  });
});
