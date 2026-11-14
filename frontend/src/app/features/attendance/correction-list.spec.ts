import { TestBed } from '@angular/core/testing';
import { text } from '../../../testing/fixtures';
import { CorrectionList } from './correction-list';

describe('CorrectionList', () => {
  it('lists fixes newest first with their status', async () => {
    const fixture = TestBed.createComponent(CorrectionList);
    fixture.componentRef.setInput('corrections', [
      { id: 'AC-1', employeeId: 'E', date: '2026-11-05', kind: 'missed-in', requestedTime: '08:55', reason: 'No device', status: 'approved', raisedOn: '2026-11-05' },
      { id: 'AC-2', employeeId: 'E', date: '2026-11-10', kind: 'missed-out', requestedTime: '17:20', reason: 'Offline', status: 'rejected', raisedOn: '2026-11-11' },
    ]);
    await fixture.whenStable();

    const rows = [...(fixture.nativeElement as HTMLElement).querySelectorAll('[data-testid=correction]')].map((row) => text(row));
    expect(rows).toEqual(['10 Nov, punch out at 17:20 Offline Not approved', '5 Nov, punch in at 08:55 No device Fixed']);
  });

  it('explains what this list is for when empty', async () => {
    const fixture = TestBed.createComponent(CorrectionList);
    fixture.componentRef.setInput('corrections', []);
    await fixture.whenStable();

    expect(text(fixture.nativeElement)).toContain('No fixes requested');
  });
});
