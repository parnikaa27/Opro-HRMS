import { LeaveRequest } from '../../models/leave';
import { formatFullDate, formatShortDate } from '../../shared/utils/date-time';
import { plural } from '../../shared/utils/text';

const HALF: Record<'first' | 'second', string> = { first: 'morning', second: 'afternoon' };

export const describeDates = ({ from, to }: Pick<LeaveRequest, 'from' | 'to'>) =>
  from === to ? formatFullDate(from) : `${formatShortDate(from)} to ${formatFullDate(to)}`;

export const describeLength = ({ days, halfDay }: Pick<LeaveRequest, 'days' | 'halfDay'>) =>
  halfDay ? `${HALF[halfDay]} only` : plural(days, 'day');
