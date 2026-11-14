import { DOCUMENT, effect, inject, Injectable, signal } from '@angular/core';
import { readPreference, savePreference } from '../shared/utils/preference';

export type ThemeChoice = 'system' | 'light' | 'dark';

const THEME_KEY = 'opro.theme';
export const THEME_CHOICES: readonly ThemeChoice[] = ['system', 'light', 'dark'];

@Injectable({ providedIn: 'root' })
export class Theme {
  private readonly root = inject(DOCUMENT).documentElement;
  readonly choice = signal(readPreference(THEME_KEY, THEME_CHOICES, 'system'));

  constructor() {
    effect(() => {
      const choice = this.choice();
      savePreference(THEME_KEY, choice);
      if (choice === 'system') {
        delete this.root.dataset['theme'];
      } else {
        this.root.dataset['theme'] = choice;
      }
    });
  }
}
