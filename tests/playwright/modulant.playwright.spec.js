const { test, expect } = require('@playwright/test');

const isConsoleMode = process.env.npm_lifecycle_event === 'test:playwright:console';

test.describe('Modulant.js Simplified Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Only show console logs in console mode
    if (isConsoleMode) {
      page.on('console', msg => console.log(`PAGE LOG: ${msg.type()}: ${msg.text()}`));
    }
    await page.goto('http://localhost:3000/test-page.html');
  });

  test('should initialize Modulant and create hidden iframe', async ({ page }) => {
    const modulantInitialized = await page.evaluate(() => typeof window.modulant !== 'undefined');
    expect(modulantInitialized).toBeTruthy();

    const iframe = await page.$('iframe[style*="display: none"]');
    expect(iframe).not.toBeNull();
  });

  test('should intercept and route API requests to secondary server', async ({ page }) => {
    await page.click('#fetch-button');
    await expect(page.locator('#result')).toHaveText('Fetch result: API route response', { timeout: 10000 });
  });

  test('should route non-API requests to primary server', async ({ page }) => {
    const [response] = await Promise.all([
      page.waitForResponse(response => response.url().includes('/non-api/test')),
      page.click('#non-api-link')
    ]);
    expect(response.url()).toBe('http://localhost:3000/non-api/test');
    expect(await response.text()).toContain('Non-API route response');
  });

  test('should intercept and modify link clicks', async ({ page }) => {
    const [response] = await Promise.all([
      page.waitForNavigation(),
      page.click('#api-link')
    ]);
    expect(page.url()).toBe('http://localhost:4000/api/test');
  });

  test('should prevent new window/tab opening and route within iframe', async ({ page, context }) => {
    const newPagePromise = context.waitForEvent('page');
    await page.click('#window-open-button');
    const newPage = await newPagePromise;
    await newPage.waitForLoadState();
    expect(newPage.url()).toBe('http://localhost:4000/api/test');
  });

  test('should inject custom script into iframe', async ({ page }) => {
    // Wait for Modulant to be ready
    await page.waitForFunction(() => window.modulant && window.modulant.isActive());

    const customEventFired = await page.evaluate(() => {
      return new Promise((resolve) => {
        let messageReceived = false;

        window.addEventListener('message', (event) => {
          if (event.data === 'custom-event-fired') {
            messageReceived = true;
            resolve(true);
          }
        });

        // Use sendTestEvent method
        window.modulant.sendTestEvent();

        // Timeout after 5 seconds
        setTimeout(() => {
          if (!messageReceived) {
            resolve(false);
          }
        }, 5000);
      });
    });
    expect(customEventFired).toBe(true);
  });

  test('should handle dynamic route addition', async ({ page }) => {
    const response = await page.evaluate(async () => {
      window.modulant.addRoute({ match: { hostname: 'localhost', path: '/dynamic/*' }, proxy: { target: 'http://localhost:4000' } });
      try {
        const response = await fetch('http://localhost:3000/dynamic/test');
        const text = await response.text();
        return { url: response.url, text };
      } catch (e) {
        return { error: e.message };
      }
    });
    expect(response.error).toBeUndefined();
    expect(response.url).toBe('http://localhost:4000/dynamic/test');
    expect(response.text).toBe('API route response');
  });

  test('should maintain proxy functionality across history navigation', async ({ page }) => {
    const response = await page.evaluate(async () => {
      try {
        history.pushState(null, '', '/api/test');
        const response = await fetch('/api/test');
        const text = await response.text();
        return { url: response.url, text };
      } catch (e) {
        return { error: e.message };
      }
    });
    expect(response.error).toBeUndefined();
    expect(response.url).toBe('http://localhost:4000/api/test');
    expect(response.text).toBe('API route response');

    const modulantActive = await page.evaluate(() => window.modulant.isActive());
    expect(modulantActive).toBe(true);
  });
});
