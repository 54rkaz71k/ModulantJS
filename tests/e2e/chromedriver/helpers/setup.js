const path = require('path');
const { Builder } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const { createLocalServer } = require(path.resolve(__dirname, '../../../mocks/local-server'));
const modulantRouting = require(path.resolve(__dirname, '../../../../config/modulant-routing'));

async function setupTest() {
  try {
    // Start local mock server
    const { server: localServer, port } = await createLocalServer();

    // Configure ChromeDriver options
    const options = new chrome.Options();
    
    // Add Modulant configuration as Chrome argument
    const routingConfig = JSON.stringify({
      ...modulantRouting.routes,
      localServerPort: port
    });

    // Add Chrome arguments to enable Modulant routing
    options.addArguments(
      `--modulant-routes=${routingConfig}`,
      '--disable-web-security',
      '--allow-file-access-from-files',
      '--allow-running-insecure-content'
    );

    // Create WebDriver instance with more detailed configuration
    const driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build();

    // Set window size to ensure full page loads
    await driver.manage().window().setRect({ width: 1920, height: 1080 });

    return {
      driver,
      localServer,
      port,
      cleanup: async () => {
        try {
          if (driver) {
            await driver.quit();
          }
          if (localServer) {
            localServer.close();
          }
        } catch (error) {
          console.error('Cleanup error:', error);
        }
      }
    };
  } catch (error) {
    console.error('Setup failed:', error);
    throw error;
  }
}

module.exports = { setupTest };
