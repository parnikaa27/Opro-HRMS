import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { click, text } from '../../../testing/fixtures';
import { MonthSwitcher } from './month-switcher';

@Component({
  imports: [MonthSwitcher],
  template: `<app-month-switcher [(month)]="month" [latest]="latest()" />`,
})
class Host {
  readonly month = signal('2026-11');
  readonly latest = signal<string | undefined>('2026-11');
}

describe('MonthSwitcher', () => {
  it('steps back and forward, stopping at the latest month', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const next = () => root.querySelector('[data-testid=next-month]') as HTMLButtonElement;

    expect(next().disabled).toBe(true);
    click(root, 'previous-month');
    expect(fixture.componentInstance.month()).toBe('2026-10');
    expect(text(root.querySelector('[data-testid=month-label]') as HTMLElement)).toBe('October 2026');
    expect(next().getAttribute('aria-label')).toBe('Show November 2026');

    click(root, 'next-month');
    expect(fixture.componentInstance.month()).toBe('2026-11');
  });

  it('lets people look ahead freely when there is no latest month', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.latest.set(undefined);
    await fixture.whenStable();

    click(fixture.nativeElement, 'next-month');

    expect(fixture.componentInstance.month()).toBe('2026-12');
  });
});
