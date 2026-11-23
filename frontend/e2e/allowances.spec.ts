import { expect, Page, test } from '@playwright/test';

const signInAs = async (page: Page, employeeId: string) => {
  await page.goto('/login');
  await page.getByTestId(`login-as-${employeeId}`).click();
  await expect(page.getByTestId('page-heading')).toBeVisible();
};

test('HR sets a monthly allowance and the person sees it on their profile', async ({ page }) => {
  await signInAs(page, 'OPR-0002');
  await page.goto('/hr/people/OPR-0011');
  await page.getByTestId('add-allowance').click();
  await page.getByTestId('monthly-type').selectOption('phone');
  await page.getByTestId('monthly-amount').fill('350');
  await page.getByTestId('monthly-submit').click();
  await expect(page.getByTestId('hr-allowance').filter({ hasText: 'Phone' })).toContainText('MVR 350 a month');

  await signInAs(page, 'OPR-0011');
  await page.goto('/profile');
  await expect(page.getByTestId('my-allowance').filter({ hasText: 'Phone' })).toContainText('MVR 350 a month');
});

test('an HOD grants a one-off allowance, HR approves it, and the person sees it', async ({ page }) => {
  test.slow();
  await signInAs(page, 'OPR-0004');
  await page.goto('/team/OPR-0023');
  await page.getByTestId('grant-allowance').click();
  await page.getByTestId('grant-type').selectOption('transport');
  await page.getByTestId('grant-amount').fill('420');
  await page.getByTestId('grant-reason').fill('Taxis to the resort visits');
  await page.getByTestId('grant-submit').click();
  await expect(page.getByTestId('team-grant').filter({ hasText: 'Taxis to the resort visits' })).toContainText('Waiting for HR');

  await signInAs(page, 'OPR-0002');
  await page.goto('/hr/inbox');
  await page.getByTestId('waiting-grant').filter({ hasText: 'Taxis to the resort visits' }).getByTestId('approve').click();
  await expect(page.getByTestId('waiting-grant').filter({ hasText: 'Taxis to the resort visits' })).toHaveCount(0);

  await signInAs(page, 'OPR-0023');
  await page.goto('/profile');
  await expect(page.getByTestId('my-grant').filter({ hasText: 'Taxis to the resort visits' })).toContainText('Approved');
});
