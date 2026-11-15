import { Employee } from '../../models/employee';
import { daysUntil, formatCompactDate } from '../../shared/utils/date-time';
import { expiryStatus } from '../../shared/utils/expiry';
import { plural } from '../../shared/utils/text';

export interface VisaAlert {
  id: string;
  employeeId: string;
  name: string;
  detail: string;
  days: string;
  daysLeft: number;
}

// Visas and passports that are expiring or expired, soonest first.
export const visaAlertsFor = (people: readonly Employee[], today: string): VisaAlert[] =>
  people
    .flatMap((person) => {
      const visa = person.visa;
      if (!visa) {
        return [];
      }
      return [
        { label: 'Visa', expiry: visa.visaExpiry },
        { label: 'Passport', expiry: visa.passportExpiry },
      ]
        .filter(({ expiry }) => expiryStatus(expiry, today) !== 'valid')
        .map(({ label, expiry }) => {
          const daysLeft = daysUntil(expiry, today);
          return {
            id: `${person.id}-${label}`,
            employeeId: person.id,
            name: person.fullName,
            detail: `${label} ${daysLeft < 0 ? 'expired' : 'expires'} ${formatCompactDate(expiry)}`,
            days: daysLeft < 0 ? 'Expired' : plural(daysLeft, 'day'),
            daysLeft,
          };
        });
    })
    .sort((first, second) => first.daysLeft - second.daysLeft);
