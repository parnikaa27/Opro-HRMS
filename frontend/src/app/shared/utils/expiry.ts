import { EXPIRY_WARNING_DAYS } from '../../core/config';
import { daysUntil } from './date-time';

export type ExpiryStatus = 'valid' | 'expiring' | 'expired';

export const expiryStatus = (expiry: string, today: string): ExpiryStatus => {
  const daysLeft = daysUntil(expiry, today);
  return daysLeft < 0 ? 'expired' : daysLeft <= EXPIRY_WARNING_DAYS ? 'expiring' : 'valid';
};
