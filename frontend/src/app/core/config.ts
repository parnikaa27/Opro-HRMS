export const MALDIVES_TIME_ZONE = 'Indian/Maldives';
export const EXPIRY_WARNING_DAYS = 60;
const FRIDAY = 5;
const SATURDAY = 6;
export const WEEKEND_DAYS: readonly number[] = [FRIDAY, SATURDAY];
// Shift placeholders until HR confirms: 8 working hours plus a 1 hour break.
export const SHIFT_MINUTES = 480;
export const BREAK_MINUTES = 60;

// Placeholders until Parnika confirms them.
export const COMPANY = {
  name: 'Opro',
  legalName: 'Opro Pvt Ltd',
  tagline: 'People first, always.',
  address: 'Malé, Republic of Maldives',
  hrEmail: 'hr@opro.mv',
  privacyUrl: 'https://opro.mv/privacy',
  policiesUrl: 'https://opro.mv/hr-policies',
} as const;
