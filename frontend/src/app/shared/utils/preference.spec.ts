import { readPreference, savePreference } from './preference';

describe('preferences', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('reads back a saved value that is allowed', () => {
    savePreference('opro.test', 'dark');

    expect(readPreference('opro.test', ['light', 'dark'], 'light')).toBe('dark');
  });

  it('falls back when the stored value is unknown', () => {
    localStorage.setItem('opro.test', 'neon');

    expect(readPreference('opro.test', ['light', 'dark'], 'light')).toBe('light');
  });

  it('survives storage being blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(() => savePreference('opro.test', 'dark')).not.toThrow();
    expect(readPreference('opro.test', ['light', 'dark'], 'light')).toBe('light');
  });
});
