const { test, expect } = require('@playwright/test');

async function fillTask(page, title, start, end) {
  await page.getByRole('textbox', { name: 'Task title', exact: true }).fill(title);
  await page.getByRole('textbox', { name: 'Start time', exact: true }).fill(start);
  await page.getByRole('textbox', { name: 'End time', exact: true }).fill(end);
}

test('create, validate, overlap, edit, complete, and reload real SQLite tasks', async ({ page, context }, testInfo) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'New task', exact: true }).click();
  await fillTask(page, 'Focus session', '09:05', '09:05');
  await page.getByRole('button', { name: 'Save task', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('End time must differ');
  await page.getByRole('textbox', { name: 'End time', exact: true }).fill('09:40');
  await page.getByRole('button', { name: 'Priority: High', exact: true }).click();
  await page.getByRole('button', { name: 'Reminder: 10 min before', exact: true }).click();
  await page.getByRole('button', { name: 'Save task', exact: true }).click();
  const first = page.getByRole('button', { name: /Edit task: Focus session, 09:05 to 09:40, high priority, Pending/ });
  await expect(first).toBeVisible();
  await expect(first).toHaveCSS('top', '1110px');
  await expect(first).toHaveCSS('height', '70px');
  await context.setOffline(true);
  await page.getByRole('button', { name: 'New task', exact: true }).click();
  await fillTask(page, 'Overlap session', '09:20', '09:50');
  await expect(page.getByRole('alert')).toContainText('Overlaps with');
  await page.getByRole('button', { name: 'Save with overlap', exact: true }).click();
  await expect(page.getByRole('button', { name: /Edit task: Overlap session/ })).toBeVisible();
  expect(await first.evaluate((element) => Math.abs(element.getBoundingClientRect().width * 2 - element.parentElement.getBoundingClientRect().width))).toBeLessThan(2);
  await context.setOffline(false);
  await page.reload();
  await first.click();
  await expect(page.getByRole('textbox', { name: 'Start time', exact: true })).toHaveValue('09:05');
  await expect(page.getByRole('button', { name: 'Reminder: 10 min before', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await fillTask(page, 'Focused and finished', '10:01', '10:36');
  await page.getByRole('button', { name: 'Status: Completed', exact: true }).click();
  await page.getByRole('button', { name: 'Save task', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: /Edit task: Focused and finished, 10:01 to 10:36, high priority, Completed/ })).toBeVisible();
  await page.getByRole('button', { name: 'Next day', exact: true }).click();
  await expect(page.getByText('A little breathing room. Add your first time block.')).toBeVisible();
  await page.getByRole('button', { name: 'Previous day', exact: true }).click();
  await expect(page.getByRole('button', { name: /Edit task: Focused and finished/ })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('phase2-timeline.png'), fullPage: true });
  expect(errors).toEqual([]);
});

for (const useWorker of [false, true]) {
test(`browser reminders fire offline, cancel completion, and restore after reload (${useWorker ? 'worker display' : 'desktop display'})`, async ({ page, context }) => {
  await page.addInitScript((useWorker) => {
    window.__reminders = [];
    class MockNotification {
      static permission = sessionStorage.getItem('test-notification-permission') || 'default';
      static requestPermission = async () => { MockNotification.permission = 'granted'; sessionStorage.setItem('test-notification-permission', 'granted'); return 'granted'; };
      constructor(title, options) { if (useWorker) throw new TypeError('Mobile notification display requires a worker'); window.__reminders.push({ title, ...options }); }
      close() {}
    }
    window.Notification = MockNotification;
    if (useWorker) {
      const registration = { active: {}, showNotification: async (title, options) => { window.__reminders.push({ title, ...options }); } };
      Object.defineProperty(navigator, 'serviceWorker', { value: { register: async () => registration, ready: Promise.resolve(registration) } });
    }
  }, useWorker);
  await page.clock.install({ time: new Date('2026-10-17T08:00:10') });
  await page.goto('/');
  await page.getByRole('button', { name: 'Enable reminders', exact: true }).click();
  await expect(page.getByText(/Reminders are on/)).toBeVisible();
  await page.getByRole('button', { name: 'New task', exact: true }).click();
  await fillTask(page, 'Offline reminder', '08:01', '08:20');
  await page.getByRole('button', { name: 'Save task', exact: true }).click();
  await expect(page.getByRole('button', { name: /Edit task: Offline reminder/ })).toBeVisible();
  await page.clock.runFor(1000);
  await context.setOffline(true);
  await page.clock.fastForward(50000);
  await expect.poll(() => page.evaluate(() => window.__reminders.length)).toBe(1);
  expect(await page.evaluate(() => window.__reminders[0].title)).toBe('Offline reminder');
  await context.setOffline(false);
  await page.getByRole('button', { name: 'New task', exact: true }).click();
  await fillTask(page, 'Cancel this reminder', '08:03', '08:25');
  await page.getByRole('button', { name: 'Save with overlap', exact: true }).click();
  await page.getByRole('button', { name: /Edit task: Cancel this reminder/ }).click();
  await page.getByRole('button', { name: 'Status: Completed', exact: true }).click();
  await page.getByRole('button', { name: 'Save with overlap', exact: true }).click();
  await page.getByRole('button', { name: 'New task', exact: true }).click();
  await fillTask(page, 'Restored reminder', '08:06', '08:20');
  await page.getByRole('button', { name: 'Save with overlap', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: /Edit task: Restored reminder/ })).toBeVisible();
  await page.clock.runFor(1000);
  await page.clock.fastForward(120000);
  expect(await page.evaluate(() => window.__reminders.length)).toBe(0);
  await page.clock.fastForward(180000);
  await expect.poll(() => page.evaluate(() => window.__reminders.length)).toBe(1);
  expect(await page.evaluate(() => window.__reminders[0].title)).toBe('Restored reminder');
});
}

test('denied notification permission does not block saving a task', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'Notification', { value: class { static permission = 'denied'; static requestPermission = async () => 'denied'; } }); });
  await page.goto('/');
  await expect(page.getByText(/Notifications are blocked/)).toBeVisible();
  await page.getByRole('button', { name: 'New task', exact: true }).click();
  await fillTask(page, 'Saved without notifications', '14:05', '14:40');
  await page.getByRole('button', { name: 'Save task', exact: true }).click();
  await expect(page.getByRole('button', { name: /Edit task: Saved without notifications/ })).toBeVisible();
});
