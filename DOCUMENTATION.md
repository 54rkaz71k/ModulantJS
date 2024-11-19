# 🚀 ModulantJS Documentation

## What is ModulantJS?

ModulantJS is a stealth web extension framework that lets you modify and enhance websites you don't control. Think of it as a "man in the middle" for web requests, but one that works for you! 

### Common Use Cases
- Add features to vendor platforms without modifying their code
- Route API calls through your own servers for enhanced processing
- Fix bugs in third-party webapps without waiting for vendors
- Add analytics and monitoring to external services
- Gradually migrate from legacy platforms without disruption

## 📋 Table of Contents
1. [Core Concepts](#core-concepts)
2. [Installation](#installation)
3. [Basic Usage](#basic-usage)
4. [Request Control](#request-control)
5. [Response Enhancement](#response-enhancement)
6. [Navigation Control](#navigation-control)
7. [Debugging](#debugging)
8. [Advanced Examples](#advanced-examples)

## Core Concepts

ModulantJS works by:
1. Creating an invisible proxy frame in the page
2. Intercepting all web requests (fetch, XHR, navigation)
3. Applying your rules and modifications
4. Forwarding requests to their destination

This means you can:
- Modify requests before they're sent
- Transform responses before they reach the page
- Add your own functionality without touching the original code

## Installation

```bash
# Clone the repository
git clone https://github.com/54rkaz71k/ModulantJS.git

# Install dependencies
npm install
```

## Basic Usage

Let's start with a real-world example. Say you're using Shopify, but need to:
- Route certain API calls through your servers
- Add custom analytics
- Fix some UX issues

```html
<script src="path/to/modulant.js"></script>
<script>
  const modulant = new Modulant({
    primaryServerURL: 'https://your-shop.myshopify.com',
    secondaryServerURL: 'https://your-api.com'
  });
</script>
```

Or with ES modules:

```javascript
import Modulant from 'modulant';

const modulant = await Modulant.init({
  primaryServerURL: 'https://your-shop.myshopify.com',
  secondaryServerURL: 'https://your-api.com'
});
```

## Request Control

### Scenario: Working with Salesforce
Let's say you're integrating with Salesforce, but their API has some quirks:
- They require specific parameter formats
- Their validation is inconsistent
- They send unnecessary analytics params

Here's how to handle it:

```javascript
const modulant = new Modulant({
  parameterConfig: {
    // Fix Salesforce's parameter requirements
    transformHooks: {
      'sObjectType': (value) => value.toUpperCase(), // They require uppercase
      'recordType': (value) => value.replace(/-/g, '_'), // They don't allow hyphens
      'query': (value) => encodeURIComponent(value) // Their encoding is broken
    },

    // Add validation they're missing
    parameterRules: {
      'recordId': { 
        pattern: '^[a-zA-Z0-9]{15,18}$', // Salesforce ID format
        required: true
      },
      'fields': { 
        validate: (value) => {
          // They don't validate field names
          const validFields = ['Name', 'Email', 'Phone'];
          const requested = value.split(',');
          return requested.every(field => validFields.includes(field));
        }
      }
    },

    // Add missing required parameters
    defaultValues: {
      'version': '54.0',
      'format': 'json'
    },

    // Remove their tracking params
    filterPatterns: [
      'oid',          // Their org ID (we don't need it)
      'sid',          // Their session ID (we handle auth differently)
      '_CONFIRMATIONTOKEN' // Their CSRF token (we use our own)
    ]
  }
});

// Their messy URL: /services/data/v54.0/query?q=select-name&oid=123&_CONFIRMATIONTOKEN=abc
// Becomes clean: /services/data/v54.0/query?q=select%20name&version=54.0&format=json
```

### Scenario: Migrating from Oracle Cloud
You're moving from Oracle Cloud to AWS, but need to do it gradually:

```javascript
const modulant = new Modulant({
  routes: [
    // Move specific APIs first
    { 
      match: { 
        hostname: 'cloud.oracle.com',
        path: '/api/v1/analytics/*'  // Move analytics first
      },
      proxy: { 
        target: 'https://your-aws-analytics.com'
      }
    },
    // Test new features with beta users
    { 
      match: { 
        hostname: 'cloud.oracle.com',
        path: '/api/v2/*'  // New API version
      },
      proxy: { 
        target: 'https://your-aws-api.com'
      }
    }
  ]
});

// Gradually migrate more users
if (user.isBetaTester) {
  modulant.addRoute({
    match: { 
      hostname: 'cloud.oracle.com',
      path: '/api/v1/*'  // Move them to v2
    },
    proxy: {
      target: 'https://your-aws-api.com/v2'
    }
  });
}
```

## Response Enhancement

### Scenario: Fixing Workday's UI
Workday's UI has some issues you need to fix:

```javascript
const modulant = new Modulant({
  injectScript: `
    // Fix their broken date picker
    window.addEventListener('message', (event) => {
      if (event.data.type === 'response' && 
          event.data.url.includes('/date-picker')) {
        const data = JSON.parse(event.data.body);
        
        // Fix their date format
        data.dates = data.dates.map(date => ({
          ...date,
          value: new Date(date.value).toISOString()
        }));
        
        // Add missing timezone info
        data.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        
        event.data.body = JSON.stringify(data);
      }
    });

    // Add missing accessibility attributes
    const fixAccessibility = (html) => {
      return html
        .replace(/<button>/g, '<button role="button">')
        .replace(/<input>/g, '<input aria-label="Input field">');
    };

    // Fix their HTML responses
    window.addEventListener('message', (event) => {
      if (event.data.type === 'response' && 
          event.data.headers['content-type']?.includes('text/html')) {
        event.data.body = fixAccessibility(event.data.body);
      }
    });
  `
});
```

## Navigation Control

### Scenario: Fixing SAP's Navigation
SAP's navigation is outdated and breaks the back button:

```javascript
const modulant = new Modulant({
  routes: [
    // Intercept their navigation
    { 
      match: { 
        hostname: 'sap.company.com',
        path: '/*'
      },
      proxy: { 
        target: 'https://sap.company.com',
        // Add our navigation fixes
        modifyResponse: (response) => {
          // Fix their broken links
          response.body = response.body.replace(
            /href="javascript:navigate\('(.+?)'\)"/g,
            'href="$1"'
          );
          return response;
        }
      }
    }
  ],
  injectScript: `
    // Fix their history handling
    let lastUrl = location.href;
    window.addEventListener('popstate', () => {
      if (location.href !== lastUrl) {
        // They don't handle back button, so we do
        window.dispatchEvent(new CustomEvent('url-changed', {
          detail: { from: lastUrl, to: location.href }
        }));
        lastUrl = location.href;
      }
    });
  `
});
```

## Debugging

When things go wrong (and they will), ModulantJS has your back:

```javascript
// In your test files
describe('Vendor Platform Tests', () => {
  beforeEach(() => {
    process.env.DEBUG = 'modulant:*';
  });

  it('handles their broken API', async () => {
    // Your tests here
  });
});

// In the browser
if (localStorage.getItem('debug_vendor_platform')) {
  localStorage.setItem('DEBUG_MODULANT', 'true');
  
  // Watch for their errors
  window.addEventListener('message', (event) => {
    if (event.data.type === 'modulant:error') {
      console.error('ModulantJS Error:', event.data.error);
    }
  });
}
```

## Advanced Examples

### Real-World Scenario: ServiceNow Integration

You need to:
- Route specific requests to your enhanced implementations
- Fix their parameter handling
- Add missing validation
- Track everything without their analytics

```javascript
const modulant = new Modulant({
  primaryServerURL: 'https://company.service-now.com',
  secondaryServerURL: 'https://your-enhanced-api.com',

  routes: [
    // Enhance their ticket creation
    { 
      match: { 
        hostname: 'company.service-now.com',
        path: '/api/now/table/incident'
      },
      proxy: { 
        target: 'https://your-enhanced-api.com/incidents'
      }
    }
  ],

  parameterConfig: {
    // Fix their parameter handling
    transformHooks: {
      'sysparm_query': (value) => {
        // They don't handle complex queries well
        const query = JSON.parse(value);
        return buildServiceNowQuery(query); // Your better query builder
      }
    },

    // Add missing validation
    parameterRules: {
      'impact': { pattern: '^[1-3]$' }, // They accept invalid impact levels
      'urgency': { pattern: '^[1-3]$' }
    },

    // Add required params they forget
    defaultValues: {
      'sysparm_display_value': 'true',
      'sysparm_exclude_reference_link': 'true'
    },

    // Remove their verbose tracking
    filterPatterns: [
      'sysparm_.*_stats',
      'sysparm_analytics'
    ]
  },

  injectScript: `
    // Track actual useful metrics
    window.addEventListener('message', (event) => {
      if (event.data.type === 'proxy' && 
          event.data.url.includes('/incident')) {
        yourAnalytics.track('incident_creation', {
          type: JSON.parse(event.data.body).type,
          priority: JSON.parse(event.data.body).priority,
          timestamp: Date.now()
        });
      }
    });
  `
});
```

## Contributing

We love contributions! Check out our [Contributing Guide](CONTRIBUTING.md) to get started.

## Troubleshooting

Common issues when working with vendor platforms:

1. **Their API is acting weird**
   - Enable debug logging: `localStorage.setItem('DEBUG_MODULANT', 'true')`
   - Check the network tab for their actual requests
   - Verify your route patterns match their URLs

2. **Their parameters aren't working**
   - Log their raw parameters: `DEBUG=modulant:server`
   - Check their API docs (if they exist)
   - Try their API directly to verify behavior

3. **Their site breaks with your changes**
   - Check their CSP headers
   - Look for inline scripts you might be breaking
   - Verify their event handlers still work

4. **Can't reproduce their issues**
   - Use ModulantJS's logging: `DEBUG=modulant:*`
   - Check different browsers (they might have browser-specific code)
   - Try with and without your modifications

## API Reference

For detailed API documentation, check out our [API Reference](API.md).

Happy extending! 🎉
