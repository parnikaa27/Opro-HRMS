import { expect, Page, test } from '@playwright/test';

const signInAs = async (page: Page, employeeId: string) => {
  await page.goto('/login');
  await page.getByTestId(`login-as-${employeeId}`).click();
  await expect(page.getByTestId('page-heading')).toBeVisible();
};

test('a super admin sees where everyone is today and opens anyone, read only', async ({ page }) => {
  await signInAs(page, 'OPR-0001');

  await page.getByTestId('view-company').click();
  await expect(page.getByTestId('where-today')).toContainText('at the office');
  await expect(page.getByTestId('person-card').filter({ hasText: 'Rajesh Sharma' })).toBeVisible();
  await page.getByTestId('person-card').filter({ hasText: 'Ananya Iyer' }).getByRole('link', { name: 'View profile' }).click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ananya Iyer');
  await expect(page.getByTestId('attendance-row').first()).toBeVisible();
  await expect(page.getByTestId('approve')).toHaveCount(0);

  await page.getByTestId('nav-attendance').click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Company attendance');
});

test('a super admin’s own leave is approved as it is sent', async ({ page }) => {
  await signInAs(page, 'OPR-0001');
  await page.goto('/leave');

  await page.getByTestId('apply-leave').click();
  await page.getByTestId('leave-type').selectOption('annual');
  await page.getByTestId('leave-from').fill('2027-04-20');
  await page.getByTestId('leave-to').fill('2027-04-21');
  await page.getByTestId('leave-reason').fill('Board visit in Colombo');
  await page.getByTestId('leave-submit').click();
  await expect(page.getByTestId('success-state')).toContainText('Leave booked');
  await page.getByRole('button', { name: 'Done', exact: true }).click();

  await expect(page.getByTestId('leave-request').filter({ hasText: '20 Apr to 21 April 2027' })).toContainText('Approved');
});

test('a super admin steps in on leave while the HOD is away', async ({ page }) => {
  test.slow();
  await signInAs(page, 'OPR-0027');
  await page.goto('/leave');
  await page.getByTestId('apply-leave').click();
  await page.getByTestId('leave-type').selectOption('annual');
  await page.getByTestId('leave-from').fill('2027-05-04');
  await page.getByTestId('leave-to').fill('2027-05-05');
  await page.getByTestId('leave-reason').fill('Cousin’s wedding in Kochi');
  await page.getByTestId('leave-submit').click();
  await page.getByRole('button', { name: 'Done', exact: true }).click();

  await page.getByTestId('sidebar-sign-out').click();
  await signInAs(page, 'OPR-0001');
  await page.goto('/company/leave');
  const request = page.getByTestId('leave-row').filter({ hasText: 'Cousin’s wedding in Kochi' });
  await request.getByTestId('approve').click();
  await expect(request).toHaveCount(0);

  await page.getByTestId('tab-approved').click();
  await expect(page.getByTestId('leave-row').filter({ hasText: 'Cousin’s wedding in Kochi' })).toContainText('Approved');
});

test('HR never reaches the super admin view', async ({ page }) => {
  await signInAs(page, 'OPR-0002');
  await expect(page.getByTestId('view-company')).toHaveCount(0);

  await page.goto('/company');
  await expect(page).toHaveURL(/\/$/);
});
