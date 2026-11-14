import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { text } from '../../../testing/fixtures';
import { Avatar } from './avatar';
import { CircleProgress } from './circle-progress';
import { Icon } from './icon';
import { ListSkeleton } from './list-skeleton';
import { Logo } from './logo';
import { StatusPill } from './status-pill';
import { WelcomeBanner } from './welcome-banner';

@Component({
  imports: [Avatar, CircleProgress, Icon, ListSkeleton, Logo, StatusPill, WelcomeBanner],
  template: `
    <app-avatar name="Mariyam  Nisha Ali" />
    <app-avatar name="Big Face" [isLarge]="true" data-testid="large-avatar" />
    <app-avatar name="Has Photo" photoUrl="/api/employees/E/photo?v=1" data-testid="photo-avatar" />
    <app-status-pill tone="late">Late</app-status-pill>
    <app-status-pill tone="neutral" data-testid="neutral-pill">Weekend</app-status-pill>
    <app-icon name="bell" data-testid="paths" />
    <app-icon name="help" data-testid="circle" />
    <app-icon name="calendar" [size]="18" data-testid="rect" />
    <app-icon name="mapPin" data-testid="mixed" />
    <app-icon name="sparkles" data-testid="lines" />
    <app-logo data-testid="logo" />
    <app-logo [isCompact]="true" data-testid="compact-logo" />
    <app-circle-progress [percent]="150" label="9h" sub="of 8 hours" colour="amber" />
    <app-welcome-banner dateLabel="THURSDAY, 12 NOVEMBER" heading="Good morning, Kasun." line="Here’s your day." />
    <app-list-skeleton [count]="2" />
  `,
})
class Host {}

const render = async () => {
  const fixture = TestBed.createComponent(Host);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
};

describe('shared UI', () => {
  it('shows initials in a stable colour, large when asked', async () => {
    const element = await render();

    expect(text(element.querySelector('app-avatar') as HTMLElement)).toBe('MN');
    expect(element.querySelector('app-avatar')?.classList).toContain('avatar');
    expect(element.querySelector('[data-testid=large-avatar]')?.classList).toContain('large');
    expect(element.querySelector('[data-testid=photo-avatar] img')?.getAttribute('src')).toBe('/api/employees/E/photo?v=1');
  });

  it('maps tones onto the design’s pill colours', async () => {
    const element = await render();

    expect([...(element.querySelector('app-status-pill span')?.classList ?? [])].sort()).toEqual(['late', 'status-pill']);
    expect(element.querySelector('[data-testid=neutral-pill] span')?.className).toContain('neutral');
  });

  it('draws every Lucide shape type at the requested size', async () => {
    const element = await render();
    const shapes = (testId: string) => element.querySelector(`[data-testid=${testId}] svg`)?.children.length;

    expect(shapes('paths')).toBe(2);
    expect(element.querySelector('[data-testid=circle] circle')).not.toBeNull();
    expect(element.querySelector('[data-testid=rect] rect')).not.toBeNull();
    expect((element.querySelector('[data-testid=rect]') as HTMLElement).style.width).toBe('18px');
    expect(shapes('mixed')).toBeGreaterThan(1);
    expect(element.querySelector('[data-testid=lines] path')).not.toBeNull();
  });

  it('shows the full or compact logo', async () => {
    const element = await render();

    expect(text(element.querySelector('[data-testid=logo]') as HTMLElement)).toBe('O opro');
    expect(text(element.querySelector('[data-testid=compact-logo]') as HTMLElement)).toBe('O');
  });

  it('caps the ring at full and labels it for screen readers', async () => {
    const ring = (await render()).querySelector('.circle-progress') as HTMLElement;

    expect(ring.style.getPropertyValue('--progress')).toBe('360deg');
    expect(ring.style.getPropertyValue('--ring')).toBe('#fdba4a');
    expect(ring.getAttribute('aria-label')).toBe('9h of 8 hours');
  });

  it('renders the welcome banner and a loading skeleton', async () => {
    const element = await render();

    expect(text(element.querySelector('.welcome') as HTMLElement)).toBe('THURSDAY, 12 NOVEMBER Good morning, Kasun. Here’s your day.');
    expect(element.querySelectorAll('[data-testid=list-loading] li')).toHaveLength(2);
  });
});
