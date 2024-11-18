# Modulant JS
<p align="center"><img height="320px" src="https://repository-images.githubusercontent.com/889695914/18d32efa-91ef-4481-943e-5f1c709068bf"></img></p>

## Overview
Modulant is a distributed client-side proxy tool designed to intercept and route web requests dynamically.

## Distributed Client-Side Proxy Tool

Modulant.js is a powerful JavaScript library that provides a distributed proxy mechanism for intercepting and routing web navigation and AJAX requests through a hidden iframe.

### Features

- 🔗 Link Interception: Capture and proxy all `<a>` tag navigations
- 🌐 AJAX Request Routing: Intercept and route fetch/AJAX requests
- 🛡️ Secure Communication: Uses `postMessage` for inter-frame communication
- 🔀 Dynamic Routing: Configure primary and secondary server routing
- 📦 Lightweight and Easy to Use

## Project Structure
```
modulant/
│
├── src/
│   └── modulant.js            # Core Modulant library
│
├── config/
│   ├── global-setup.js        # Test setup configuration
│   ├── global-teardown.js     # Test cleanup configuration
│   └── playwright.config.js   # Playwright test configuration
│
├── tests/
│   ├── modulant.spec.js       # Unit tests
│   ├── playwright/
│   │   └── modulant.playwright.spec.js  # Integration tests
│   └── mocks/
│       ├── test-server.js     # Mock server for testing
│       └── test-page.html     # Test page for integration tests
│
└── example_routing/
    ├── checkout-routing.js    # Example checkout flow routing
    └── modulant-routing.js    # Example general routing
```

## Installation
```bash
# Clone the repository
git clone https://github.com/54rkaz71k/ModulantJS.git

# Install dependencies
npm install
```

## Usage

### Basic Initialization

```javascript
const modulant = Modulant.init({
    primaryServerURL: 'https://primary-server.com',
    secondaryServerURL: 'https://secondary-server.com',
    routes: [
        { pattern: '/api', target: 'secondary' }
    ],
    defaultHeaders: {
        'X-Modulant-Proxy': 'true'
    }
});
```

### Configuration Options

- `primaryServerURL`: Default server for most requests
- `secondaryServerURL`: Alternate server for specific routes
- `routes`: Array of routing rules to determine request destinations
- `defaultHeaders`: Headers to be added to all requests
- `injectScript`: Custom script to inject into dynamically loaded content

## Testing

The project uses a comprehensive testing approach with both unit tests and integration tests:

### Available Test Scripts
- `npm test`: Run unit tests
- `npm run test:playwright`: Run integration tests (minimal output)
- `npm run test:playwright:console`: Run integration tests with detailed logs
- `npm run test:playwright:debug`: Run integration tests in debug mode
- `npm run test:all`: Run all tests (unit and integration)

### Debug Logging

The project uses the `debug` module for detailed logging during testing:

- Server logs: Enable with `DEBUG=modulant:server`
- Test logs: Enable with `DEBUG=modulant:test`
- All logs: Enable with `DEBUG=modulant:*`

Example:
```bash
# Run tests with all debug logs
DEBUG=modulant:* npm run test:playwright

# Run tests with only server logs
DEBUG=modulant:server npm run test:playwright
```

### Query Parameter Handling

The test server supports various URL parameter formats:

- Array parameters: `?array[]=1&array[]=2` becomes `{ array: ['1', '2'] }`
- Nested parameters: `?nested[key]=value` becomes `{ nested: { key: 'value' } }`
- Single values in array parameters are automatically converted to arrays for consistent handling

### Test Infrastructure

#### Unit Tests
- Located in `tests/modulant.spec.js`
- Uses Mocha and Chai for assertions
- Tests core functionality in isolation

#### Integration Tests
- Located in `tests/playwright/`
- Uses Playwright for browser automation
- Tests end-to-end functionality
- Includes custom script injection tests
- Verifies routing and interception

### Running Tests

```bash
# Run all tests
npm run test:all

# Run unit tests only
npm test

# Run integration tests
npm run test:playwright

# Run integration tests with detailed logs
npm run test:playwright:console

# Run integration tests in debug mode
npm run test:playwright:debug
```

## How It Works

1. Creates a hidden iframe for proxying requests
2. Intercepts all link clicks and AJAX requests
3. Routes requests through the iframe based on configuration
4. Dynamically injects content and maintains request interception

## Security

- Uses `sandbox` attributes to restrict iframe capabilities
- Validates `postMessage` origins
- Provides flexible routing and header configuration

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

Distributed under the MIT License.

## Contact

GitHub: [@54rkaz71k](https://github.com/54rkaz71k)

Project Link: [https://github.com/54rkaz71k/ModulantJS](https://github.com/54rkaz71k/ModulantJS)
