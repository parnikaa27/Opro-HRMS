import { expect, Page, test } from '@playwright/test';

const signInAs = async (page: Page, employeeId: string) => {
  await page.goto('/login');
  await page.getByTestId(`login-as-${employeeId}`).click();
  await expect(page.getByTestId('greeting')).toBeVisible();
};

test('an employee enters bank details, and HR checks them against the full number', async ({ page }) => {
  // Two sign ins in a row.
  test.slow();
  await signInAs(page, 'OPR-0027');
  await page.goto('/profile');
  await page.getByTestId('open-bank').click();
  await page.getByTestId('bank-name').fill('Bank of Maldives');
  await page.getByTestId('bank-account-name').fill('Kavya Menon');
  await page.getByTestId('bank-number').fill('7701 2345 678');
  await page.getByTestId('bank-submit').click();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByTestId('my-bank')).toContainText('•••• 5678');
  await expect(page.getByTestId('my-bank')).toContainText('Waiting for HR');

  await page.getByTestId('sidebar-sign-out').click();
  await signInAs(page, 'OPR-0002');
  await page.goto('/hr/inbox');
  const waiting = page.getByTestId('waiting-bank').filter({ hasText: 'Kavya Menon' });
  await expect(waiting).toContainText('77012345678');
  await waiting.getByTestId('bank-verify').click();
  await expect(waiting).toHaveCount(0);

  await page.goto('/hr/people/OPR-0027');
  await expect(page.getByTestId('record-bank')).toContainText('Verified');
});

test('HR adds a quota approval and sees the slots in use', async ({ page }) => {
  await signInAs(page, 'OPR-0002');
  await page.goto('/hr/visas');
  await expect(page.getByTestId('quota-row').filter({ hasText: 'Administration' })).toContainText('2 of 2');

  await page.getByTestId('add-quota').click();
  await page.getByTestId('quota-category').fill('Finance');
  await page.getByTestId('quota-slots').fill('3');
  await page.getByTestId('quota-number').fill('QT-2026-0001');
  await page.getByTestId('quota-approved').fill('2026-11-01');
  await page.getByTestId('quota-expiry').fill('2027-10-31');
  await page.getByTestId('quota-submit').click();
  await expect(page.getByTestId('quota-row').filter({ hasText: 'Finance' })).toContainText('0 of 3');
});

test('HR adds a qualification to someone\'s record and they see it', async ({ page }) => {
  await signInAs(page, 'OPR-0002');
  await page.goto('/hr/people/OPR-0021');
  await page.getByTestId('add-education').click();
  await page.getByTestId('education-qualification').fill('Diploma in Logistics');
  await page.getByTestId('education-institution').fill('CILT India');
  await page.getByTestId('education-year').fill('2015');
  await page.getByTestId('education-submit').click();
  await expect(page.getByTestId('record-education').filter({ hasText: 'Diploma in Logistics' })).toBeVisible();

  await signInAs(page, 'OPR-0021');
  await page.goto('/profile');
  await expect(page.getByTestId('my-education').filter({ hasText: 'Diploma in Logistics' })).toContainText('CILT India, 2015');
});
