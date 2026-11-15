export const MALDIVES_TIME_ZONE = 'Indian/Maldives';
export const EXPIRY_WARNING_DAYS = 60;
const FRIDAY = 5;
// Opro works Saturday to Thursday. Friday is the only day off each week.
export const WEEKEND_DAYS: readonly number[] = [FRIDAY];

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
