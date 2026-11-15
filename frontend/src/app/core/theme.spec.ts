import { TestBed } from '@angular/core/testing';
import { Theme } from './theme';

describe('Theme', () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('follows the device until someone chooses, and leaves no attribute', () => {
    const theme = TestBed.inject(Theme);

    expect(theme.choice()).toBe('system');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('applies and remembers a choice, and can go back to the device setting', () => {
    const theme = TestBed.inject(Theme);

    theme.choose('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('opro.theme')).toBe('dark');

    theme.choose('system');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('applies a saved choice as soon as it starts', () => {
    localStorage.setItem('opro.theme', 'light');

    TestBed.inject(Theme);

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
