import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Theme } from './theme';

describe('Theme', () => {
  afterEach(() => localStorage.clear());

  it('applies and remembers a manual choice, and hands back to the system', () => {
    const theme = TestBed.inject(Theme);
    const root = TestBed.inject(DOCUMENT).documentElement;

    theme.choice.set('dark');
    TestBed.tick();
    expect(root.dataset['theme']).toBe('dark');
    expect(localStorage.getItem('opro.theme')).toBe('dark');

    theme.choice.set('system');
    TestBed.tick();
    expect(root.dataset['theme']).toBeUndefined();
  });
});
