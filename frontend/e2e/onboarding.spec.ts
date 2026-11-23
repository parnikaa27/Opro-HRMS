import { expect, Page, test } from '@playwright/test';

const signInAs = async (page: Page, employeeId: string) => {
  await page.goto('/login');
  await page.getByTestId(`login-as-${employeeId}`).click();
  await expect(page.getByTestId('page-heading')).toBeVisible();
};

test('a new joiner, their HOD and HR each tick their onboarding tasks, and the HOD picks a buddy', async ({ page }) => {
  test.slow();
  await signInAs(page, 'OPR-0027');
  const welcome = page.getByTestId('welcome-card');
  await expect(welcome).toContainText('Your first weeks');
  await welcome.getByTestId('onboarding-item').filter({ hasText: 'Upload your documents' }).getByTestId('do-task').click();
  await expect(welcome.getByTestId('onboarding-item').filter({ hasText: 'Upload your documents' })).toContainText('Done');

  await signInAs(page, 'OPR-0004');
  await page.goto('/team');
  const joiner = page.getByTestId('joiner').filter({ hasText: 'Kavya Menon' });
  await joiner.getByTestId('pick-buddy').selectOption({ label: 'Arjun Reddy' });
  await joiner.getByTestId('onboarding-item').filter({ hasText: 'First week planned' }).getByTestId('do-task').click();
  await expect(joiner.getByTestId('onboarding-item').filter({ hasText: 'First week planned' })).toContainText('Done');

  await signInAs(page, 'OPR-0002');
  await page.goto('/hr');
  await expect(page.getByTestId('joiner-progress').filter({ hasText: 'Kavya Menon' })).toBeVisible();
  await page.goto('/hr/people/OPR-0027');
  await page.getByTestId('first-day-contact').fill('Vikram Singh');
  await page.getByTestId('save-first-day').click();

  await signInAs(page, 'OPR-0027');
  await expect(page.getByTestId('first-day')).toContainText('Ask for Vikram Singh.');
  await expect(page.getByTestId('welcome-people')).toContainText('Arjun Reddy is your buddy');
});
