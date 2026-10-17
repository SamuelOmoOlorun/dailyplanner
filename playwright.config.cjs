const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/browser',
  outputDir: '.expo/test-results',
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: 'http://127.0.0.1:8082',
    browserName: 'chromium',
    launchOptions: {
      executablePath: process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm.cmd run preview:web',
    url: 'http://127.0.0.1:8082',
    reuseExistingServer: true,
  },
});
