import { daysUntil, maldivesToday } from '../../shared/utils/date-time';
import { plural } from '../../shared/utils/text';

// "Submitted today", "Submitted yesterday", "Submitted 3 days ago".
export const submittedAgo = (date: string, today = maldivesToday()) => {
  const days = daysUntil(today, date);
  return days <= 0 ? 'Submitted today' : days === 1 ? 'Submitted yesterday' : `Submitted ${plural(days, 'day')} ago`;
};
