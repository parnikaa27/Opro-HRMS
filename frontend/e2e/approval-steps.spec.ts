import { expect, Page, test } from '@playwright/test';

const signInAs = async (page: Page, employeeId: string) => {
  await page.goto('/login');
  await page.getByTestId(`login-as-${employeeId}`).click();
  await expect(page.getByTestId('page-heading')).toBeVisible();
};

test('HR asks to approve family leave after the HOD, and approves it from the inbox', async ({ page }) => {
  test.slow();
  await signInAs(page, 'OPR-0002');
  await page.goto('/hr/policy');
  await page.getByTestId('policy-row').filter({ hasText: 'Family responsibility leave' }).getByTestId('edit-policy').click();
  await page.getByTestId('policy-approval').selectOption('hr');
  await page.getByTestId('policy-submit').click();
  await expect(page.getByTestId('policy-row').filter({ hasText: 'Family responsibility leave' })).toContainText('HOD, then HR');

  await signInAs(page, 'OPR-0004');
  await page.goto('/team/approvals');
  const rohit = page.getByTestId('leave-row').filter({ hasText: 'Rohit Verma' });
  await rohit.getByTestId('approve').click();
  await expect(rohit).toContainText('Waiting for HR');

  await signInAs(page, 'OPR-0002');
  await page.goto('/hr/inbox');
  const waiting = page.getByTestId('waiting-approval').filter({ hasText: 'Rohit Verma' });
  await expect(waiting).toContainText('approved by Vikram Singh');
  await waiting.getByTestId('approve').click();
  await expect(page.getByTestId('waiting-approval')).toHaveCount(0);

  await signInAs(page, 'OPR-0021');
  await page.getByTestId('notifications-button').click();
  await expect(page.getByTestId('notifications-panel')).toContainText('Your family responsibility leave for Wednesday 18 November was approved.');
});
