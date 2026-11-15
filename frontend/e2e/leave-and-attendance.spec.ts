import { expect, Page, test } from '@playwright/test';

const FRIDAY = 5;
const DAYS_AHEAD = 14;

// A working day two weeks out, so the journey never depends on today's date.
const futureWorkday = () => {
  const day = new Date(Date.now() + DAYS_AHEAD * 86_400_000);
  const shift = day.getUTCDay() === FRIDAY ? 1 : 0;
  return new Date(day.getTime() + shift * 86_400_000).toISOString().slice(0, 10);
};

const signInAs = async (page: Page, employeeId: string) => {
  await page.goto('/login');
  await page.getByTestId(`login-as-${employeeId}`).click();
  await expect(page.getByTestId('greeting')).toBeVisible();
};

test('an employee applies for half a day, sees it pending, then cancels it', async ({ page }) => {
  await signInAs(page, 'OPR-0023');
  await page.getByTestId('nav-leave').click();

  await page.getByTestId('apply-leave').click();
  await page.getByTestId('leave-submit').click();
  await expect(page.getByText('Pick your first day.')).toBeVisible();

  const day = futureWorkday();
  await page.getByTestId('leave-from').fill(day);
  await page.getByTestId('leave-to').fill(day);
  await page.getByTestId('leave-half').selectOption('first');
  await page.getByTestId('leave-reason').fill('Visa office appointment');
  await expect(page.getByTestId('leave-preview')).toContainText('0.5 days requested');
  await page.getByTestId('leave-submit').click();
  await expect(page.getByTestId('success-state')).toContainText('Request submitted');
  await page.getByTestId('success-state').getByRole('button', { name: 'Done' }).click();

  const request = page.getByTestId('leave-request').filter({ hasText: 'morning only' }).last();
  await expect(request).toContainText('Pending');

  await request.getByTestId('cancel-request').click();
  await request.getByTestId('confirm-cancel').click();
  await expect(request).toContainText('Cancelled');
});

test('an employee asks for a punch fix and sees it pending', async ({ page }) => {
  await signInAs(page, 'OPR-0015');
  await page.getByTestId('nav-attendance').click();
  await expect(page.getByTestId('attendance-row').first()).toBeVisible();

  await page.getByTestId('open-fix').click();
  await page.getByTestId('fix-time').fill('17:30');
  await page.getByTestId('fix-kind').selectOption('missed-out');
  await page.getByTestId('fix-reason').fill('The reader rejected my finger twice');
  await page.getByTestId('fix-submit').click();
  await expect(page.getByTestId('success-state')).toContainText('Fix requested');
  await page.getByTestId('success-state').getByRole('button', { name: 'Done' }).click();

  await expect(page.getByTestId('correction').filter({ hasText: 'The reader rejected my finger twice' })).toContainText('Pending');
});

test('attendance can look at last month and export it', async ({ page }) => {
  await signInAs(page, 'OPR-0015');
  await page.getByTestId('nav-attendance').click();

  const picker = page.getByTestId('month-picker');
  await expect(picker.locator('option')).toHaveCount(6);
  const lastMonth = (await picker.locator('option').nth(1).textContent())?.trim() ?? '';
  await picker.selectOption({ label: lastMonth });
  await expect(page.locator('.full-table .eyebrow')).toHaveText(lastMonth.toUpperCase());
  await expect(page.getByTestId('attendance-row').first()).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByTestId('export-report').click();
  expect((await download).suggestedFilename()).toMatch(/^attendance-\d{4}-\d{2}\.csv$/);
});
