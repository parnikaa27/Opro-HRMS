import { expect, Page, test } from '@playwright/test';

const signInAs = async (page: Page, employeeId: string) => {
  await page.goto('/login');
  await page.getByTestId(`login-as-${employeeId}`).click();
  await expect(page.getByTestId('greeting').or(page.getByRole('heading', { level: 1 }))).toBeVisible();
};

test('signed out visitors land on sign in, and search engines are told to stay away', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page).toHaveTitle('Sign in · Opro HRMS');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
});

test('an employee sees their own dashboard and no team view', async ({ page }) => {
  await signInAs(page, 'OPR-0018');

  await expect(page.getByTestId('greeting')).toContainText('Arjun');
  await expect(page.getByTestId('visa-card')).toContainText('Expires soon');
  await expect(page.getByTestId('view-team')).toHaveCount(0);

  await page.getByTestId('account-button').click();
  await page.getByTestId('sign-out').click();
  await expect(page).toHaveURL(/\/login$/);
});

test('a manager switches to team view and comes back to it next time', async ({ page }) => {
  await signInAs(page, 'OPR-0001');

  await page.getByTestId('view-team').click();
  await expect(page).toHaveURL(/\/team$/);
  await expect(page.getByTestId('nav-people')).toBeVisible();

  await page.getByTestId('account-button').click();
  await page.getByTestId('sign-out').click();
  await page.getByTestId('login-as-OPR-0001').click();
  await expect(page).toHaveURL(/\/team$/);
});

test('an employee cannot open team pages by typing the address', async ({ page }) => {
  await signInAs(page, 'OPR-0023');

  await page.goto('/team/approvals');

  await expect(page).toHaveURL(/\/$/);
});

test('notifications can be read and cleared', async ({ page }) => {
  await signInAs(page, 'OPR-0027');
  const bell = page.getByTestId('notifications-button');
  await expect(bell).toHaveAttribute('aria-label', /unread/);

  await bell.click();
  await page.getByTestId('mark-all-read').click();

  await expect(bell).toHaveAttribute('aria-label', 'Notifications');
});

test('phones get a slide in menu instead of the side rail', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await signInAs(page, 'OPR-0011');

  await expect(page.getByTestId('nav-leave')).not.toBeInViewport();
  await page.getByTestId('open-menu').click();
  await page.getByTestId('nav-leave').click();

  await expect(page).toHaveURL(/\/leave$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Leave & time off');
});

test('an employee downloads a document', async ({ page }) => {
  await signInAs(page, 'OPR-0015');
  await page.getByTestId('nav-documents').click();

  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download Employment contract' }).click();

  expect((await download).suggestedFilename()).toBe('Employment contract.pdf');
});

test('dark mode can be chosen from the name menu and sticks after a reload', async ({ page }) => {
  await signInAs(page, 'OPR-0011');

  await page.getByTestId('account-button').click();
  await page.getByTestId('theme-dark').click();
  await page.reload();

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(10, 21, 29)');
});
