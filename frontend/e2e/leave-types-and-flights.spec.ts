import { expect, Page, test } from '@playwright/test';

const signInAs = async (page: Page, employeeId: string) => {
  await page.goto('/login');
  await page.getByTestId(`login-as-${employeeId}`).click();
  await expect(page.getByTestId('greeting')).toBeVisible();
};

test('HR adds a leave type for people they pick, and gives it to one person', async ({ page }) => {
  test.slow();
  await signInAs(page, 'OPR-0002');
  await page.goto('/hr/policy');
  await page.getByTestId('add-policy').click();
  await page.getByTestId('policy-name').fill('Marriage leave');
  await page.getByTestId('policy-days').fill('5');
  await page.getByTestId('policy-given').selectOption('individual');
  await page.getByTestId('policy-submit').click();
  await expect(page.getByTestId('policy-row').filter({ hasText: 'Marriage leave' })).toContainText('People HR picks');

  await page.goto('/hr/people/OPR-0023');
  await page.getByTestId('open-days').click();
  await page.getByTestId('days-type').selectOption('marriage-leave');
  await expect(page.getByTestId('days-count')).toHaveValue('5');
  await page.getByTestId('days-reason').fill('Getting married in January');
  await page.getByTestId('days-submit').click();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByTestId('adjustment').first()).toContainText('marriage leave');

  await signInAs(page, 'OPR-0023');
  await page.getByTestId('nav-leave').click();
  await expect(page.getByTestId('balance-row').filter({ hasText: 'Marriage leave' }).locator('td').last()).toHaveText('5');
});

test('HR sets a flight allowance, and a claim counts straight away with nobody to approve it', async ({ page }) => {
  test.slow();
  // The seed's allowances are for one year. Setting this year's first keeps the journey working in any year.
  const thisYear = new Intl.DateTimeFormat('en-CA', { timeZone: 'Indian/Maldives', year: 'numeric' }).format(new Date());
  await signInAs(page, 'OPR-0002');
  await page.goto('/hr/people/OPR-0015');
  await page.getByTestId('allowance-amount').fill('1500');
  await page.getByTestId('allowance-submit').click();
  await expect(page.getByTestId('hr-flight-card').getByTestId('flight-stats')).toContainText('$1,500.00');

  await signInAs(page, 'OPR-0015');
  await page.goto('/profile');
  await page.getByTestId('open-claim').click();
  await page.getByTestId('claim-route').fill('Malé to Kochi, one way');
  await page.getByTestId('claim-date').fill(`${thisYear}-06-15`);
  await page.getByTestId('claim-amount').fill('200');
  await page.getByTestId('claim-submit').click();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByTestId('flight-claim').filter({ hasText: 'Malé to Kochi, one way' })).toContainText('Claimed');

  await signInAs(page, 'OPR-0002');
  await page.goto('/hr/people/OPR-0015');
  await expect(page.getByTestId('hr-flight-card').getByTestId('flight-claim').filter({ hasText: 'Malé to Kochi, one way' })).toContainText('Claimed');
});
