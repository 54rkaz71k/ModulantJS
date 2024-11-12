const { expect } = require('chai');
const { Builder, By, until, Key } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const SecondaryServer = require('../../secondary-server');
const checkoutRouting = require('../../config/checkout-routing');
const fs = require('fs');

describe('AliExpress Checkout Journey', function() {
  this.timeout(180000); // Extended timeout for complex interactions
  let driver;
  let secondaryServer;

  before(async function() {
    // Start secondary server
    secondaryServer = await SecondaryServer.start();

    // Configure ChromeDriver with advanced options
    const options = new chrome.Options();
    options.addArguments('--disable-web-security');
    options.addArguments('--allow-file-access-from-files');
    options.addArguments('--start-maximized');
    options.addArguments('--disable-blink-features=AutomationControlled');
    options.addArguments('--disable-popup-blocking');
    options.addArguments('--disable-extensions');
    options.addArguments('--no-sandbox');
    options.addArguments('--disable-dev-shm-usage');
    options.addArguments('--disable-gpu');
    options.addArguments('--window-size=1920,1080');
    options.addArguments('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Add Modulant configuration as Chrome argument
    const routingConfig = JSON.stringify(checkoutRouting.routes);
    options.addArguments(`--modulant-routes=${routingConfig}`);

    // Create WebDriver instance
    driver = await new Builder()
      .forBrowser('chrome')
      .setChromeOptions(options)
      .build();
  });

  after(async function() {
    // Cleanup
    if (driver) {
      await driver.quit();
    }
    if (secondaryServer && typeof secondaryServer.stop === 'function') {
      await secondaryServer.stop();
    }
  });

  async function takeScreenshot(filename) {
    try {
      const screenshot = await driver.takeScreenshot();
      fs.writeFileSync(filename, screenshot, 'base64');
      console.log(`Screenshot saved: ${filename}`);
    } catch (error) {
      console.error('Failed to take screenshot:', error);
    }
  }

  it('should simulate a complete checkout journey from homepage search', async function() {
    try {
      // Navigate to AliExpress homepage
      await driver.get('https://www.aliexpress.com');

      // Wait for page to load completely
      await driver.wait(until.urlContains('aliexpress.com'), 30000);

      // Take initial screenshot for debugging
      await takeScreenshot('homepage-initial.png');

      // Find and interact with search input
      const searchInput = await driver.findElement(By.id('search-words'));
      await searchInput.sendKeys('smartphone', Key.RETURN);

      // Wait for search results container
      await driver.wait(
        until.elementLocated(By.css('#card-list')), 
        30000
      );

      // Take screenshot of search results
      await takeScreenshot('search-results.png');

      // Select first search result using the provided robust selector
      const firstResultSelector = '#card-list > div:nth-child(1) > div > div > a';
      const firstResult = await driver.findElement(By.css(firstResultSelector));
      await firstResult.click();

      // Switch to the new product detail tab
      const handles = await driver.getAllWindowHandles();
      await driver.switchTo().window(handles[1]);

      // Wait for product details to load
      await driver.wait(
        until.elementLocated(By.css('.product-price, .price')), 
        20000
      );

      // Take screenshot of product page
      await takeScreenshot('product-page.png');

      // Find and click add to cart button
      const addToCartButton = await driver.findElement(By.css('button[data-spm="add_to_cart"]'));
      await addToCartButton.click();

      // Wait for cart confirmation
      await driver.wait(
        until.elementLocated(By.css('.cart-added-confirmation')), 
        10000
      );

      // Take screenshot after adding to cart
      await takeScreenshot('cart-added.png');

      // Proceed to checkout
      const proceedToCheckoutButton = await driver.findElement(By.css('.proceed-to-checkout'));
      await proceedToCheckoutButton.click();

      // Fill shipping details
      await driver.wait(
        until.elementLocated(By.css('.shipping-form')), 
        15000
      );
      
      const nameInput = await driver.findElement(By.name('fullName'));
      const addressInput = await driver.findElement(By.name('address'));
      const cityInput = await driver.findElement(By.name('city'));
      
      await nameInput.sendKeys('John Doe');
      await addressInput.sendKeys('123 Test Street');
      await cityInput.sendKeys('Test City');

      // Submit checkout
      const submitCheckoutButton = await driver.findElement(By.css('.submit-checkout'));
      await submitCheckoutButton.click();

      // Wait for order confirmation
      const orderConfirmation = await driver.wait(
        until.elementLocated(By.css('.order-confirmation')), 
        15000
      );

      // Take screenshot of order confirmation
      await takeScreenshot('order-confirmation.png');

      // Verify order details
      const orderIdElement = await driver.findElement(By.css('.order-id'));
      const orderTotalElement = await driver.findElement(By.css('.order-total'));

      const orderId = await orderIdElement.getText();
      const orderTotal = await orderTotalElement.getText();

      expect(orderId).to.match(/^ORDER-/);
      expect(parseFloat(orderTotal)).to.be.greaterThan(0);

    } catch (error) {
      console.error('Checkout journey test failed:', error);
      
      // Take final screenshot on failure
      await takeScreenshot('checkout-failure.png');
      
      throw error;
    }
  });
});
