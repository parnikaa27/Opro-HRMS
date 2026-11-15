import { DOCUMENT, inject, Injectable, signal } from '@angular/core';
import { readPreference, savePreference } from '../shared/utils/preference';

export type ThemeChoice = 'system' | 'light' | 'dark';

const THEMES: readonly ThemeChoice[] = ['system', 'light', 'dark'];
const THEME_KEY = 'opro.theme';

// Light, dark, or whatever the device uses. The stylesheet does the rest from the data-theme attribute.
@Injectable({ providedIn: 'root' })
export class Theme {
  private readonly root = inject(DOCUMENT).documentElement;
  readonly choice = signal<ThemeChoice>(readPreference(THEME_KEY, THEMES, 'system'));

  constructor() {
    this.apply(this.choice());
  }

  choose(choice: ThemeChoice) {
    this.choice.set(choice);
    savePreference(THEME_KEY, choice);
    this.apply(choice);
  }

  private apply(choice: ThemeChoice) {
    if (choice === 'system') {
      this.root.removeAttribute('data-theme');
    } else {
      this.root.setAttribute('data-theme', choice);
    }
  }
}
