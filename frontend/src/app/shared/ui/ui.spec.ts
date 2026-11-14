import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { text } from '../../../testing/fixtures';
import { Avatar } from './avatar';
import { Card } from './card';
import { Icon } from './icon';
import { StatusPill } from './status-pill';

@Component({
  imports: [Avatar, Card, Icon, StatusPill],
  template: `
    <app-avatar name="Mariyam  Nisha Ali" />
    <app-avatar name="Big Face" [isLarge]="true" data-testid="large-avatar" />
    <app-status-pill tone="late">Late</app-status-pill>
    <app-icon name="bell" />
    <app-card label="Today" [isLoading]="isLoading" [hasError]="hasError"><p data-testid="body">Body</p></app-card>
  `,
})
class Host {
  isLoading = false;
  hasError = false;
}

const render = async (state: Partial<Host> = {}) => {
  const fixture = TestBed.createComponent(Host);
  Object.assign(fixture.componentInstance, state);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
};

describe('shared UI', () => {
  it('shows two initials, the tone and the icon path', async () => {
    const element = await render();

    expect(text(element.querySelector('app-avatar') as HTMLElement)).toBe('MN');
    expect(element.querySelector('app-avatar')?.className).toContain('size-9');
    expect(element.querySelector('[data-testid=large-avatar]')?.className).toContain('size-14');
    expect(element.querySelector('app-status-pill span')?.className).toContain('text-late');
    expect(element.querySelector('app-icon path')?.getAttribute('d')).toMatch(/^M6 16/);
  });

  it('shows card content with its label once loaded', async () => {
    const element = await render();

    expect(element.querySelector('h2')?.textContent).toBe('Today');
    expect(element.querySelector('[data-testid=body]')).not.toBeNull();
  });

  it('shows a skeleton while loading and a message on failure', async () => {
    expect((await render({ isLoading: true })).querySelector('[data-testid=card-loading]')).not.toBeNull();
    expect((await render({ hasError: true })).querySelector('[data-testid=card-error]')).not.toBeNull();
  });
});
