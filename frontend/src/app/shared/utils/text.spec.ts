import { plural } from './text';

describe('plural', () => {
  it('adds an s for anything but one', () => {
    expect(plural(1, 'day')).toBe('1 day');
    expect(plural(0.5, 'day')).toBe('0.5 days');
    expect(plural(3, 'person', 'people')).toBe('3 people');
  });
});
