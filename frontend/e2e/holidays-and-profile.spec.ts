import { expect, Page, test } from '@playwright/test';

const signInAs = async (page: Page, employeeId: string) => {
  await page.goto('/login');
  await page.getByTestId(`login-as-${employeeId}`).click();
  await expect(page.getByTestId('greeting')).toBeVisible();
};

test('holidays show the year and can look ahead to next year', async ({ page }) => {
  await signInAs(page, 'OPR-0011');
  await page.getByRole('link', { name: 'Holidays', exact: true }).first().click();
  const year = Number(await page.getByTestId('year-label').textContent());

  await expect(page.getByTestId('holiday').first()).toBeVisible();
  await page.getByTestId('next-year').click();

  await expect(page.getByTestId('year-label')).toHaveText(String(year + 1));
  await expect(page.getByTestId('next-year')).toBeDisabled();
});

test('the profile shows the ID card and visa status, and prints only the card', async ({ page }) => {
  await signInAs(page, 'OPR-0018');
  await page.getByRole('link', { name: 'Profile', exact: true }).first().click();

  await expect(page.getByTestId('id-card-number')).toHaveText('OPR-0018');
  await expect(page.getByTestId('visa-document').first()).toContainText('Work visa');

  await page.emulateMedia({ media: 'print' });
  await expect(page.getByTestId('id-card-front')).toBeVisible();
  await expect(page.getByTestId('id-card-back')).toBeVisible();
  await expect(page.getByTestId('visa-document').first()).toBeHidden();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeHidden();
});

test('a Maldivian sees no visa section and can ask HR to fix a detail', async ({ page }) => {
  await signInAs(page, 'OPR-0011');
  await page.getByRole('link', { name: 'Profile', exact: true }).first().click();

  await expect(page.getByTestId('visa-none')).toContainText('Not needed');
  await page.getByTestId('request-change').click();
  await page.getByTestId('change-details').fill('+960 777 4321');
  await page.getByTestId('change-submit').click();

  await expect(page.getByTestId('change-sent')).toBeVisible();
});
