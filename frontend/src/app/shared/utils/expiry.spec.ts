import { expiryStatus } from './expiry';

describe('expiryStatus', () => {
  it.each([
    ['2027-03-30', 'valid'],
    ['2027-01-11', 'expiring'],
    ['2026-11-12', 'expiring'],
    ['2026-11-11', 'expired'],
  ])('treats %s as %s on 12 November 2026', (expiry, status) => {
    expect(expiryStatus(expiry, '2026-11-12')).toBe(status);
  });
});
