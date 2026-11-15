import { expect, Page, test } from '@playwright/test';

const signInAsHr = async (page: Page) => {
  await page.goto('/login');
  await page.getByTestId('login-as-OPR-0002').click();
  await expect(page.getByTestId('greeting')).toBeVisible();
  await page.getByTestId('view-hr').click();
  await expect(page.getByTestId('stat-people')).toBeVisible();
};

test('HR adjusts a balance and records leave for someone', async ({ page }) => {
  await signInAsHr(page);
  await page.goto('/hr/people/OPR-0027');

  await page.getByTestId('open-adjust').click();
  await page.getByTestId('adjust-days').fill('1.5');
  await page.getByTestId('adjust-reason').fill('Worked the Victory Day event');
  await page.getByRole('button', { name: 'Save adjustment' }).click();
  await expect(page.getByTestId('success-state')).toContainText('Balance adjusted');
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByTestId('adjustment').first()).toContainText('Worked the Victory Day event');

  await page.getByTestId('open-record').click();
  await expect(page.getByTestId('record-type')).toHaveValue('sick');
  await page.getByTestId('record-from').fill('2027-01-12');
  await page.getByTestId('record-to').fill('2027-01-13');
  await page.getByTestId('record-reason').fill('Called in from hospital');
  await expect(page.getByTestId('record-preview')).toContainText('2 working days');
  await page.getByTestId('record-submit').click();
  await expect(page.getByTestId('success-state')).toContainText('Leave recorded');
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByTestId('leave-request').filter({ hasText: '12 Jan to 13 January 2027' })).toContainText('Approved');
});

test('HR starts a new holiday year and removes a date', async ({ page }) => {
  await signInAsHr(page);
  await page.getByTestId('nav-calendar').click();

  await page.getByTestId('next-year').click();
  await page.getByTestId('next-year').click();
  await expect(page.getByTestId('year-label')).toHaveText('2028');
  await page.getByTestId('start-year').click();
  await expect(page.getByTestId('holiday-row')).toHaveCount(4);

  const victoryDay = page.getByTestId('holiday-row').filter({ hasText: 'Victory Day' });
  await victoryDay.getByTestId('delete').click();
  await victoryDay.getByTestId('confirm-yes').click();
  await expect(page.getByTestId('holiday-row')).toHaveCount(3);
});

test('HR works through the inbox and the leave policy', async ({ page }) => {
  await signInAsHr(page);

  await page.getByTestId('nav-inbox').click();
  const phoneChange = page.getByTestId('change-row').filter({ hasText: '+960 777 8018' });
  await phoneChange.getByTestId('mark-done').click();
  await expect(phoneChange).toHaveCount(0);
  await page.getByTestId('tab-done').click();
  await expect(page.getByTestId('change-row').filter({ hasText: '+960 777 8018' })).toContainText('Done');

  await page.getByTestId('nav-policies').click();
  // Other journeys add types at the same time, so this checks rows rather than counting them.
  await expect(page.getByTestId('policy-row').filter({ hasText: 'Unpaid leave' })).toContainText('No limit');
  await expect(page.getByTestId('policy-row').filter({ hasText: 'Compensatory off' })).toContainText('Earned by working days off');
});

test('HR posts an announcement and takes it down', async ({ page }) => {
  await signInAsHr(page);
  await page.getByTestId('nav-announcements').click();

  await page.getByTestId('new-announcement').click();
  await page.getByTestId('announcement-title').fill('Water outage on Thursday');
  await page.getByTestId('announcement-body').fill('The Malé office has no water from 10 am to noon.');
  await page.getByTestId('announcement-submit').click();
  const note = page.getByTestId('announcement-row').filter({ hasText: 'Water outage on Thursday' });
  await expect(note).toBeVisible();

  await note.getByTestId('delete').click();
  await note.getByTestId('confirm-yes').click();
  await expect(note).toHaveCount(0);
});

test('people without the HR role never reach HR pages', async ({ page }) => {
  await page.goto('/login');
  await page.getByTestId('login-as-OPR-0004').click();
  await expect(page.getByTestId('greeting')).toBeVisible();
  await expect(page.getByTestId('view-hr')).toHaveCount(0);

  await page.goto('/hr/visas');

  await expect(page).toHaveURL(/\/$/);
});
