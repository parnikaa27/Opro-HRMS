import { expect, Page, test } from '@playwright/test';

const signInAs = async (page: Page, employeeId: string) => {
  await page.goto('/login');
  await page.getByTestId(`login-as-${employeeId}`).click();
  await expect(page.getByTestId('greeting')).toBeVisible();
};

const PDF = { name: 'certificates.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 degree certificate') };

const PAGE_TWO = { ...PDF, name: 'page-two.pdf' };

test('an employee uploads two pages, takes a wrong one off, HR sends it back, and verifies the new copy', async ({ page }) => {
  // Three sign ins in a row.
  test.slow();
  await signInAs(page, 'OPR-0027');
  await page.goto('/documents');
  const certificates = page.getByTestId('document').filter({ hasText: 'Educational certificates' });
  await certificates.getByTestId('upload-document').click();
  await page.getByTestId('document-file').setInputFiles([PDF, PAGE_TWO]);
  await page.getByTestId('document-issued').fill('2020-05-01');
  await page.getByTestId('document-submit').click();
  await expect(certificates).toContainText('Waiting for HR');
  await expect(certificates.getByTestId('document-file-link')).toHaveCount(2);
  await certificates.getByTestId('remove-file').last().click();
  await expect(certificates.getByTestId('document-file-link')).toHaveCount(1);

  await page.getByTestId('sidebar-sign-out').click();
  await signInAs(page, 'OPR-0002');
  await page.goto('/hr/inbox');
  const waiting = page.getByTestId('waiting-document').filter({ hasText: 'Kavya Menon' }).filter({ hasText: 'Educational certificates' });
  await waiting.getByTestId('send-back').click();
  await page.getByTestId('decision-note').fill('Page two is missing');
  await page.getByTestId('confirm-reject').click();
  await expect(waiting).toHaveCount(0);

  await page.getByTestId('sidebar-sign-out').click();
  await signInAs(page, 'OPR-0027');
  await page.goto('/documents');
  await expect(certificates).toContainText('Sent back: Page two is missing');
  await certificates.getByTestId('upload-document').click();
  // The dates are the copy on file's, so this goes on as page two.
  await page.getByTestId('document-file').setInputFiles(PAGE_TWO);
  await page.getByTestId('document-submit').click();
  await expect(certificates).toContainText('Waiting for HR');
  await expect(certificates.getByTestId('document-file-link')).toHaveCount(2);

  await page.getByTestId('sidebar-sign-out').click();
  await signInAs(page, 'OPR-0002');
  await page.goto('/hr/people/OPR-0027');
  const onTheirPage = page.getByTestId('hr-document').filter({ hasText: 'Educational certificates' });
  await onTheirPage.getByTestId('verify').click();
  await expect(onTheirPage).toContainText('Verified');
});

test('HR adds a document to the list, and expatriates are asked for it', async ({ page }) => {
  await signInAs(page, 'OPR-0002');
  await page.goto('/hr/policy');
  await page.getByTestId('add-doc-type').click();
  await page.getByTestId('doc-type-name').fill('Police clearance');
  await page.getByTestId('doc-type-who').selectOption('expatriates');
  await page.getByTestId('doc-type-submit').click();
  await expect(page.getByTestId('doc-type-row').filter({ hasText: 'Police clearance' })).toContainText('Expatriates only');

  await signInAs(page, 'OPR-0021');
  await page.goto('/documents');
  await expect(page.getByTestId('document').filter({ hasText: 'Police clearance' })).toContainText('Missing');
});

test('HR asks one person for a document, and sees who still has things to hand in', async ({ page }) => {
  await signInAs(page, 'OPR-0002');
  await page.goto('/hr');
  await expect(page.getByTestId('to-collect').filter({ hasText: 'Kavya Menon' })).toContainText('National ID (missing)');

  await page.goto('/hr/people/OPR-0023');
  await page.getByTestId('ask-document').selectOption('marriage-certificate');
  await expect(page.getByTestId('hr-document').filter({ hasText: 'Marriage certificate' })).toContainText('Stop asking');

  await page.getByTestId('sidebar-sign-out').click();
  await signInAs(page, 'OPR-0023');
  await page.goto('/documents');
  await expect(page.getByTestId('document').filter({ hasText: 'Marriage certificate' })).toContainText('Missing');
});
