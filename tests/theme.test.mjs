import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isThemePreference, resolveTheme } from '../src/theme/tokens.ts';

test('system appearance follows the device, with a light fallback', () => {
  assert.equal(resolveTheme('system', 'dark'), 'dark');
  assert.equal(resolveTheme('system', 'light'), 'light');
  assert.equal(resolveTheme('system', null), 'light');
});

test('explicit appearance overrides the device and stored values are validated', () => {
  assert.equal(resolveTheme('dark', 'light'), 'dark');
  assert.equal(resolveTheme('light', 'dark'), 'light');
  for (const value of ['light', 'dark', 'system']) assert.equal(isThemePreference(value), true);
  for (const value of [null, '', 'invalid']) assert.equal(isThemePreference(value), false);
});
