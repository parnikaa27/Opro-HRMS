import { expect, Page, test } from '@playwright/test';

const signInAs = async (page: Page, employeeId: string) => {
  await page.goto('/login');
  await page.getByTestId(`login-as-${employeeId}`).click();
  await expect(page.getByTestId('greeting')).toBeVisible();
};

test('HR sees the executive dashboard and saves a report as Excel and PDF', async ({ page }) => {
  await signInAs(page, 'OPR-0002');
  await page.goto('/hr/dashboard');
  await expect(page.getByTestId('kpi-total')).not.toHaveText('0');
  await expect(page.getByTestId('compliance')).toContainText('Expatriate quota');
  await expect(page.getByTestId('workforce')).toContainText('Expatriates');

  await page.getByTestId('open-reports').click();
  await page.getByTestId('report-papers').click();
  await expect(page.getByTestId('report-row').first()).toBeVisible();
  const excel = page.waitForEvent('download');
  await page.getByTestId('export-xlsx').click();
  expect((await excel).suggestedFilename()).toMatch(/^visa-and-permit-expiry-\d{4}-\d{2}-\d{2}\.xlsx$/);
  const pdf = page.waitForEvent('download');
  await page.getByTestId('export-pdf').click();
  expect((await pdf).suggestedFilename()).toMatch(/\.pdf$/);
});

test('a super admin has the same dashboard and reports, and employees never reach them', async ({ page }) => {
  await signInAs(page, 'OPR-0001');
  await page.getByTestId('view-company').click();
  await page.getByTestId('nav-dashboard').click();
  await expect(page.getByTestId('people-events')).toBeVisible();
  await page.getByTestId('nav-reports').click();
  await page.getByTestId('report-attendance').click();
  await expect(page.getByTestId('report-row').first()).toBeVisible();
  const csv = page.waitForEvent('download');
  await page.getByTestId('export-csv').click();
  expect((await csv).suggestedFilename()).toMatch(/^attendance-\d{4}-\d{2}\.csv$/);

  await signInAs(page, 'OPR-0018');
  await page.goto('/hr/dashboard');
  await expect(page).toHaveURL(/\/$/);
});
