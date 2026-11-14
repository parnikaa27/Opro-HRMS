import { expect, Page, test } from '@playwright/test';

const FRIDAY = 5;
const SATURDAY = 6;
const DAYS_AHEAD = 14;

// A working day two weeks out, so the journey never depends on today's date.
const futureWorkday = () => {
  const day = new Date(Date.now() + DAYS_AHEAD * 86_400_000);
  const shift = day.getUTCDay() === FRIDAY ? 2 : day.getUTCDay() === SATURDAY ? 1 : 0;
  return new Date(day.getTime() + shift * 86_400_000).toISOString().slice(0, 10);
};

const signInAs = async (page: Page, employeeId: string) => {
  await page.goto('/login');
  await page.getByTestId(`login-as-${employeeId}`).click();
  await expect(page.getByTestId('greeting')).toBeVisible();
};

test('an employee applies for half a day, sees it waiting, then cancels it', async ({ page }) => {
  await signInAs(page, 'OPR-0023');
  await page.getByRole('link', { name: 'Leave', exact: true }).first().click();

  await page.getByTestId('apply-leave').click();
  await page.getByTestId('leave-submit').click();
  await expect(page.getByText('Pick your first day.')).toBeVisible();

  const day = futureWorkday();
  await page.getByTestId('leave-from').fill(day);
  await page.getByTestId('leave-to').fill(day);
  await page.getByTestId('leave-half').selectOption('first');
  await page.getByTestId('leave-reason').fill('Visa office appointment');
  await expect(page.getByTestId('leave-preview')).toContainText('0.5 working days');
  await page.getByTestId('leave-submit').click();

  const request = page.getByTestId('leave-request').filter({ hasText: 'Visa office appointment' });
  await expect(request).toContainText('morning only');
  await expect(request).toContainText('Waiting');

  await request.getByTestId('cancel-request').click();
  await request.getByTestId('confirm-cancel').click();
  await expect(request).toContainText('Cancelled');
});

test('an employee asks for a punch fix and sees it waiting', async ({ page }) => {
  await signInAs(page, 'OPR-0015');
  await page.getByRole('link', { name: 'Attendance', exact: true }).first().click();
  await expect(page.getByTestId('attendance-day').first()).toBeVisible();

  await page.getByTestId('open-fix').click();
  await page.getByTestId('fix-time').fill('17:30');
  await page.getByTestId('fix-reason').fill('The reader rejected my finger twice');
  await page.getByTestId('fix-submit').click();

  await expect(page.getByTestId('correction').filter({ hasText: 'The reader rejected my finger twice' })).toContainText('Waiting');
});

test('attendance can go back a month', async ({ page }) => {
  await signInAs(page, 'OPR-0015');
  await page.getByRole('link', { name: 'Attendance', exact: true }).first().click();
  const label = page.getByTestId('month-label');
  const current = await label.textContent();

  await page.getByTestId('previous-month').click();

  await expect(label).not.toHaveText(current ?? '');
  await expect(page.getByTestId('attendance-day').first()).toBeVisible();
});
