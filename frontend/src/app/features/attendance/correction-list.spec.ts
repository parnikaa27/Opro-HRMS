import { TestBed } from '@angular/core/testing';
import { text, texts } from '../../../testing/fixtures';
import { CorrectionList } from './correction-list';

describe('CorrectionList', () => {
  it('lists fixes newest first with their type, status and any manager note', async () => {
    const fixture = TestBed.createComponent(CorrectionList);
    fixture.componentRef.setInput('corrections', [
      { id: 'AC-1', employeeId: 'E', date: '2026-11-05', kind: 'missed-in', category: 'forgot', requestedTime: '08:55', reason: 'No device', status: 'approved', raisedOn: '2026-11-05' },
      { id: 'AC-2', employeeId: 'E', date: '2026-11-10', kind: 'missed-out', category: 'forgot', requestedTime: '17:20', reason: 'Offline', status: 'rejected', raisedOn: '2026-11-11', decisionNote: 'Log shows 16:30' },
      { id: 'AC-3', employeeId: 'E', date: '2026-11-01', kind: 'missed-out', category: 'resort', requestedTime: '17:00', status: 'pending', raisedOn: '2026-11-02' },
      { id: 'AC-4', employeeId: 'E', date: '2026-10-30', kind: 'missed-in', category: 'forgot', requestedTime: '09:00', status: 'pending', raisedOn: '2026-10-30', hodApprovedOn: '2026-10-31' },
    ]);
    await fixture.whenStable();

    expect(texts(fixture.nativeElement, 'correction')).toEqual([
      'Punch out at 17:20 10 Nov · Forgot to punch · Offline · “Log shows 16:30” Declined',
      'Punch in at 08:55 5 Nov · Forgot to punch · No device Fixed',
      'Punch out at 17:00 1 Nov · Working from resort Pending',
      'Punch in at 09:00 30 Oct · Forgot to punch Waiting for HR',
    ]);
  });

  it('explains what this list is for when empty', async () => {
    const fixture = TestBed.createComponent(CorrectionList);
    fixture.componentRef.setInput('corrections', []);
    await fixture.whenStable();

    expect(text(fixture.nativeElement)).toContain('No fixes requested');
  });
});
