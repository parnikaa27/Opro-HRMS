import { initialsOf } from './initials';

describe('initialsOf', () => {
  it('takes the first letter of the first two names', () => {
    expect(initialsOf('mariyam  nisha ali')).toBe('MN');
    expect(initialsOf('Shiyam')).toBe('S');
  });
});
