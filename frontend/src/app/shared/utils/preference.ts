// Small per browser conveniences only. Storage can be blocked, so every access is guarded.
export const readPreference = <T extends string>(key: string, allowed: readonly T[], fallback: T): T => {
  try {
    const stored = localStorage.getItem(key);
    return allowed.find((value) => value === stored) ?? fallback;
  } catch {
    return fallback;
  }
};

export const savePreference = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage is blocked, the preference just won't stick.
  }
};
