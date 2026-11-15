import { expect, Page, test } from '@playwright/test';

// A real 1 by 1 PNG, so the browser can decode and crop it like any photo.
const TINY_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

const signInAs = async (page: Page, employeeId: string) => {
  await page.goto('/login');
  await page.getByTestId(`login-as-${employeeId}`).click();
  await expect(page.getByTestId('greeting')).toBeVisible();
};

test('HR changes the work schedule from a future date, then takes it back', async ({ page }) => {
  await signInAs(page, 'OPR-0002');
  await page.goto('/hr/policy');

  await page.getByTestId('change-schedule').click();
  await page.getByTestId('schedule-from').fill('2027-03-01');
  await page.getByTestId('schedule-start').fill('08:30');
  await page.getByTestId('schedule-end').fill('16:30');
  await page.getByTestId('schedule-reason').fill('Earlier start for the site team');
  await page.getByTestId('schedule-submit').click();
  const change = page.getByTestId('schedule-row').filter({ hasText: 'Earlier start for the site team' });
  await expect(change).toContainText('Starts 1 Mar');

  await change.getByTestId('cancel-schedule').click();
  await change.getByTestId('confirm-yes').click();
  await expect(change).toHaveCount(0);
});

test('HR adds a missing punch with a reason, and the day says it was corrected', async ({ page }) => {
  await signInAs(page, 'OPR-0002');
  await page.goto('/hr/people/OPR-0023');

  await page.getByTestId('edit-punches').first().click();
  await page.getByTestId('punch-time').fill('23:58');
  await page.getByTestId('punch-reason').fill('Late shift at the port, device was down');
  await page.getByTestId('punch-submit').click();
  await expect(page.getByTestId('punch-log')).toContainText('Late shift at the port');
  await page.getByRole('button', { name: 'Done' }).click();

  await expect(page.getByTestId('attendance-row').first()).toContainText('Corrected');
});

test('HR adds a person, gives them a photo, and marks them as leaving', async ({ page }) => {
  // A whole journey across several screens or three sign ins, so it gets the longer timeout.
  test.slow();
  await signInAs(page, 'OPR-0002');
  await page.goto('/hr/people');
  await page.getByTestId('add-person').click();

  await page.getByTestId('employee-name').fill('Fathimath Nazra');
  await page.getByTestId('employee-designation').fill('Accounts Officer');
  await page.getByTestId('employee-department').fill('Finance');
  await page.getByTestId('employee-manager').selectOption('OPR-0001');
  await page.getByTestId('employee-email').fill('fathimath.nazra@opro.mv');
  await page.getByTestId('employee-joined').fill('2026-01-04');
  await page.getByTestId('employee-phone').fill('+960 777 1030');
  await page.getByTestId('employee-nationality').fill('Maldivian');
  await page.getByTestId('employee-contact-name').fill('Ali Nazir');
  await page.getByTestId('employee-contact-relation').fill('Father');
  await page.getByTestId('employee-contact-phone').fill('+960 777 2030');
  await page.getByTestId('employee-submit').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Fathimath Nazra');

  await page.getByTestId('person-menu').click();
  await page.getByTestId('change-photo').click();
  await page.getByTestId('photo-file').setInputFiles({ name: 'face.png', mimeType: 'image/png', buffer: TINY_PNG });
  await page.getByTestId('photo-submit').click();
  await expect(page.getByTestId('staff-photo')).toBeVisible();

  await page.getByTestId('person-menu').click();
  await page.getByTestId('mark-leaving').click();
  await page.getByTestId('leaving-date').fill('2026-02-01');
  await page.getByTestId('leaving-reason').fill('Probation not passed');
  await page.getByTestId('leaving-submit').click();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByTestId('leaving-note')).toContainText('Left on 1 February 2026');

  await page.goto('/login');
  await expect(page.getByText('Fathimath Nazra')).toHaveCount(0);
});

