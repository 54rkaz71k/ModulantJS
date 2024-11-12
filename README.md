# ModulantJS

## Distributed Client-Side Proxy Tool

Modulant.js is a powerful JavaScript library that provides a distributed proxy mechanism for intercepting and routing web navigation and AJAX requests through a hidden iframe.

### Features

- 🔗 Link Interception: Capture and proxy all `<a>` tag navigations
- 🌐 AJAX Request Routing: Intercept and route fetch/AJAX requests
- 🛡️ Secure Communication: Uses `postMessage` for inter-frame communication
- 🔀 Dynamic Routing: Configure primary and secondary server routing
- 📦 Lightweight and Easy to Use

## Testing

This project supports two types of testing:
1. Unit/Integration Tests (using JSdom)
2. End-to-End (E2E) Tests (using ChromeDriver)

### Prerequisites

- Chrome browser installed
- Node.js and npm

### Running Tests

#### Unit/Integration Tests

### Installation
```bash
# Clone the repository
git clone https://github.com/steake/Modulant.js.git

# No additional dependencies required
```

### Usage

#### Basic Initialization

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
### Testing


```bash
npm test
```

#### E2E Tests
```bash
npm run test:e2e
```

#### Run All Tests
```bash
npm run test:all
```

### Dependencies

- JSdom (for unit/integration tests)
- Selenium WebDriver
- ChromeDriver (for E2E tests)
- Mocha
- Chai

### Test Configuration

- `modulant.spec.js`: Contains unit and integration tests using JSdom
- `modulant.e2e.spec.js`: Contains end-to-end tests using ChromeDriver


#### Configuration Options

- `primaryServerURL`: Default server for most requests
- `secondaryServerURL`: Alternate server for specific routes
- `routes`: Array of routing rules to determine request destinations
- `defaultHeaders`: Headers to be added to all requests
- `injectScript`: Custom script to inject into dynamically loaded content

### How It Works

1. Creates a hidden iframe for proxying requests
2. Intercepts all link clicks and AJAX requests
3. Routes requests through the iframe based on configuration
4. Dynamically injects content and maintains request interception

### Security

- Uses `sandbox` attributes to restrict iframe capabilities
- Validates `postMessage` origins
- Provides flexible routing and header configuration

### Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### License

Distributed under the MIT License.

### Contact

Your Name - [@steake](https://github.com/steake)

Project Link: [https://github.com/steake/Modulant.js](https://github.com/steake/Modulant.js)
