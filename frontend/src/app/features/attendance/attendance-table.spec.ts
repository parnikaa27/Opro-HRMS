import { TestBed } from '@angular/core/testing';
import { click, settle, texts } from '../../../testing/fixtures';
import { AttendanceRow, AttendanceTable } from './attendance-table';

const day = (date: string): AttendanceRow => ({
  date, day: date, dateLabel: date, punchIn: '09:00 AM', punchOut: '05:00 PM', hours: '08h 00m', status: { label: 'On time', tone: 'ok' }, isEdited: false,
});
const MONTH = Array.from({ length: 10 }, (_, index) => day(`2026-11-${String(10 - index).padStart(2, '0')}`));

describe('AttendanceTable', () => {
  const render = async (pageSize?: number) => {
    const fixture = TestBed.createComponent(AttendanceTable);
    fixture.componentRef.setInput('rows', MONTH);
    if (pageSize) {
      fixture.componentRef.setInput('pageSize', pageSize);
    }
    await fixture.whenStable();
    return { fixture, root: fixture.nativeElement as HTMLElement };
  };

  it('shows every day without a page size', async () => {
    const { root } = await render();

    expect(texts(root, 'attendance-row')).toHaveLength(10);
    expect(root.querySelector('[data-testid=show-more-days]')).toBeNull();
  });

  it('opens on a week, shows more a week at a time, then fewer, and starts over for a new month', async () => {
    const { fixture, root } = await render(7);
    expect(texts(root, 'attendance-row')).toHaveLength(7);

    expect(texts(root, 'show-more-days')).toEqual(['Show 3 more days']);
    click(root, 'show-more-days');
    await settle();
    expect(texts(root, 'attendance-row')).toHaveLength(10);

    click(root, 'show-fewer-days');
    await settle();
    expect(texts(root, 'attendance-row')).toHaveLength(7);

    click(root, 'show-more-days');
    fixture.componentRef.setInput('rows', MONTH.slice(0, 9));
    await settle();
    expect(texts(root, 'attendance-row')).toHaveLength(7);
  });
});
