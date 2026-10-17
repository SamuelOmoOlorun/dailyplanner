const { test, expect } = require('@playwright/test');

test('calendar and time dropdowns create an overnight task with linked daily segments', async ({ page }, testInfo) => {
  await page.clock.install({ time: new Date('2026-10-17T12:00:00') });
  await page.goto('/');
  await page.getByRole('button', { name: 'New task', exact: true }).click();
  await page.getByRole('textbox', { name: 'Task title', exact: true }).fill('Overnight focus');
  await page.getByRole('button', { name: 'Choose task date', exact: true }).click();
  await expect(page.getByText('October 2026', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next month', exact: true }).click();
  await page.getByRole('button', { name: 'Select date 2026-11-30', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Task date', exact: true })).toHaveValue('2026-11-30');
  for (const [label, hour, minute] of [['Start time', '23', '05'], ['End time', '00', '40']]) {
    await page.getByRole('button', { name: `Choose ${label.toLowerCase()}`, exact: true }).click();
    await page.getByRole('button', { name: `${label} hour ${hour}`, exact: true }).click();
    await page.getByRole('button', { name: `${label} minute ${minute}`, exact: true }).click();
    await page.getByRole('button', { name: `Done choosing ${label.toLowerCase()}`, exact: true }).click();
  }
  await expect(page.getByText(/Ends tomorrow, 2026-12-01, at 00:40/)).toBeVisible();
  await page.getByRole('button', { name: 'Save task', exact: true }).click();
  const first = page.getByRole('button', { name: /Edit task: Overnight focus.*continues into next day/ });
  await expect(first).toHaveCSS('top', '2790px');
  await expect(first).toHaveCSS('height', '110px');
  await page.getByRole('button', { name: 'Next day', exact: true }).click();
  const continuation = page.getByRole('button', { name: /Edit task: Overnight focus.*continues from previous day/ });
  await expect(continuation).toHaveCSS('top', '20px');
  await expect(continuation).toHaveCSS('height', '80px');
  await page.getByRole('button', { name: 'New task', exact: true }).click();
  await page.getByRole('textbox', { name: 'Task title', exact: true }).fill('Early morning');
  await page.getByRole('textbox', { name: 'Start time', exact: true }).fill('00:10');
  await page.getByRole('textbox', { name: 'End time', exact: true }).fill('00:30');
  await expect(page.getByRole('alert')).toContainText('Overnight focus');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await continuation.click();
  await expect(page.getByRole('textbox', { name: 'Task date', exact: true })).toHaveValue('2026-11-30');
  await page.getByRole('button', { name: 'Status: Completed', exact: true }).click();
  await page.getByRole('button', { name: 'Save task', exact: true }).click();
  await expect(page.getByRole('button', { name: /Edit task: Overnight focus.*Completed.*previous day/ })).toBeVisible();
  await page.clock.setSystemTime(new Date('2026-12-01T10:00:00'));
  await page.reload();
  await expect(page.getByRole('button', { name: /Edit task: Overnight focus.*Completed.*previous day/ })).toBeVisible();
  await page.getByRole('button', { name: 'Previous day', exact: true }).click();
  await expect(page.getByRole('button', { name: /Edit task: Overnight focus.*Completed.*next day/ })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('overnight.png'), fullPage: true });
});
