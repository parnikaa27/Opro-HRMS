import { expect, Page, test } from '@playwright/test';

const signInAs = async (page: Page, employeeId: string) => {
  await page.goto('/login');
  await page.getByTestId(`login-as-${employeeId}`).click();
  await expect(page.getByTestId('greeting')).toBeVisible();
};

// Everyone in the seed data has already punched today, so each journey starts with a new starter HR adds that morning.
// They report to Rajesh (OPR-0001), so the team view journeys still count Vikram's six.
const addStarter = async (page: Page, fullName: string, email: string) => {
  await signInAs(page, 'OPR-0002');
  return page.evaluate(
    async ({ fullName, email }) => {
      const xsrf = decodeURIComponent(document.cookie.split('; ').find((cookie) => cookie.startsWith('XSRF-TOKEN='))?.split('=')[1] ?? '');
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Indian/Maldives' }).format(new Date());
      const response = await fetch('/api/hr/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': xsrf },
        body: JSON.stringify({
          fullName, email, designation: 'Accountant', department: 'Finance', phone: '+960 777 1030', joinedOn: today, bloodGroup: 'B+',
          nationality: 'Maldivian', workLocation: 'Malé office', employmentType: 'Full-time', managerId: 'OPR-0001',
          emergencyContact: { name: 'Sameer Kapoor', relation: 'Brother', phone: '+960 777 1031' },
        }),
      });
      const added: { id: string } = await response.json();
      return added.id;
    },
    { fullName, email },
  );
};

test('a new starter works from home and their manager approves the day', async ({ page }) => {
  test.slow();
  const id = await addStarter(page, 'Riya Kapoor', 'riya.kapoor@opro.mv');

  await signInAs(page, id);
  await page.getByTestId('punch-button').click();
  await page.getByTestId('punch-home').click();
  await expect(page.getByTestId('today-heading')).toHaveText('You’re working from home');
  await expect(page.getByTestId('home-note')).toContainText('Waiting for your manager');

  await signInAs(page, 'OPR-0001');
  await page.goto('/team/approvals');
  await page.getByTestId('tab-home').click();
  const row = page.getByTestId('pending-home-day').filter({ hasText: 'Riya Kapoor' });
  await row.getByTestId('approve').click();
  await expect(row).toHaveCount(0);
});

test.describe('at the office', () => {
  // A few metres from the Malé office pin.
  test.use({ geolocation: { latitude: 4.1757, longitude: 73.5094, accuracy: 20 }, permissions: ['geolocation'] });

  test('punching in at the office checks where you are and names the office', async ({ page }) => {
    const id = await addStarter(page, 'Aditya Joshi', 'aditya.joshi@opro.mv');

    await signInAs(page, id);
    await page.getByTestId('punch-button').click();
    await page.getByTestId('punch-office').click();

    await expect(page.getByTestId('today-heading')).toHaveText('You’re in the office');
    await expect(page.getByTestId('today-card')).toContainText('Malé office');
    await expect(page.getByTestId('punch-button')).toHaveText('Punch out');
  });
});
