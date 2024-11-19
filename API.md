# 📘 ModulantJS API Reference

Welcome to the ModulantJS API reference! This document provides detailed information about every feature ModulantJS offers. Each section includes practical examples and best practices.

## 📋 Table of Contents
- [Core API](#core-api)
  - [Constructor](#constructor)
  - [Static Methods](#static-methods)
- [Configuration](#configuration)
  - [Parameter Handling](#parameter-handling)
  - [Request Routing](#request-routing)
  - [Headers](#headers)
  - [Script Injection](#script-injection)
- [Methods](#methods)
- [Events](#events)
- [Types](#types)
- [Error Handling](#error-handling)
- [Debugging](#debugging)

## Core API

### Constructor

#### `new Modulant(config)`
Creates a new ModulantJS instance with the specified configuration.

**Parameters:**
- `config`: [ModulantConfig](#modulantconfig) - Configuration object

**Returns:** Modulant instance

**Example:**
```javascript
// Basic setup
const modulant = new Modulant({
  primaryServerURL: 'https://vendor-platform.com',
  secondaryServerURL: 'https://your-api.com'
});

// Advanced setup with all options
const modulant = new Modulant({
  primaryServerURL: 'https://vendor-platform.com',
  secondaryServerURL: 'https://your-api.com',
  routes: [{
    match: { hostname: 'vendor-platform.com', path: '/api/*' },
    proxy: { target: 'https://your-api.com' }
  }],
  defaultHeaders: {
    'X-Custom-Header': 'value'
  },
  parameterConfig: {
    transformHooks: {
      'category': (value) => value.toUpperCase()
    }
  },
  injectScript: 'console.log("Injected!")'
});
```

**Best Practices:**
- Always provide both server URLs
- Use HTTPS URLs in production
- Keep injected scripts minimal
- Consider using `Modulant.init()` for async initialization

### Static Methods

#### `Modulant.init(config)`
Asynchronously creates and initializes a ModulantJS instance. Preferred over the constructor for most use cases.

**Parameters:**
- `config`: [ModulantConfig](#modulantconfig) - Same as constructor

**Returns:** Promise<Modulant>

**Example:**
```javascript
// Async initialization with error handling
try {
  const modulant = await Modulant.init({
    primaryServerURL: 'https://vendor-platform.com',
    secondaryServerURL: 'https://your-api.com',
    routes: [
      { 
        match: { hostname: 'vendor-platform.com', path: '/api/*' },
        proxy: { target: 'https://your-api.com' }
      }
    ]
  });
  console.log('ModulantJS initialized!');
} catch (error) {
  console.error('Initialization failed:', error);
}
```

## Configuration

### Parameter Handling

The `parameterConfig` object controls how URL parameters are processed.

#### `transformHooks`
Transform parameter values before they're sent.

**Type:**
```typescript
{
  [paramName: string]: (value: string) => string;
}
```

**Example:**
```javascript
const config = {
  parameterConfig: {
    transformHooks: {
      // Convert category to uppercase
      'category': (value) => value.toUpperCase(),
      
      // Base64 encode sensitive data
      'userData': (value) => btoa(value),
      
      // Format dates consistently
      'date': (value) => new Date(value).toISOString(),
      
      // Transform complex data
      'filters': (value) => {
        const filters = JSON.parse(value);
        // Convert their format to yours
        const transformed = transformFilters(filters);
        return JSON.stringify(transformed);
      }
    }
  }
};
```

**Best Practices:**
- Keep transforms pure and fast
- Handle invalid input gracefully
- Document transformations for team reference
- Use TypeScript for better type safety

#### `parameterRules`
Validate parameters before sending.

**Type:**
```typescript
{
  [paramName: string]: {
    required?: boolean;
    pattern?: string;
    validate?: (value: string) => boolean;
  };
}
```

**Example:**
```javascript
const config = {
  parameterConfig: {
    parameterRules: {
      // Required field
      'userId': { 
        required: true,
        pattern: '^[0-9]{6,}$'
      },
      
      // Complex validation
      'email': { 
        required: true,
        validate: (value) => {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          return emailRegex.test(value) && value.length < 255;
        }
      },
      
      // Multiple rules
      'age': {
        pattern: '^[0-9]{1,3}$',
        validate: (value) => {
          const age = parseInt(value);
          return age >= 13 && age <= 120;
        }
      }
    }
  }
};
```

**Tips:**
- Combine patterns and custom validation for complex rules
- Use descriptive validation function names
- Consider adding custom error messages
- Test edge cases thoroughly

#### `defaultValues`
Default values for missing parameters.

**Type:**
```typescript
{
  [paramName: string]: string;
}
```

**Example:**
```javascript
const config = {
  parameterConfig: {
    defaultValues: {
      // Pagination defaults
      'page': '1',
      'limit': '20',
      
      // Business logic defaults
      'currency': 'USD',
      'language': 'en-US',
      
      // Feature flags
      'version': 'v2',
      'beta': 'false'
    }
  }
};
```

**When to use:**
- Pagination parameters
- Default sorting
- Language/locale settings
- Feature flags
- API versions

#### `filterPatterns`
Regex patterns for parameters to remove.

**Type:** `string[]`

**Example:**
```javascript
const config = {
  parameterConfig: {
    filterPatterns: [
      // Analytics params
      '^utm_',
      'fbclid',
      '_ga',
      
      // Internal params
      '_internal_.*',
      '__debug.*',
      
      // Session/auth params
      'token$',
      'session_.*'
    ]
  }
};
```

**Common uses:**
- Remove analytics parameters
- Filter out debug parameters
- Clean up tracking pixels
- Remove sensitive data

### Request Routing

#### `Route`
Configuration for routing requests.

**Type:**
```typescript
interface Route {
  match: {
    hostname: string;  // Domain to match
    path: string;      // Path pattern (glob supported)
  };
  proxy: {
    target: string;    // Destination URL
    modifyResponse?: (response: Response) => Response | Promise<Response>;
  };
}
```

**Example:**
```javascript
const routes = [
  // Basic API routing
  { 
    match: { 
      hostname: 'vendor-platform.com',
      path: '/api/v1/*'
    },
    proxy: { 
      target: 'https://your-api.com'
    }
  },
  
  // Route with response modification
  {
    match: {
      hostname: 'vendor-platform.com',
      path: '/products/*'
    },
    proxy: {
      target: 'https://your-product-api.com',
      modifyResponse: async (response) => {
        const data = await response.json();
        // Enhance product data
        data.products = await enrichProducts(data.products);
        return new Response(JSON.stringify(data), response);
      }
    }
  },
  
  // A/B testing route
  {
    match: {
      hostname: 'vendor-platform.com',
      path: '/search/*'
    },
    proxy: {
      target: Math.random() < 0.5 
        ? 'https://old-search.com'
        : 'https://new-search.com'
    }
  }
];
```

**Best Practices:**
- Order routes from most to least specific
- Use precise hostname matching
- Keep response modifications light
- Handle errors in modifyResponse
- Document route purposes

### Headers

#### `defaultHeaders`
Headers to add to all proxied requests.

**Type:**
```typescript
{
  [headerName: string]: string;
}
```

**Example:**
```javascript
const config = {
  defaultHeaders: {
    // Authentication
    'X-API-Key': 'your-api-key',
    'Authorization': 'Bearer token',
    
    // Tracking
    'X-Request-ID': generateRequestId(),
    'X-Client-Version': '2.0.0',
    
    // Customization
    'Accept-Language': 'en-US',
    'X-Custom-Header': 'value'
  }
};
```

**Common Headers:**
- Authentication tokens
- API keys
- Request IDs
- Client versions
- Custom flags

### Script Injection

#### `injectScript`
JavaScript to inject into the proxy frame.

**Type:** `string`

**Example:**
```javascript
const config = {
  injectScript: `
    // Track all requests
    window.addEventListener('message', (event) => {
      if (event.data.type === 'proxy') {
        analytics.track('proxy_request', {
          url: event.data.url,
          timestamp: Date.now()
        });
      }
    });

    // Enhance responses
    window.addEventListener('message', (event) => {
      if (event.data.type === 'response') {
        // Add custom headers
        event.data.headers['X-Enhanced'] = 'true';
        
        // Modify JSON responses
        if (event.data.headers['content-type']?.includes('application/json')) {
          const data = JSON.parse(event.data.body);
          data.enhanced = true;
          event.data.body = JSON.stringify(data);
        }
      }
    });

    // Custom error handling
    window.onerror = (msg, url, line) => {
      window.parent.postMessage({
        type: 'modulant:error',
        error: { message: msg, url, line }
      }, '*');
    };
  `
};
```

**Best Practices:**
- Keep injected code minimal
- Handle errors gracefully
- Use TypeScript for better maintainability
- Document message formats
- Consider browser compatibility

## Methods

### Instance Methods

#### `addRoute(route)`
Adds a new route configuration.

**Parameters:**
- `route`: [Route](#route) | { pattern: string, target: string }

**Returns:** void

**Examples:**
```javascript
// Full route object
modulant.addRoute({
  match: { 
    hostname: 'vendor-platform.com',
    path: '/api/*'
  },
  proxy: {
    target: 'https://your-api.com'
  }
});

// Shorthand for secondary server
modulant.addRoute('/api/*', 'secondary');

// Dynamic routing
function addBetaRoute(user) {
  if (user.isBetaTester) {
    modulant.addRoute({
      match: {
        hostname: 'vendor-platform.com',
        path: '/beta/*'
      },
      proxy: {
        target: 'https://beta-api.com'
      }
    });
  }
}
```

#### `isActive()`
Checks if ModulantJS is initialized and active.

**Returns:** boolean

**Example:**
```javascript
function checkModulant() {
  if (!modulant.isActive()) {
    console.warn('ModulantJS not ready!');
    return false;
  }
  return true;
}
```

#### `sendTestEvent()`
Sends a test event to the proxy frame.

**Returns:** void

**Example:**
```javascript
// Test script injection
async function testInjection() {
  let received = false;
  
  window.addEventListener('message', (event) => {
    if (event.data === 'custom-event-fired') {
      received = true;
    }
  });
  
  modulant.sendTestEvent();
  
  // Wait for response
  await new Promise(resolve => setTimeout(resolve, 1000));
  return received;
}
```

## Events

ModulantJS uses the `postMessage` API for communication.

### Core Events

#### `modulant:ready`
Fired when the proxy frame is ready.

```javascript
window.addEventListener('message', (event) => {
  if (event.data === 'modulant:ready') {
    console.log('ModulantJS ready!');
  }
});
```

#### `proxy`
Fired when a request is being proxied.

```javascript
window.addEventListener('message', (event) => {
  if (event.data.type === 'proxy') {
    const { url, init } = event.data;
    console.log('Proxying request:', url);
  }
});
```

#### `response`
Fired when a response is received.

```javascript
window.addEventListener('message', (event) => {
  if (event.data.type === 'response') {
    const { body, headers, status } = event.data;
    console.log('Received response:', status);
  }
});
```

### Debug Events

#### `modulant:debug`
Fired when debug logging is enabled.

```javascript
window.addEventListener('message', (event) => {
  if (event.data.type === 'modulant:debug') {
    const { level, message, data } = event.data;
    console.log(`[${level}] ${message}`, data);
  }
});
```

#### `modulant:error`
Fired when an error occurs.

```javascript
window.addEventListener('message', (event) => {
  if (event.data.type === 'modulant:error') {
    const { error, context } = event.data;
    console.error('ModulantJS error:', error, context);
  }
});
```

## Types

### Core Types

#### `ModulantConfig`
Complete configuration type.

```typescript
interface ModulantConfig {
  // Server URLs (required)
  primaryServerURL: string;
  secondaryServerURL: string;
  
  // Optional configurations
  routes?: Route[];
  defaultHeaders?: Record<string, string>;
  parameterConfig?: ParameterConfig;
  injectScript?: string;
}
```

#### `ParameterConfig`
Parameter handling configuration.

```typescript
interface ParameterConfig {
  transformHooks?: {
    [paramName: string]: (value: string) => string;
  };
  parameterRules?: {
    [paramName: string]: {
      required?: boolean;
      pattern?: string;
      validate?: (value: string) => boolean;
    };
  };
  defaultValues?: {
    [paramName: string]: string;
  };
  filterPatterns?: string[];
}
```

#### `Route`
Route configuration.

```typescript
interface Route {
  match: {
    hostname: string;
    path: string;
  };
  proxy: {
    target: string;
    modifyResponse?: (response: Response) => Response | Promise<Response>;
  };
}
```

### Internal Types

#### `ModulantState`
Internal state tracking.

```typescript
interface ModulantState {
  isActive: boolean;
  proxyFrame: HTMLIFrameElement | null;
  originalFunctions: Map<string, Function>;
}
```

#### `ProxyMessage`
Message format for proxy communication.

```typescript
interface ProxyMessage {
  type: 'proxy' | 'response';
  id: number;
  url?: string;
  init?: RequestInit;
  body?: string;
  status?: number;
  headers?: Record<string, string>;
  error?: string;
}
```

## Error Handling

ModulantJS provides structured error handling.

### Error Types

```typescript
class ModulantError extends Error {
  constructor(
    message: string,
    code: ErrorCode,
    context?: any
  );
}

enum ErrorCode {
  INITIALIZATION_FAILED = 'INIT_FAILED',
  INVALID_ROUTE = 'INVALID_ROUTE',
  PROXY_ERROR = 'PROXY_ERROR',
  PARAMETER_ERROR = 'PARAM_ERROR',
  SCRIPT_ERROR = 'SCRIPT_ERROR'
}
```

### Error Handling Examples

```javascript
// Initialization error handling
try {
  const modulant = await Modulant.init(config);
} catch (error) {
  if (error.code === 'INIT_FAILED') {
    console.error('ModulantJS initialization failed:', error.message);
    // Fallback initialization
    initializeFallback();
  }
}

// Route error handling
try {
  modulant.addRoute(invalidRoute);
} catch (error) {
  if (error.code === 'INVALID_ROUTE') {
    console.error('Invalid route configuration:', error.message);
    // Use default route
    modulant.addRoute(defaultRoute);
  }
}

// Parameter error handling
window.addEventListener('message', (event) => {
  if (event.data.type === 'modulant:error' && 
      event.data.error.code === 'PARAM_ERROR') {
    console.error('Parameter processing failed:', event.data.error);
    // Clean up parameters
    cleanupParameters();
  }
});
```

## Debugging

### Enabling Debug Mode

```javascript
// In Node.js/test environment
process.env.DEBUG = 'modulant:*';

// In browser
localStorage.setItem('DEBUG_MODULANT', 'true');
```

### Debug Output

Debug mode provides detailed information about:
- Request/response cycles
- Parameter transformations
- Route matching
- Script injection
- Error details

### Debug Helpers

```javascript
// Custom debug logger
function debugModulant(component, ...args) {
  if (localStorage.getItem('DEBUG_MODULANT') === 'true') {
    console.log(`[ModulantJS:${component}]`, ...args);
  }
}

// Usage
debugModulant('router', 'Matching route:', route);
debugModulant('params', 'Transforming:', value);
```

### Performance Monitoring

```javascript
// Track proxy performance
window.addEventListener('message', (event) => {
  if (event.data.type === 'proxy') {
    const start = Date.now();
    
    // Track when response comes back
    const responseHandler = (e) => {
      if (e.data.id === event.data.id) {
        const duration = Date.now() - start;
        debugModulant('performance', `Request took ${duration}ms`);
        window.removeEventListener('message', responseHandler);
      }
    };
    
    window.addEventListener('message', responseHandler);
  }
});
