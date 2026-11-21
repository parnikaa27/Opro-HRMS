import { LeaveRequest } from '../../models/leave';
import { formatFullDate, formatShortDate } from '../../shared/utils/date-time';
import { plural } from '../../shared/utils/text';

const HALF: Record<'first' | 'second', string> = { first: 'morning', second: 'afternoon' };

export const describeDates = ({ from, to }: Pick<LeaveRequest, 'from' | 'to'>) =>
  from === to ? formatFullDate(from) : `${formatShortDate(from)} to ${formatFullDate(to)}`;

export const describeLength = ({ days, halfDay }: Pick<LeaveRequest, 'days' | 'halfDay'>) =>
  halfDay ? `${HALF[halfDay]} only` : plural(days, 'day');

const KIND_LABEL = { amended: 'Changes an earlier request', extended: 'Extends an earlier request' } as const;

// What the paper form's boxes say: amended or extended, and the flight and salary advance ticks.
export const describeExtras = ({ kind, usesFlightEntitlement, wantsSalaryAdvance }: Pick<LeaveRequest, 'kind' | 'usesFlightEntitlement' | 'wantsSalaryAdvance'>) =>
  [kind && kind !== 'initial' && KIND_LABEL[kind], usesFlightEntitlement && 'Uses flight entitlement', wantsSalaryAdvance && 'Salary in advance']
    .filter((part) => typeof part === 'string')
    .join(' · ');
