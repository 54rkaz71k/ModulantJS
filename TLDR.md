# Modulant.js: Stealth Web Extension Framework

## The Hacker's Dilemma: Extending Third-Party Websites

Imagine you want to enhance a website's functionality without:
- Modifying the original source code
- Asking for permission
- Breaking the site's core experience

**Modulant.js is your invisible Swiss Army knife for web manipulation.**

## Installation

```bash
# NPM
npm install modulant-js

# Or clone the repository
git clone https://github.com/54rkaz71k/ModulantJS.git
```

## Use Case: Transforming a Restricted E-Commerce Platform

### Scenario: AliExpress Product Tracking and Custom Routing

You're frustrated with AliExpress's limited tracking and want to:
- Intercept specific API routes
- Inject custom tracking scripts
- Reroute certain requests to your own backend
- Avoid CORS restrictions

**Modulant's Magic:**
```javascript
// Using npm package
import Modulant from 'modulant-js';
// Or using direct include
// const { Modulant } = require('modulant-js');

const modulant = await Modulant.init({
    primaryServerURL: 'https://aliexpress.com',
    secondaryServerURL: 'https://your-tracking-service.com',
    routes: [
        // Reroute specific API endpoints
        { 
          match: { 
            hostname: 'aliexpress.com',
            path: '/product/tracking'
          },
          proxy: { target: 'secondary' }
        },
        { 
          match: { 
            hostname: 'aliexpress.com',
            path: '/api/order-details'
          },
          proxy: { target: 'secondary' }
        }
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

## Development

```bash
# Clone the repository
git clone https://github.com/54rkaz71k/ModulantJS.git

# Install dependencies
npm install

# Run tests
npm test

# Run with detailed logs
npm run test:console

# Run in debug mode
npm run test:debug

# Start development server
npm run dev
```

## Debugging

Enable debug logging in Node.js:
```javascript
process.env.DEBUG_MODULANT = 'true';
```

Enable debug logging in browser:
```javascript
localStorage.setItem('DEBUG_MODULANT', 'true');
```

## Ethical Usage
- Use responsibly
- Respect website terms of service
- Consider privacy implications

## Project Status
- Active development
- Well-tested codebase
- Production-ready
- Available on npm

**Unlock the power of invisible web extension!**
