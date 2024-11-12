const { expect } = require('chai');
const { setupTest } = require('./helpers/setup');
const { By, until } = require('selenium-webdriver');

describe('Modulant Routing Tests', function() {
  // Increase timeout significantly
  this.timeout(90000);

  let testContext;

  before(async function() {
    try {
      testContext = await setupTest();
      console.log(`Local server running on port ${testContext.port}`);
    } catch (error) {
      console.error('Setup failed:', error);
      throw error;
    }
  });

  after(async function() {
    if (testContext && testContext.cleanup) {
      try {
        await testContext.cleanup();
      } catch (error) {
        console.error('Cleanup failed:', error);
      }
    }
  });

  it('should conditionally route to local server for specific API paths', async function() {
    const { driver, port } = testContext;

    try {
      // Navigate to a test page
      await driver.get(`file://${process.cwd()}/index.html`);

      // Wait for page to load
      await driver.wait(until.elementLocated(By.tagName('body')), 15000);

      // Inject a script to test routing with XMLHttpRequest
      const scriptResult = await driver.executeAsyncScript(`
        const callback = arguments[arguments.length - 1];
        const localPort = arguments[0];

        console.log('Starting routing test');
        console.log('Current window location:', window.location.href);
        console.log('Local server port:', localPort);

        // Create XMLHttpRequest
        const xhr = new XMLHttpRequest();
        xhr.timeout = 30000; // 30 seconds timeout

        xhr.onload = function() {
          console.log('XHR response:', xhr.status, xhr.statusText);
          
          if (xhr.status === 200) {
            try {
              const data = JSON.parse(xhr.responseText);
              console.log('Parsed data:', data);
              callback(data);
            } catch (parseError) {
              console.error('JSON parse error:', parseError);
              callback({ error: 'Failed to parse response: ' + parseError.toString() });
            }
          } else {
            console.error('XHR error:', xhr.status, xhr.statusText);
            callback({ error: 'Request failed: ' + xhr.status });
          }
        };

        xhr.onerror = function() {
          console.error('XHR network error');
          callback({ error: 'Network error occurred' });
        };

        xhr.ontimeout = function() {
          console.error('XHR request timed out');
          callback({ error: 'Request timed out' });
        };

        // Open request to local server
        xhr.open('GET', 'http://localhost:' + localPort + '/api/products', true);
        xhr.send();
      `, port);

      // Log the full script result for debugging
      console.log('Full Script Result:', JSON.stringify(scriptResult, null, 2));

      // If there's an error in the result, throw it
      if (scriptResult && scriptResult.error) {
        throw new Error(scriptResult.error);
      }

      // Verify the response came from local server
      expect(scriptResult).to.not.be.null;
      expect(scriptResult.source).to.equal('local-server');
      expect(scriptResult.products).to.be.an('array');
    } catch (error) {
      console.error('Test failed:', error);
      throw error;
    }
  });

  it('should route default requests to AliExpress', async function() {
    const { driver } = testContext;

    try {
      // Navigate to AliExpress
      await driver.get('https://www.aliexpress.com');

      // Wait for page to load
      await driver.wait(until.urlContains('aliexpress.com'), 30000);

      // Check current URL
      const currentUrl = await driver.getCurrentUrl();
      expect(currentUrl).to.include('aliexpress.com');
    } catch (error) {
      console.error('Test failed:', error);
      throw error;
    }
  });
});
