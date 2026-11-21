import { expect, Page, test } from '@playwright/test';

const signInAs = async (page: Page, employeeId: string) => {
  await page.goto('/login');
  await page.getByTestId(`login-as-${employeeId}`).click();
  await expect(page.getByTestId('greeting')).toBeVisible();
};

const signOut = (page: Page) => page.getByTestId('sidebar-sign-out').click();

test('someone resigns, the HOD then HR approve, and leaving waits until everything is back', async ({ page }) => {
  // Four sign ins across the whole journey.
  test.slow();
  await signInAs(page, 'OPR-0015');
  await page.goto('/profile');
  await page.getByTestId('resign').click();
  await page.getByTestId('resign-date').fill('2027-03-31');
  await page.getByTestId('resign-reason').fill('Moving back home');
  await page.getByTestId('resign-submit').click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByTestId('resignation-status')).toContainText('It’s with your HOD.');

  await signOut(page);
  await signInAs(page, 'OPR-0004');
  await page.goto('/team/approvals');
  await page.getByTestId('tab-resignations').click();
  await page.getByTestId('pending-resignation').filter({ hasText: 'Priya Nair' }).getByTestId('approve').click();
  await expect(page.getByTestId('pending-resignation').filter({ hasText: 'Priya Nair' })).toHaveCount(0);

  await signOut(page);
  await signInAs(page, 'OPR-0002');
  await page.goto('/hr/inbox');
  await page.getByTestId('waiting-resignation').filter({ hasText: 'Priya Nair' }).getByTestId('approve').click();
  await expect(page.getByTestId('exit-date-input')).toHaveValue('2027-03-31');
  await page.getByTestId('confirm-approve').click();
  await expect(page.getByTestId('waiting-resignation').filter({ hasText: 'Priya Nair' })).toHaveCount(0);

  await page.goto('/hr/people/OPR-0015');
  await expect(page.getByTestId('exit-card')).toBeVisible();
  await page.getByTestId('person-menu').click();
  await expect(page.getByTestId('mark-leaving')).toBeDisabled();
  await page.getByTestId('person-menu').click();
  const items = page.getByTestId('exit-card').getByTestId('exit-item');
  for (const index of [0, 1, 2, 3]) {
    await items.nth(index).getByTestId('returned').click();
    await expect(items.nth(index)).toContainText('Returned');
  }

  await page.getByTestId('person-menu').click();
  await page.getByTestId('mark-leaving').click();
  await expect(page.getByTestId('leaving-date')).toHaveValue('2027-03-31');
  await page.getByTestId('leaving-submit').click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByTestId('leaving-note')).toBeVisible();
});
