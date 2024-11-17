# Modulant.js: Stealth Web Extension Framework

## The Hacker's Dilemma: Extending Third-Party Websites

Imagine you want to enhance a website's functionality without:
- Modifying the original source code
- Asking for permission
- Breaking the site's core experience

**Modulant.js is your invisible Swiss Army knife for web manipulation.**

## Use Case: Transforming a Restricted E-Commerce Platform

### Scenario: AliExpress Product Tracking and Custom Routing

You're frustrated with AliExpress's limited tracking and want to:
- Intercept specific API routes
- Inject custom tracking scripts
- Reroute certain requests to your own backend
- Avoid CORS restrictions

**Modulant's Magic:**
```javascript
const modulant = Modulant.init({
    primaryServerURL: 'https://aliexpress.com',
    secondaryServerURL: 'https://your-tracking-service.com',
    routes: [
        // Reroute specific API endpoints
        { pattern: '/product/tracking', target: 'secondary' },
        { pattern: '/api/order-details', target: 'secondary' }
    ],
    injectScript: `
        // Custom tracking logic
        window.addEventListener('purchase', (event) => {
            fetch('/custom-tracking-endpoint', {
                method: 'POST',
                body: JSON.stringify(event.detail)
            });
        });
    `,
    defaultHeaders: {
        'X-Custom-Tracker': 'Modulant'
    }
});
```

## Technical Superpowers

### 🕵️ Invisible Interception
- Capture all link clicks
- Intercept AJAX and fetch requests
- Modify requests in-flight

### 🛡️ CORS Circumvention
- Use hidden iframe as proxy
- Bypass same-origin policy restrictions
- Transparent request routing

### 🧬 Surgical Precision
- Target specific routes
- Inject custom JavaScript
- Minimal site disruption

### 🔒 Code Obfuscation
- Automatic code obfuscation protection
- Hide implementation details
- Prevent reverse engineering

## Real-World Applications

1. **Development & Testing**
   - Local development with production APIs
   - API mocking and testing
   - Cross-origin development

2. **Web Scraping & Automation**
   - Data collection
   - Process automation
   - Content aggregation

3. **Analytics & Monitoring**
   - Custom tracking implementation
   - User behavior analysis
   - Performance monitoring

## Getting Started

```bash
# Clone the repository
git clone https://github.com/54rkaz71k/ModulantJS.git

# Install dependencies
npm install

# Run tests
npm run test:all
```

## Testing Infrastructure

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
# Run with minimal output
npm run test:playwright

# Run with detailed logs
npm run test:playwright:console

# Run in debug mode
npm run test:playwright:debug
```

## Ethical Usage
- Use responsibly
- Respect website terms of service
- Consider privacy implications

## Project Status
- Active development
- Well-tested codebase
- Production-ready

**Unlock the power of invisible web extension!**
