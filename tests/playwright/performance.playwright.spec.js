const { test, expect } = require('@playwright/test');

test.describe('Modulant Performance Tests', () => {
  test('should track request durations', async ({ page }) => {
    // Load test page
    await page.goto('http://localhost:3000/tests/mocks/test-page.html');

    // Wait for Modulant to initialize
    await page.waitForFunction(() => window.modulant?.isActive());

    // Make request and check metrics
    const metrics = await page.evaluate(async () => {
      await window.modulant._proxyRequest('http://localhost:4000/api/test');
      return window.modulant.getRequestMetrics();
    });

    console.log('Got metrics:', metrics);
    expect(metrics).toBeInstanceOf(Array);
    expect(metrics.length).toBeGreaterThan(0);
    const metric = metrics[0];
    expect(metric).toHaveProperty('duration');
    expect(metric.duration).toBeGreaterThan(0);
    expect(metric.status).toBe('completed');
  });

  test('should track in-progress and completed metrics separately', async ({ page }) => {
    // Load test page
    await page.goto('http://localhost:3000/tests/mocks/test-page.html');

    // Wait for Modulant to initialize
    await page.waitForFunction(() => window.modulant?.isActive());

    // Make request and check metrics are tracked
    const metricsAfter = await page.evaluate(async () => {
      // Start a request that will complete quickly
      const fastRequest = window.modulant._proxyRequest('http://localhost:4000/api/test');
            
      // Start a request that will timeout
      window.modulant._proxyRequest('http://localhost:4000/timeout/test')
        .catch(() => {}); // Ignore the timeout error
            
      // Wait for fast request to complete but timeout request to still be in progress
      await fastRequest;
      await new Promise(resolve => setTimeout(resolve, 100));
            
      return window.modulant.getRequestMetrics();
    });

    console.log('Got metrics after:', metricsAfter);
    expect(metricsAfter).toHaveLength(2);
        
    // Should have one completed and one in-progress metric
    const completed = metricsAfter.filter(m => m.status === 'completed');
    const inProgress = metricsAfter.filter(m => m.status === 'in-progress');
    expect(completed).toHaveLength(1);
    expect(inProgress).toHaveLength(1);
  });

  test('should track failed request durations', async ({ page }) => {
    // Load test page
    await page.goto('http://localhost:3000/tests/mocks/test-page.html');

    // Wait for Modulant to initialize
    await page.waitForFunction(() => window.modulant?.isActive());

    // Make failed request and check metrics
    const metrics = await page.evaluate(async () => {
      try {
        await window.modulant._proxyRequest('http://localhost:4000/error/test');
      } catch (error) {
        console.log('Expected error:', error);
      }
      return window.modulant.getRequestMetrics();
    });

    console.log('Got metrics:', metrics);
    expect(metrics).toBeInstanceOf(Array);
    expect(metrics.length).toBeGreaterThan(0);
    const metric = metrics[0];
    expect(metric).toHaveProperty('duration');
    expect(metric.duration).toBeGreaterThan(0);
    expect(metric.status).toBe('in-progress'); // Failed requests stay in-progress
  });

  test('should include response processing time in metrics', async ({ page }) => {
    // Load test page
    await page.goto('http://localhost:3000/tests/mocks/test-page.html');

    // Wait for Modulant to initialize
    await page.waitForFunction(() => window.modulant?.isActive());

    // Make request with response modification
    const metrics = await page.evaluate(async () => {
      await window.modulant._proxyRequest('http://localhost:4000/modified/test');
      return window.modulant.getRequestMetrics();
    });

    console.log('Got metrics:', metrics);
    expect(metrics).toBeInstanceOf(Array);
    expect(metrics.length).toBeGreaterThan(0);
    const metric = metrics[0];
    expect(metric).toHaveProperty('duration');
    expect(metric.duration).toBeGreaterThan(0);
    expect(metric.status).toBe('completed');
  });

  test('should track multiple concurrent requests separately', async ({ page }) => {
    // Load test page
    await page.goto('http://localhost:3000/tests/mocks/test-page.html');

    // Wait for Modulant to initialize
    await page.waitForFunction(() => window.modulant?.isActive());

    // Make multiple concurrent requests
    const metrics = await page.evaluate(async () => {
      // Start all requests
      const requests = [
        window.modulant._proxyRequest('http://localhost:4000/api/test'),
        window.modulant._proxyRequest('http://localhost:4000/modified/test'),
        window.modulant._proxyRequest('http://localhost:4000/timeout/test').catch(() => {})
      ];
            
      // Wait for first two requests to complete
      await Promise.all(requests.slice(0, 2));
      await new Promise(resolve => setTimeout(resolve, 100));
            
      return window.modulant.getRequestMetrics();
    });

    console.log('Got metrics:', metrics);
    expect(metrics).toBeInstanceOf(Array);
    expect(metrics).toHaveLength(3);
        
    // Should have mix of completed and in-progress
    const completed = metrics.filter(m => m.status === 'completed');
    const inProgress = metrics.filter(m => m.status === 'in-progress');
    expect(completed).toHaveLength(2);
    expect(inProgress).toHaveLength(1);
  });

  test('should preserve metrics across page navigation', async ({ page }) => {
    // Load test page
    await page.goto('http://localhost:3000/tests/mocks/test-page.html');

    // Wait for Modulant to initialize
    await page.waitForFunction(() => window.modulant?.isActive());

    // Start request and wait for metrics to be created
    const initialMetrics = await page.evaluate(async () => {
      // Start request that will timeout
      window.modulant._proxyRequest('http://localhost:4000/timeout/test')
        .catch(() => {}); // Ignore the timeout error
            
      // Wait for request to start but not timeout
      await new Promise(resolve => setTimeout(resolve, 500));
            
      // Get metrics before request completes
      const metrics = window.modulant.getRequestMetrics();
      console.log('Initial metrics:', metrics);
      return metrics;
    });

    console.log('Initial metrics:', initialMetrics);
    expect(initialMetrics).toBeInstanceOf(Array);
    expect(initialMetrics).toHaveLength(1);
    expect(initialMetrics[0].status).toBe('in-progress');

    // Navigate to another page while request is in progress
    await page.goto('http://localhost:3000/tests/mocks/test-page.html');

    // Wait for Modulant to initialize on new page
    await page.waitForFunction(() => window.modulant?.isActive());

    // Check metrics are preserved
    const finalMetrics = await page.evaluate(() => {
      const metrics = window.modulant.getRequestMetrics();
      console.log('Final metrics:', metrics);
      return metrics;
    });

    console.log('Got metrics after navigation:', finalMetrics);
    expect(finalMetrics).toBeInstanceOf(Array);
    expect(finalMetrics).toHaveLength(1);
    expect(finalMetrics[0]).toHaveProperty('duration');
    expect(finalMetrics[0].duration).toBeGreaterThan(0);
    expect(finalMetrics[0].status).toBe('in-progress');
  });
});
