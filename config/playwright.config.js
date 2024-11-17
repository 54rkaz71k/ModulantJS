// @ts-check
const { devices } = require('@playwright/test');

const isConsoleMode = process.env.npm_lifecycle_event === 'test:playwright:console';

/**
 * @see https://playwright.dev/docs/test-configuration
 * @type {import('@playwright/test').PlaywrightTestConfig}
 */
const config = {
  testDir: '../tests/playwright',
  timeout: 30 * 1000,
  expect: {
    timeout: 5000
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,

  globalSetup: require.resolve('./global-setup.js'),
  globalTeardown: require.resolve('./global-teardown.js'),

  reporter: isConsoleMode ? [['list']] : [['dot'], ['json', { outputFile: 'test-results/results.json' }]],
  use: {
    actionTimeout: 0,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
  webServer: {
    command: 'node ../tests/mocks/test-server.js 3000 & node ../tests/mocks/test-server.js 4000',
    url: 'http://localhost:3000',
    reuseExistingServer: false,
  },
};

module.exports = config;
