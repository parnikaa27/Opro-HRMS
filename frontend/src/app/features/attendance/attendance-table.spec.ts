import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { click, text, texts } from '../../../testing/fixtures';
import { AttendanceRow, AttendanceTable } from './attendance-table';

const ROW: AttendanceRow = {
  date: '2026-11-10', day: 'Tuesday', dateLabel: '10 Nov, Tue', punchIn: '08:55 AM', punchOut: '05:20 PM', hours: '08h 25m', status: { label: 'Present', tone: 'ok' }, isEdited: true,
};

@Component({
  imports: [AttendanceTable],
  template: `<app-attendance-table [rows]="rows()" [isEditable]="isEditable()" (edit)="edited.set($event)" />`,
})
class Host {
  readonly rows = signal<AttendanceRow[]>([ROW]);
  readonly isEditable = signal(false);
  readonly edited = signal<string | undefined>(undefined);
}

describe('AttendanceTable', () => {
  const render = async (isEditable: boolean, rows = [ROW]) => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.isEditable.set(isEditable);
    fixture.componentInstance.rows.set(rows);
    await fixture.whenStable();
    return { root: fixture.nativeElement as HTMLElement, host: fixture.componentInstance };
  };

  it('says when HR changed a day, for everyone who reads it', async () => {
    const { root } = await render(false);

    expect(texts(root, 'attendance-row')).toEqual(['Tuesday 10 Nov, Tue 08:55 AM 05:20 PM 08h 25m Present Edited by HR']);
    expect(root.querySelector('[data-testid=edit-punches]')).toBeNull();
  });

  it('offers HR a fix on every row, and an empty state across all columns', async () => {
    const { root, host } = await render(true);

    click(root, 'edit-punches');
    expect(host.edited()).toBe('2026-11-10');

    const empty = await render(true, []);
    expect(empty.root.querySelector('td')?.getAttribute('colspan')).toBe('6');
    expect(text(empty.root.querySelector('td') as HTMLElement)).toBe('No punches recorded yet.');
  });
});
