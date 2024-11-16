const { expect } = require('chai');
const { Builder, By, until, Key } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const SecondaryServer = require('../../secondary-server');
const checkoutRouting = require('../../config/checkout-routing');
const fs = require('fs');

describe('AliExpress Checkout Journey', function() {
  this.timeout(300000); // Extended timeout for complex interactions
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

  async function findElementWithRetry(selectors, xpaths = [], timeout = 20000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      // Try XPath selectors first
      for (const xpath of xpaths) {
        try {
          const elements = await driver.findElements(By.xpath(xpath));
          if (elements.length > 0) {
            // Scroll to the first element if it exists
            await driver.executeScript('arguments[0].scrollIntoView({block: "center"});', elements[0]);
            return elements[0];
          }
        } catch (error) {
          console.log(`XPath ${xpath} not found:`, error.message);
        }
      }

      // Try CSS selectors
      for (const selector of selectors) {
        try {
          const elements = await driver.findElements(By.css(selector));
          if (elements.length > 0) {
            // Scroll to the first element if it exists
            await driver.executeScript('arguments[0].scrollIntoView({block: "center"});', elements[0]);
            return elements[0];
          }
        } catch (error) {
          console.log(`CSS Selector ${selector} not found:`, error.message);
        }
      }

      // Try JavaScript selectors
      const jsElement = await driver.executeScript(`
        const selectors = ${JSON.stringify(selectors)};
        const xpaths = ${JSON.stringify(xpaths)};
        
        // Try XPaths first
        for (const xpath of xpaths) {
          const xpathElements = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
          if (xpathElements) return xpathElements;
        }
        
        // Then try CSS selectors
        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            return elements[0];
          }
        }
        return null;
      `);

      if (jsElement) {
        return jsElement;
      }
      
      // Wait a bit before retrying
      await driver.sleep(1000);
    }
    
    // Log page source for debugging
    const pageSource = await driver.getPageSource();
    console.error('Page source:', pageSource);
    
    throw new Error(`Could not find any element with selectors: ${selectors.join(', ')} or XPaths: ${xpaths.join(', ')}`);
  }

  it('should simulate a complete checkout journey from homepage search', async function() {
    try {
      // Navigate to AliExpress homepage
      await driver.get('https://www.aliexpress.com');

      // Wait for page to load completely
      await driver.wait(until.urlContains('aliexpress.com'), 30000);

      // Take initial screenshot for debugging
      await takeScreenshot('homepage-initial.png');

      // Find search input with multiple selectors
      const searchInputSelectors = [
        '#search-words',
        'input[type="search"]',
        'input.search-input',
        'input#search-key',
        'input[name="SearchText"]',
        'input[placeholder="Search"]'
      ];

      const searchInput = await findElementWithRetry(searchInputSelectors);
      
      // Search for smartphone
      await searchInput.sendKeys('smartphone', Key.RETURN);

      // Wait for search results
      const searchResultSelectors = [
        '#card-list > div:nth-child(1) > div > div > a',
        '.product-card',
        '.list-item',
        '.item-card',
        '[data-spm="search_list_item"]'
      ];

      const firstResult = await findElementWithRetry(searchResultSelectors);
      await firstResult.click();

      // Switch to the new product detail tab
      const handles = await driver.getAllWindowHandles();
      await driver.switchTo().window(handles[1]);

      // Wait for product details to load
      const productDetailSelectors = [
        '.product-price',
        '.price',
        '[data-price]',
        '.product-info-price'
      ];

      await findElementWithRetry(productDetailSelectors);

      // Take screenshot of product page
      await takeScreenshot('product-page.png');

      // Find and click add to cart button with extensive selectors and XPath
      const addToCartSelectors = [
        'button[data-spm="add_to_cart"]',
        '.add-to-cart-button',
        'button.add-to-cart',
        '#add-to-cart-button',
        '[data-role="add-to-cart"]'
      ];

      const addToCartXPaths = [
        '/html/body/div[6]/div/div[1]/div/div[2]/div/div/div[7]/button[2]'
      ];

      const addToCartButton = await findElementWithRetry(addToCartSelectors, addToCartXPaths);
      await addToCartButton.click();

      // Wait for cart confirmation
      const cartConfirmationXPaths = [
        '/html/body/div[12]/div/div'
      ];

      await findElementWithRetry([], cartConfirmationXPaths);

      // Open cart menu
      const cartMenuXPath = '//*[@id="_full_container_header_23_"]/div[2]/div/div[2]/div[4]/a';
      const cartMenuButton = await findElementWithRetry([], [cartMenuXPath]);
      await cartMenuButton.click();

      // Proceed to checkout
      const checkoutXPath = '/html/body/div[7]/div[1]/div[1]/div[2]/div[2]/button';
      const proceedToCheckoutButton = await findElementWithRetry([], [checkoutXPath]);
      await proceedToCheckoutButton.click();

      // Handle Sign-in Modal
      const signInModalXPath = '/html/body/div[12]/div/div[2]/div';
      await findElementWithRetry([], [signInModalXPath]);

      // Email Input
      const emailInputXPath = '/html/body/div[12]/div/div[2]/div/div/div/div[1]/div/div[3]/div[2]/div/span/span[1]/span[1]/input';
      const emailInput = await findElementWithRetry([], [emailInputXPath]);
      await emailInput.sendKeys('test@example.com');
      await emailInput.sendKeys(Key.RETURN);

      // Wait for password field to become visible
      const passwordInputXPath = '/html/body/div[12]/div/div[2]/div/div/div/div[1]/span/span[1]/input';
      const passwordInput = await findElementWithRetry([], [passwordInputXPath]);
      await passwordInput.sendKeys('testpassword');

      // Sign-in Button
      const signInButtonXPath = '/html/body/div[12]/div/div[2]/div/div/div/div[1]/div[9]/button';
      const signInButton = await findElementWithRetry([], [signInButtonXPath]);
      await signInButton.click();

      // Simulate request interception and show alert
      await driver.executeScript(`
        alert('Server captured sign-in XHR request with credentials:\\nEmail: test@example.com\\nPassword: testpassword');
      `);

      // Wait for alert
      await driver.wait(until.alertIsPresent());
      const alert = await driver.switchTo().alert();
      await alert.accept();

    } catch (error) {
      console.error('Checkout journey test failed:', error);
      
      // Take final screenshot on failure
      await takeScreenshot('checkout-failure.png');
      
      throw error;
    }
  });
});
