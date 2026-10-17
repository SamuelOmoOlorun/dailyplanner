const { test, expect } = require('@playwright/test');

async function create(page, title, date, start = '09:05', end = '09:40') {
  await page.getByRole('button', { name: 'New task', exact: true }).click();
  await page.getByRole('textbox', { name: 'Task title', exact: true }).fill(title);
  await page.getByRole('textbox', { name: 'Task date', exact: true }).fill(date);
  await page.getByRole('textbox', { name: 'Start time', exact: true }).fill(start);
  await page.getByRole('textbox', { name: 'End time', exact: true }).fill(end);
  await page.getByRole('button', { name: /^Save (task|with overlap)$/ }).click();
  await expect(page.getByRole('textbox', { name: 'Task title', exact: true })).toHaveCount(0);
}

test('new-day rollover migrates with validation and overlap warning, confirms discard, and persists', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-16T18:00:00') });
  await page.goto('/');
  await create(page, 'Carry forward', '2026-10-16');
  await create(page, 'Discard old work', '2026-10-14');
  await create(page, 'Existing today', '2026-10-17');
  await page.clock.setSystemTime(new Date('2026-10-17T08:00:00'));
  await page.reload();
  await expect(page.getByRole('heading', { name: 'A fresh start for today' })).toBeVisible();
  const carry = page.getByTestId(/^review-task-/).filter({ hasText: 'Carry forward' });
  await carry.getByRole('button', { name: 'Migrate to Today' }).click();
  await expect(page.getByRole('textbox', { name: 'Task date', exact: true })).toHaveValue('2026-10-17');
  await expect(page.getByRole('alert')).toContainText('Overlaps with');
  await page.getByRole('textbox', { name: 'Task date', exact: true }).fill('2026-10-18');
  await page.getByRole('button', { name: 'Save task', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Choose today');
  await page.getByRole('textbox', { name: 'Task date', exact: true }).fill('2026-10-17');
  await page.getByRole('button', { name: 'Save with overlap' }).click();
  const discard = page.getByTestId(/^review-task-/).filter({ hasText: 'Discard old work' });
  await discard.getByRole('button', { name: 'Discard', exact: true }).click();
  await discard.getByRole('button', { name: 'Keep task' }).click();
  await expect(discard).toBeVisible();
  await discard.getByRole('button', { name: 'Discard', exact: true }).click();
  await discard.getByRole('button', { name: 'Confirm discard' }).click();
  await expect(page.getByText('All clear. No unfinished tasks to review.')).toBeVisible();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: /Edit task: Carry forward/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'A fresh start for today' })).toHaveCount(0);
});

test('manual review completes, reschedules offline, and recovers deferred past tasks', async ({ page, context }) => {
  await page.clock.install({ time: new Date('2026-10-17T18:00:00') });
  await page.goto('/');
  await create(page, 'Finish today', '2026-10-17');
  await create(page, 'Move to tomorrow', '2026-10-16');
  await page.getByRole('button', { name: 'Wrap Up Today', exact: true }).click();
  await context.setOffline(true);
  await page.getByTestId(/^review-task-/).filter({ hasText: 'Finish today' }).getByRole('button', { name: 'Complete', exact: true }).click();
  await page.getByTestId(/^review-task-/).filter({ hasText: 'Move to tomorrow' }).getByRole('button', { name: 'Reschedule' }).click();
  await page.getByRole('textbox', { name: 'Task date', exact: true }).fill('2026-10-16');
  await page.getByRole('button', { name: 'Save task', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Choose today or a future date');
  await page.getByRole('textbox', { name: 'Task date', exact: true }).fill('2026-10-18');
  await page.getByRole('button', { name: 'Save task', exact: true }).click();
  await expect(page.getByText('All clear. No unfinished tasks to review.')).toBeVisible();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await context.setOffline(false);
  await page.reload();
  await expect(page.getByRole('button', { name: /Edit task: Finish today.*Completed/ })).toBeVisible();
  await page.getByRole('button', { name: 'Next day', exact: true }).click();
  await expect(page.getByRole('button', { name: /Edit task: Move to tomorrow/ })).toBeVisible();
});

test('midnight while open triggers review; deferral survives reload and remains available manually', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-12-31T23:59:00') });
  await page.goto('/');
  await create(page, 'Year-end work', '2026-12-31');
  await page.clock.fastForward(90000);
  await expect(page.getByRole('heading', { name: 'A fresh start for today' })).toBeVisible();
  await page.getByRole('button', { name: 'Review later' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Wrap Up Today', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'A fresh start for today' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Wrap Up Today', exact: true }).click();
  await expect(page.getByTestId(/^review-task-/).filter({ hasText: 'Year-end work' })).toBeVisible();
});
