import { BankAccount, Experience } from '../../models/record';
import { Tone } from '../../shared/ui/status-pill';
import { formatCompactDate } from '../../shared/utils/date-time';

const BANK_STATUS: Record<BankAccount['status'], { label: string; tone: Tone }> = {
  pending: { label: 'Waiting for HR', tone: 'late' },
  verified: { label: 'Verified', tone: 'ok' },
  rejected: { label: 'Sent back', tone: 'danger' },
};

export const bankStatus = ({ status }: BankAccount) => BANK_STATUS[status];

// "01 Jul 2016 to 30 Nov 2023", or "From 01 Jul 2016" for a job they held until they joined.
export const describeExperience = ({ from, to }: Experience) => (to ? `${formatCompactDate(from)} to ${formatCompactDate(to)}` : `From ${formatCompactDate(from)}`);