test('a sick note goes up with the request, and only HR can open it', async ({ page }) => {
  // A whole journey across several screens or three sign ins, so it gets the longer timeout.
  test.slow();
  await signInAs(page, 'OPR-0023');
  await page.goto('/leave');
  await page.getByTestId('apply-leave').click();
  await page.getByTestId('leave-type').selectOption('sick');
  await page.getByTestId('leave-from').fill('2027-02-14');
  await page.getByTestId('leave-to').fill('2027-02-16');
  await page.getByTestId('leave-reason').fill('Dengue, three days of rest');
  await page.getByTestId('leave-certificate').setInputFiles({ name: 'note.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 sick note') });
  await page.getByTestId('leave-submit').click();
  await page.getByRole('button', { name: 'Done' }).click();
  const request = page.getByTestId('leave-request').filter({ hasText: '14 Feb to 16 February 2027' });
  await expect(request.getByTestId('certificate')).toContainText('Medical certificate attached');

  await page.getByTestId('sidebar-sign-out').click();
  await signInAs(page, 'OPR-0004');
  await page.goto('/team/approvals');
  const asManager = page.getByTestId('leave-row').filter({ hasText: 'Ahmed Zahir' }).filter({ hasText: 'Sick leave' });
  await expect(asManager.getByTestId('certificate')).toHaveText('Medical certificate attached');
  await expect(asManager.getByTestId('certificate').getByRole('link')).toHaveCount(0);

  await page.getByTestId('sidebar-sign-out').click();
  await signInAs(page, 'OPR-0002');
  await page.goto('/hr/leave');
  const asHr = page.getByTestId('leave-row').filter({ hasText: 'Ahmed Zahir' }).filter({ hasText: 'Sick leave' });
  const href = await asHr.getByTestId('certificate').getByRole('link', { name: 'View' }).getAttribute('href');
  const file = await page.request.get(href ?? '');
  expect(file.headers()['content-type']).toBe('application/pdf');
});

// The latest day before today that falls Sunday to Thursday, as YYYY-MM-DD in Maldives time.
const lastWorkday = () => {
  const day = new Date(Date.now() + 5 * 60 * 60 * 1000);
  do {
    day.setUTCDate(day.getUTCDate() - 1);
  } while ([5, 6].includes(day.getUTCDay()));
  return day.toISOString().slice(0, 10);
};

test('an approved punch fix lands on the record, and the employee is told', async ({ page }) => {
  // Three sign ins in a row.
  test.slow();
  await signInAs(page, 'OPR-0023');
  await page.getByTestId('nav-attendance').click();
  await page.getByTestId('open-fix').click();
  await page.getByTestId('fix-date').fill(lastWorkday());
  await page.getByTestId('fix-kind').selectOption('missed-in');
  await page.getByTestId('fix-time').fill('06:05');
  await page.getByTestId('fix-reason').fill('Came in early for the stock count');
  await page.getByTestId('fix-submit').click();
  await page.getByTestId('success-state').getByRole('button', { name: 'Done' }).click();

  await page.getByTestId('sidebar-sign-out').click();
  await signInAs(page, 'OPR-0004');
  await page.goto('/team/approvals');
  await page.getByTestId('tab-fixes').click();
  await page.getByTestId('pending-fix').filter({ hasText: 'Came in early for the stock count' }).getByTestId('approve').click();
  await expect(page.getByTestId('pending-fix').filter({ hasText: 'Came in early for the stock count' })).toHaveCount(0);

  await page.getByTestId('sidebar-sign-out').click();
  await signInAs(page, 'OPR-0023');
  await page.getByTestId('notifications-button').click();
  await expect(page.getByTestId('notifications-panel')).toContainText('The 6:05 AM punch is now on your record.');
  await page.getByTestId('nav-attendance').click();
  await expect(page.getByTestId('attendance-row').filter({ hasText: '06:05 AM' })).toContainText('Corrected');
});
