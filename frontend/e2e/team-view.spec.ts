import { expect, Page, test } from '@playwright/test';

const signInAsManager = async (page: Page) => {
  await page.goto('/login');
  await page.getByTestId('login-as-OPR-0004').click();
  await expect(page.getByTestId('greeting').or(page.getByRole('heading', { name: 'Your team today' }))).toBeVisible();
  await page.goto('/team');
};

const pendingCard = (page: Page, name: string) => page.getByTestId('pending-leave').filter({ has: page.getByText(name, { exact: true }) });

test('a manager sees the team today and opens one person', async ({ page }) => {
  await signInAsManager(page);

  await expect(page.getByTestId('team-member')).toHaveCount(6);
  await expect(page.getByTestId('visa-warning').filter({ hasText: 'Rahim Uddin' }).first()).toContainText('expired');

  await page.getByTestId('team-member').filter({ hasText: 'Kasun Perera' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kasun Perera');
  await expect(page.getByTestId('visa-document').first()).toContainText('Expires soon');
});

test('a manager approves one request and turns down another with a reason', async ({ page }) => {
  await signInAsManager(page);
  await page.getByRole('link', { name: 'Approvals' }).first().click();

  await pendingCard(page, 'Mariyam Nisha').getByTestId('approve').click();
  await expect(pendingCard(page, 'Mariyam Nisha')).toHaveCount(0);

  const priya = pendingCard(page, 'Priya Nair');
  await priya.getByTestId('reject').click();
  await priya.getByTestId('confirm-reject').click();
  await expect(priya.getByText('Give a short reason')).toBeVisible();
  await priya.getByTestId('decision-note').fill('Year end close needs you until the 24th');
  await priya.getByTestId('confirm-reject').click();

  await expect(page.getByTestId('decided').filter({ hasText: 'Priya Nair' })).toContainText('Not approved');
  await expect(page.getByTestId('decided').filter({ hasText: 'Mariyam Nisha, annual leave' })).toContainText('Approved');
});

test('team attendance and the calendar show the whole team', async ({ page }) => {
  await signInAsManager(page);

  await page.getByRole('link', { name: 'Attendance' }).first().click();
  await expect(page.getByTestId('team-attendance-row')).toHaveCount(6);

  await page.getByRole('link', { name: 'Calendar' }).first().click();
  await expect(page.getByRole('heading', { name: 'Team calendar' })).toBeVisible();
  await page.getByTestId('previous-month').click();
  await expect(page.getByTestId('calendar-day').filter({ hasText: 'Ahmed Zahir' }).first()).toBeVisible();
});

test('a manager cannot open someone outside their team', async ({ page }) => {
  await signInAsManager(page);

  await page.goto('/team/OPR-0001');

  await expect(page.getByRole('heading', { name: 'Not on your team' })).toBeVisible();
});
