import { initialsOf } from './initials';

describe('initialsOf', () => {
  it('takes the first letter of the first two names', () => {
    expect(initialsOf('sneha  kulkarni ali')).toBe('SK');
    expect(initialsOf('Shiyam')).toBe('S');
  });
});
