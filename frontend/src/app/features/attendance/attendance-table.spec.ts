import { TestBed } from '@angular/core/testing';
import { text, texts } from '../../../testing/fixtures';
import { AttendanceRow, AttendanceTable } from './attendance-table';

const ROW: AttendanceRow = {
  date: '2026-11-10', day: 'Tuesday', dateLabel: '10 Nov, Tue', punchIn: '08:55 AM', punchOut: '05:20 PM', hours: '08h 25m', status: { label: 'Present', tone: 'ok' }, isEdited: true,
};

describe('AttendanceTable', () => {
  const render = async (rows: AttendanceRow[]) => {
    const fixture = TestBed.createComponent(AttendanceTable);
    fixture.componentRef.setInput('rows', rows);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };

  it('says when a day was corrected by hand, for everyone who reads it', async () => {
    const root = await render([ROW]);

    expect(texts(root, 'attendance-row')).toEqual(['Tuesday 10 Nov, Tue 08:55 AM 05:20 PM 08h 25m Present Corrected']);
  });

  it('spans its empty state across every column', async () => {
    const root = await render([]);

    expect(root.querySelector('td')?.getAttribute('colspan')).toBe('5');
    expect(text(root.querySelector('td') as HTMLElement)).toBe('No punches recorded yet.');
  });
});
