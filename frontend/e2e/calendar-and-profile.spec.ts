import { expect, Page, test } from '@playwright/test';

const signInAs = async (page: Page, employeeId: string) => {
  await page.goto('/login');
  await page.getByTestId(`login-as-${employeeId}`).click();
  await expect(page.getByTestId('page-heading')).toBeVisible();
};

test('the calendar shows holidays and company events, and moves between months', async ({ page }) => {
  await signInAs(page, 'OPR-0011');
  await page.getByTestId('nav-calendar').click();

  await expect(page.getByRole('heading', { name: 'Holidays & events' })).toBeVisible();
  await expect(page.getByTestId('upcoming-holiday').first()).toBeVisible();
  const month = await page.getByTestId('month-label').textContent();
  await page.getByTestId('next-month').click();
  await expect(page.getByTestId('month-label')).not.toHaveText(month ?? '');
  await expect(page.getByTestId('calendar-day').first()).toBeVisible();
});

test('old holiday links still land on the calendar', async ({ page }) => {
  await signInAs(page, 'OPR-0011');

  await page.goto('/holidays');

  await expect(page).toHaveURL(/\/calendar$/);
});

test('the profile shows the ID card and visa status, and prints only the card', async ({ page }) => {
  await signInAs(page, 'OPR-0018');
  await page.getByTestId('account-button').click();
  await page.getByRole('link', { name: 'Your profile and ID card' }).click();

  await expect(page.getByTestId('id-card-number')).toHaveText('OPR-0018');
  await expect(page.getByTestId('visa-document').first()).toContainText('Work visa');

  await page.emulateMedia({ media: 'print' });
  await expect(page.getByTestId('id-card-front')).toBeVisible();
  await expect(page.getByTestId('id-card-back')).toBeVisible();
  await expect(page.getByTestId('visa-document').first()).toBeHidden();
  await expect(page.getByTestId('employee-card')).toBeHidden();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeHidden();
});

test('a Maldivian sees no visa section and can ask HR to fix a detail', async ({ page }) => {
  await signInAs(page, 'OPR-0011');
  await page.goto('/profile');

  await expect(page.getByTestId('visa-none')).toContainText('Not needed');
  await page.getByTestId('request-change').click();
  await page.getByTestId('change-details').fill('+960 777 4321');
  await page.getByTestId('change-submit').click();

  await expect(page.getByTestId('success-state')).toContainText('Sent to HR');
});
