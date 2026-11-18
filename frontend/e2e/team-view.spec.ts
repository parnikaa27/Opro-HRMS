import { expect, Page, test } from '@playwright/test';

const signInAsManager = async (page: Page) => {
  await page.goto('/login');
  await page.getByTestId('login-as-OPR-0004').click();
  await expect(page.getByTestId('greeting')).toBeVisible();
  await page.goto('/team');
};

const leaveRow = (page: Page, name: string) => page.getByTestId('leave-row').filter({ has: page.getByText(name, { exact: true }) });

test('a manager sees the team overview and opens one person', async ({ page }) => {
  await signInAsManager(page);

  await expect(page.getByTestId('stat-members')).toHaveText('6');
  await expect(page.getByTestId('visa-alert').filter({ hasText: 'Rohit Verma' }).first()).toBeVisible();

  await page.getByTestId('nav-people').click();
  await page.getByTestId('person-card').filter({ hasText: 'Arjun Reddy' }).getByRole('link', { name: 'View profile' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Arjun Reddy');
  await expect(page.getByTestId('visa-card')).toContainText('Expires soon');
});

test('a manager approves one request and declines another with a reason', async ({ page }) => {
  await signInAsManager(page);
  await page.getByTestId('nav-leave').click();

  await leaveRow(page, 'Sneha Kulkarni').getByTestId('approve').click();
  await expect(leaveRow(page, 'Sneha Kulkarni')).toHaveCount(0);

  await leaveRow(page, 'Priya Nair').getByTestId('reject').click();
  await page.getByTestId('confirm-reject').click();
  await expect(page.getByText('Give a short reason')).toBeVisible();
  await page.getByTestId('decision-note').fill('Year end close needs you until the 24th');
  await page.getByTestId('confirm-reject').click();

  await page.getByTestId('tab-rejected').click();
  await expect(leaveRow(page, 'Priya Nair')).toContainText('Year end close needs you until the 24th');
  await page.getByTestId('tab-approved').click();
  await expect(leaveRow(page, 'Sneha Kulkarni').first()).toContainText('Approved');
});

test('team attendance and the calendar show the whole team', async ({ page }) => {
  await signInAsManager(page);

  await page.getByTestId('nav-attendance').click();
  await expect(page.getByTestId('team-attendance-row')).toHaveCount(6);

  await page.getByTestId('nav-calendar').click();
  await expect(page.getByRole('heading', { name: 'Holidays & events' })).toBeVisible();
  await page.getByTestId('previous-month').click();
  await expect(page.getByTestId('calendar-day').filter({ hasText: 'Karan Mehta' }).first()).toBeVisible();
});

test('a manager cannot open someone outside their team', async ({ page }) => {
  await signInAsManager(page);

  await page.goto('/team/OPR-0001');

  await expect(page.getByRole('heading', { name: 'Not on your team' })).toBeVisible();
});

test('a manager finds someone on the People page and from the top search', async ({ page }) => {
  await signInAsManager(page);

  await page.getByTestId('nav-people').click();
  await expect(page.getByTestId('person-card')).toHaveCount(6);
  await page.getByTestId('people-search').fill('kavya');
  await expect(page.getByTestId('person-card')).toHaveCount(1);

  await page.getByTestId('search-input').fill('priya');
  await expect(page.getByTestId('search-results')).toContainText('Priya Nair');
  await page.getByTestId('search-input').press('Enter');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Priya Nair');
});

test('a manager approves one late day as overtime and declines another with a reason', async ({ page }) => {
  await signInAsManager(page);
  await page.getByTestId('nav-leave').click();
  await page.getByTestId('tab-overtime').click();

  const overtimeRow = (name: string) => page.getByTestId('pending-overtime').filter({ hasText: name });
  await expect(overtimeRow('Arjun Reddy')).toContainText('1h 20m');
  await expect(overtimeRow('Rohit Verma')).toContainText('1h 5m');

  await overtimeRow('Arjun Reddy').getByTestId('approve').click();
  await expect(overtimeRow('Arjun Reddy')).toHaveCount(0);

  await overtimeRow('Rohit Verma').getByTestId('reject').click();
  await page.getByTestId('decision-note').fill('The delivery moved to the next day');
  await page.getByTestId('confirm-reject').click();
  await expect(page.getByTestId('pending-overtime')).toHaveCount(0);

  await page.goto('/login');
  await page.getByTestId('login-as-OPR-0018').click();
  await page.getByTestId('notifications-button').click();
  await expect(page.getByTestId('notifications-panel')).toContainText('Vikram Singh approved 1h 20m of overtime on Monday 9 November.');
});
