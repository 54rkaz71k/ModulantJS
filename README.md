# Modulant JS
<p align="center"><img width="60%" src="https://repository-images.githubusercontent.com/889695914/18d32efa-91ef-4481-943e-5f1c709068bf"></img></p>

## Overview
Modulant is a stealth web extension framework designed to intercept and route web requests dynamically, enabling you to enhance third-party websites without modifying their source code.

## Installation

```bash
# NPM
npm install modulant-js

# Or clone the repository
git clone https://github.com/54rkaz71k/ModulantJS.git
```

## Distributed Client-Side Proxy Tool

Modulant.js is a powerful JavaScript library that provides a distributed proxy mechanism for intercepting and routing web navigation and AJAX requests through a hidden iframe, allowing you to enhance vendor platforms without breaking their core experience.

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
└── tests/
    ├── mocks/                 # Mock servers and test pages
    │   ├── test-server.js     # Test server implementation
    │   └── test-page.html     # Test page for integration tests
    └── playwright/            # Integration tests
        ├── modulant.playwright.spec.js
        └── performance.playwright.spec.js
```

## Usage

### Basic Initialization

```javascript
// Using npm package
import Modulant from 'modulant-js';
// Or using direct include
// const { Modulant } = require('modulant-js');

const modulant = await Modulant.init({
    primaryServerURL: 'https://primary-server.com',
    secondaryServerURL: 'https://secondary-server.com',
    routes: [
        { 
          match: { 
            hostname: 'primary-server.com',
            path: '/api/*'
          },
          proxy: { target: 'secondary' }
        }
    ],
    defaultHeaders: {
        'X-Modulant-Proxy': 'true'
    }
});
```

For detailed API documentation and advanced usage, please refer to [API.md](API.md).

For a quick overview of common use cases and examples, check out [TLDR.md](TLDR.md).

For detailed technical architecture, see [architecture.md](architecture.md).

## Development

### Available Scripts
```bash
# Run all tests
npm test

# Run tests with debug mode
npm run test:debug

# Run tests with console output
npm run test:console

# Start development server
npm run dev

# Run linting
npm run lint
```

### Debug Logging

Enable debug logging in Node.js:
```javascript
process.env.DEBUG_MODULANT = 'true';
```

Enable debug logging in browser:
```javascript
localStorage.setItem('DEBUG_MODULANT', 'true');
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

Fuck your Licence (Im Rick James, bitch...)

## Contact

GitHub: [@54rkaz71k](https://github.com/54rkaz71k)

Project Link: [https://github.com/54rkaz71k/ModulantJS](https://github.com/54rkaz71k/ModulantJS)
