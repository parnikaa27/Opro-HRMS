import { expect, Page, test } from '@playwright/test';

const signInAs = async (page: Page, employeeId: string) => {
  await page.goto('/login');
  await page.getByTestId(`login-as-${employeeId}`).click();
  await expect(page.getByTestId('greeting')).toBeVisible();
};

test('an HOD sets goals and appraises, the person reads it, and HR sees the recommendation', async ({ page }) => {
  test.slow();
  await signInAs(page, 'OPR-0004');
  await page.goto('/team/performance');
  const rohit = page.getByTestId('team-appraisal-row').filter({ hasText: 'Rohit Verma' });

  await rohit.getByTestId('set-goals').click();
  await page.getByTestId('goal-title').fill('Same day deliveries in Malé');
  await page.getByTestId('goal-measure').fill('95% of orders, every month');
  await page.getByTestId('goals-submit').click();
  await expect(rohit).toContainText('1 goal');

  await rohit.getByTestId('appraise').click();
  await page.getByTestId('goal-rating').selectOption('5');
  await page.getByTestId('overall-rating').selectOption('5');
  await page.getByTestId('appraisal-comments').fill('Deliveries ran like clockwork all year.');
  await page.getByTestId('recommend-increment').fill('10');
  await page.getByTestId('appraisal-submit').click();
  await expect(rohit).toContainText('5, Outstanding');

  await signInAs(page, 'OPR-0021');
  await page.goto('/performance');
  await expect(page.getByTestId('my-appraisal')).toContainText('Deliveries ran like clockwork all year.');
  await expect(page.getByTestId('my-appraisal')).not.toContainText('increment');
  await page.getByTestId('acknowledge').click();
  await expect(page.getByTestId('my-appraisal')).toContainText('Read on');

  await signInAs(page, 'OPR-0002');
  await page.goto('/hr/performance');
  await expect(page.getByTestId('hr-appraisal-row').filter({ hasText: 'Rohit Verma' })).toContainText('10% increment');
});

test('an HOD extends a probation and HR sees the review', async ({ page }) => {
  await signInAs(page, 'OPR-0004');
  await page.goto('/team/performance');
  await page.getByTestId('probation-row').filter({ hasText: 'Kavya Menon' }).getByTestId('review-probation').click();
  await page.getByTestId('probation-outcome').selectOption('extended');
  await page.getByTestId('probation-extended-to').fill('2027-03-20');
  await page.getByTestId('probation-comments').fill('More time on the new booking system');
  await page.getByTestId('probation-submit').click();
  await expect(page.getByTestId('probation-row').filter({ hasText: 'Kavya Menon' })).toContainText('20 March 2027');

  await signInAs(page, 'OPR-0002');
  await page.goto('/hr/performance');
  await expect(page.getByTestId('probation-review').filter({ hasText: 'Kavya Menon' })).toContainText('Extended to 20 Mar');
});
