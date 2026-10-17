const { test, expect } = require('@playwright/test');

test('SQLite-backed appearance survives reload and works without network access', async ({ page, context }, testInfo) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await expect(page.getByRole('button', { name: /^Appearance:/ })).toBeVisible();
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(true);
  const root = page.getByTestId('planner-root');
  await expect(root).toHaveCSS('background-color', 'rgb(247, 248, 250)');
  await page.screenshot({ path: testInfo.outputPath('light.png'), fullPage: true });

  await page.getByRole('button', { name: /^Appearance:/ }).click();
  await page.getByRole('button', { name: 'Dark appearance', exact: true }).click();
  await expect(root).toHaveCSS('background-color', 'rgb(17, 23, 24)');
  await page.reload();
  await expect(root).toHaveCSS('background-color', 'rgb(17, 23, 24)');
  await page.screenshot({ path: testInfo.outputPath('dark.png'), fullPage: true });

  await context.setOffline(true);
  await page.getByRole('button', { name: /^Appearance:/ }).click();
  await page.getByRole('button', { name: 'Light appearance', exact: true }).click();
  await expect(root).toHaveCSS('background-color', 'rgb(247, 248, 250)');
  await context.setOffline(false);
  await page.reload();
  await expect(root).toHaveCSS('background-color', 'rgb(247, 248, 250)');

  await page.getByRole('button', { name: /^Appearance:/ }).click();
  await page.getByRole('button', { name: 'System appearance', exact: true }).click();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(root).toHaveCSS('background-color', 'rgb(17, 23, 24)');
  await page.reload();
  await expect(root).toHaveCSS('background-color', 'rgb(17, 23, 24)');
  expect(errors).toEqual([]);
});

test('storage initialization failure recovers after retry', async ({ page }) => {
  await page.route('**/*.wasm', (route) => route.abort());
  await page.goto('/');
  await expect(page.getByText('Your planner couldn’t open')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await page.unroute('**/*.wasm');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('button', { name: /^Appearance:/ })).toBeVisible();
});
