const { test, expect } = require('@playwright/test');
const debug = require('debug')('modulant:test');

const isConsoleMode = process.env.npm_lifecycle_event === 'test:playwright:console';

test.describe('Modulant.js Integration Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Only show console logs in console mode
    if (isConsoleMode) {
      page.on('console', msg => debug(`PAGE LOG: ${msg.type()}: ${msg.text()}`));
    }
    await page.goto('http://localhost:3000/test-page.html');
  });

  test('should initialize Modulant and create hidden iframe', async ({ page }) => {
    const modulantInitialized = await page.evaluate(() => typeof window.modulant !== 'undefined');
    expect(modulantInitialized).toBeTruthy();

    const iframe = await page.$('iframe[style*="display: none"]');
    expect(iframe).not.toBeNull();
  });

  // URL Parameter Tests
  test.describe('URL Parameter Handling', () => {
    test('should transform parameters correctly', async ({ page }) => {
      const [response] = await Promise.all([
        page.waitForResponse(response => response.url().includes('/api/test')),
        page.click('#transform-link')
      ]);
      
      const data = await response.json();
      expect(data.parameters.uppercase).toBe('HELLO');
      expect(data.parameters.base64).toBe('d29ybGQ='); // 'world' in base64
      expect(data.parameters.default_param).toBe('default_value');
    });

    test('should validate parameters according to rules', async ({ page }) => {
      const [response] = await Promise.all([
        page.waitForResponse(response => response.url().includes('/api/test')),
        page.click('#validation-link')
      ]);
      
      const data = await response.json();
      expect(data.parameters.required_param).toBe('value');
      expect(data.parameters.pattern_param).toBe('123');
      expect(data.parameters.custom_param).toBe('longvalue');
      expect(data.parameters.default_param).toBe('default_value');
    });

    test('should filter out internal parameters', async ({ page }) => {
      const [response] = await Promise.all([
        page.waitForResponse(response => response.url().includes('/api/test')),
        page.click('#filter-link')
      ]);
      
      const data = await response.json();
      expect(data.parameters._internal_param).toBeUndefined();
      expect(data.parameters.public_param).toBe('visible');
      expect(data.parameters.default_param).toBe('default_value');
    });

    test('should preserve complex parameters', async ({ page }) => {
      const [response] = await Promise.all([
        page.waitForResponse(response => response.url().includes('/api/test')),
        page.click('#complex-params-link')
      ]);
      
      debug('Response URL:', response.url());
      const data = await response.json();
      debug('Response data:', JSON.stringify(data, null, 2));
      debug('Parameters:', JSON.stringify(data.parameters, null, 2));
      debug('Array parameter:', data.parameters['array[]']);
      
      expect(data.parameters['array[]']).toEqual(['1', '2']);
      expect(data.parameters['nested[key]']).toBe('value');
      expect(data.parameters.default_param).toBe('default_value');
    });

    test('should handle custom parameter input', async ({ page }) => {
      await page.fill('#param-name', 'custom_param');
      await page.fill('#param-value', 'longvalue123');
      
      const [response] = await Promise.all([
        page.waitForResponse(response => response.url().includes('/api/test')),
        page.click('form button')
      ]);
      
      const data = await response.json();
      expect(data.parameters.custom_param).toBe('longvalue123');
      expect(data.parameters.default_param).toBe('default_value');
    });

    test('should reject invalid parameters', async ({ page }) => {
      await page.fill('#param-name', 'pattern_param');
      await page.fill('#param-value', 'invalid');
      
      const [response] = await Promise.all([
        page.waitForResponse(response => response.url().includes('/api/test')),
        page.click('form button')
      ]);
      
      const data = await response.json();
      expect(data.parameters.pattern_param).toBeUndefined();
      expect(data.parameters.default_param).toBe('default_value');
    });
  });

  // Original Tests
  test('should intercept and route API requests to secondary server', async ({ page }) => {
    await page.click('#fetch-button');
    const result = await page.locator('#result').textContent();
    expect(result).toContain('API route response');
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
    expect(page.url()).toBe('http://localhost:4000/api/test?default_param=default_value');
  });

  test('should prevent new window/tab opening and route within iframe', async ({ page, context }) => {
    const newPagePromise = context.waitForEvent('page');
    await page.click('#window-open-button');
    const newPage = await newPagePromise;
    await newPage.waitForLoadState();
    expect(newPage.url()).toBe('http://localhost:4000/api/test?default_param=default_value');
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
        const data = await response.json();
        return { url: response.url, data };
      } catch (e) {
        return { error: e.message };
      }
    });
    expect(response.error).toBeUndefined();
    expect(response.url).toBe('http://localhost:4000/dynamic/test?default_param=default_value');
    expect(response.data.message).toBe('API route response');
  });

  test('should maintain proxy functionality across history navigation', async ({ page }) => {
    const response = await page.evaluate(async () => {
      try {
        history.pushState(null, '', '/api/test');
        const response = await fetch('/api/test');
        const data = await response.json();
        return { url: response.url, data };
      } catch (e) {
        return { error: e.message };
      }
    });
    expect(response.error).toBeUndefined();
    expect(response.url).toBe('http://localhost:4000/api/test?default_param=default_value');
    expect(response.data.message).toBe('API route response');

    const modulantActive = await page.evaluate(() => window.modulant.isActive());
    expect(modulantActive).toBe(true);
  });
});
