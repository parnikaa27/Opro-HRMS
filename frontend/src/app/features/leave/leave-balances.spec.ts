import { TestBed } from '@angular/core/testing';
import { NOW, text, texts } from '../../../testing/fixtures';
import { LeaveBalances } from './leave-balances';

describe('LeaveBalances', () => {
  const render = async (joinedOn?: string) => {
    const fixture = TestBed.createComponent(LeaveBalances);
    fixture.componentRef.setInput('types', [
      { code: 'annual', name: 'Annual leave', allowsHalfDay: true },
      { code: 'sick', name: 'Sick leave', allowsHalfDay: true },
      { code: 'comp-off', name: 'Compensatory off', allowsHalfDay: true },
    ]);
    fixture.componentRef.setInput('balances', [
      { type: 'annual', entitled: 30, taken: 9, pending: 8, carriedOver: 5, takenToDate: 6 },
      { type: 'sick', entitled: 0, taken: 0, pending: 0 },
      { type: 'comp-off', entitled: 1, taken: 0, pending: 0, takenToDate: 0, expiresOn: '2026-11-20' },
      { type: 'study', entitled: 2, taken: 0, pending: 0 },
    ]);
    fixture.componentRef.setInput('joinedOn', joinedOn);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => vi.useRealTimers());

  it('rings the first two balances and says what carried over', async () => {
    const root = await render();

    expect(texts(root, 'leave-balance')).toEqual(['13 annual days Annual leave 13 of 30 days available, 5 carried over', '0 sick days Sick leave 0 of 0 days available']);
    expect((root.querySelector('.progress-track i') as HTMLElement).style.width).toBe('43.3333%');
    expect(root.querySelectorAll('.progress-track')[1].classList).toContain('amber');
  });

  it('lists every type: this year, carried forward, approved, taken so far, waiting and left', async () => {
    const root = await render();

    expect(texts(root, 'balance-row')).toEqual([
      'Annual leave 25 5 9 6 8 13',
      'Sick leave 0 0 0 0 0 0',
      'Compensatory off Take by 20 Nov 1 0 0 0 0 1',
      'study 2 0 0 0 0 2',
    ]);
  });

  it('names the leave year from their joining date', async () => {
    const root = await render('2023-12-20');

    expect(text(root.querySelector('[data-testid=balance-table] h2') as HTMLElement)).toBe('20 Dec 2025 to 19 Dec 2026');
  });
});
