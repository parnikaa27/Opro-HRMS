import { expect, Page, test } from '@playwright/test';

const signInAs = async (page: Page, employeeId: string) => {
  await page.goto('/login');
  await page.getByTestId(`login-as-${employeeId}`).click();
  await expect(page.getByTestId('greeting')).toBeVisible();
};

test('someone fills in their plan section by section and sends it, the HOD then HR approve, the HOD appraises, and they accept the rating', async ({ page }) => {
  // Five sign ins across the whole year.
  test.slow();
  await signInAs(page, 'OPR-0011');
  await page.goto('/performance');
  await page.getByTestId('plan-tile-goals').click();
  await page.getByTestId('goal-title').fill('Faster month end close');
  await page.getByTestId('goal-measure').fill('Books closed by the 5th, every month');
  await page.getByTestId('goals-save').click();
  await page.getByTestId('plan-tile-certification').click();
  await page.getByTestId('entry-title').fill('CIMA certificate');
  await page.getByTestId('entry-target').fill('2027-06-30');
  await page.getByTestId('add-entry').click();
  await page.getByTestId('entry-title').nth(1).fill('Wrong one');
  await page.getByTestId('remove-entry').nth(1).click();
  await page.getByTestId('entries-save').click();
  await expect(page.getByTestId('plan-tile-certification')).toContainText('1 added: CIMA certificate');
  await page.getByTestId('send-plan').click();
  await expect(page.getByTestId('plan-status-pill')).toHaveText('Waiting for the HOD');

  await signInAs(page, 'OPR-0004');
  await page.goto('/team/performance');
  const sneha = page.getByTestId('team-appraisal-row').filter({ hasText: 'Sneha Kulkarni' });
  await sneha.getByTestId('review-plan').click();
  await expect(page.getByTestId('plan-view')).toContainText('CIMA certificate');
  await page.getByTestId('approve-plan').click();
  await page.getByTestId('tab-waiting').click();
  await expect(sneha).toContainText('With HR');

  await signInAs(page, 'OPR-0002');
  await page.goto('/hr/performance');
  await page.getByTestId('plan-for-hr-row').filter({ hasText: 'Sneha Kulkarni' }).getByTestId('review-plan').click();
  await page.getByTestId('approve-plan').click();
  await expect(page.getByTestId('plan-for-hr-row').filter({ hasText: 'Sneha Kulkarni' })).toHaveCount(0);

  await signInAs(page, 'OPR-0004');
  await page.goto('/team/performance');
  await page.getByTestId('tab-appraise').click();
  await sneha.getByTestId('appraise').click();
  await expect(page.getByTestId('their-self-review')).toContainText('CIMA certificate');
  await page.getByTestId('goal-rating').selectOption('5');
  await page.getByTestId('overall-rating').selectOption('5');
  await page.getByTestId('appraisal-comments').fill('Month end ran like clockwork all year.');
  await page.getByTestId('self-review-comment').fill('Book the exam for May.');
  await page.getByTestId('recommend-increment').fill('10');
  await page.getByTestId('appraisal-submit').click();
  await page.getByTestId('tab-done').click();
  await expect(sneha).toContainText('not accepted yet');

  await signInAs(page, 'OPR-0011');
  await page.goto('/performance');
  const appraisal = page.getByTestId('my-appraisal');
  await expect(appraisal).toContainText('On your plan: “Book the exam for May.”');
  await expect(appraisal).not.toContainText('increment');
  await page.getByTestId('accept-rating').click();
  await expect(appraisal).toContainText('Accepted on');

  await signInAs(page, 'OPR-0002');
  await page.goto('/hr/performance');
  await expect(page.getByTestId('hr-appraisal-row').filter({ hasText: 'Sneha Kulkarni' })).toContainText('10% increment');
});

test('a super admin steps in for an HOD and approves a plan', async ({ page }) => {
  await signInAs(page, 'OPR-0001');
  await page.getByTestId('view-company').click();
  await page.getByTestId('nav-performance').click();
  const rohit = page.getByTestId('team-appraisal-row').filter({ hasText: 'Rohit Verma' });
  await expect(rohit).toContainText('HOD Vikram Singh');
  await rohit.getByTestId('review-plan').click();
  await page.getByTestId('approve-plan').click();
  await page.getByTestId('tab-waiting').click();
  await expect(rohit).toContainText('With HR');
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
