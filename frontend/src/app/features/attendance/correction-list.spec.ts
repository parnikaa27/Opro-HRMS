import { TestBed } from '@angular/core/testing';
import { text, texts } from '../../../testing/fixtures';
import { CorrectionList } from './correction-list';

describe('CorrectionList', () => {
  it('lists fixes newest first with their status and any manager note', async () => {
    const fixture = TestBed.createComponent(CorrectionList);
    fixture.componentRef.setInput('corrections', [
      { id: 'AC-1', employeeId: 'E', date: '2026-11-05', kind: 'missed-in', requestedTime: '08:55', reason: 'No device', status: 'approved', raisedOn: '2026-11-05' },
      { id: 'AC-2', employeeId: 'E', date: '2026-11-10', kind: 'missed-out', requestedTime: '17:20', reason: 'Offline', status: 'rejected', raisedOn: '2026-11-11', decisionNote: 'Log shows 16:30' },
      { id: 'AC-3', employeeId: 'E', date: '2026-11-01', kind: 'missed-out', requestedTime: '17:00', reason: 'Forgot', status: 'pending', raisedOn: '2026-11-02' },
    ]);
    await fixture.whenStable();

    expect(texts(fixture.nativeElement, 'correction')).toEqual([
      'Punch out at 17:20 10 Nov · Offline · “Log shows 16:30” Declined',
      'Punch in at 08:55 5 Nov · No device Fixed',
      'Punch out at 17:00 1 Nov · Forgot Pending',
    ]);
  });

  it('explains what this list is for when empty', async () => {
    const fixture = TestBed.createComponent(CorrectionList);
    fixture.componentRef.setInput('corrections', []);
    await fixture.whenStable();

    expect(text(fixture.nativeElement)).toContain('No fixes requested');
  });
});
