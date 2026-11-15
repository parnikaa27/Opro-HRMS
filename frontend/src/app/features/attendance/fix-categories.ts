import { FixCategory } from '../../models/attendance';

// The punch fix types people choose from, in the order the form offers them.
export const FIX_CATEGORIES: readonly { value: FixCategory; label: string }[] = [
  { value: 'resort', label: 'Working from resort' },
  { value: 'forgot', label: 'Forgot to punch' },
  { value: 'late', label: 'Late punch' },
  { value: 'other', label: 'Other' },
];

// A late punch and anything else need a reason before they go to the manager.
export const NEEDS_REASON: ReadonlySet<FixCategory> = new Set(['late', 'other']);

export const fixCategoryLabel = (category: FixCategory | undefined) => FIX_CATEGORIES.find(({ value }) => value === category)?.label ?? 'Punch fix';
