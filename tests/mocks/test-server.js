const express = require('express');
const path = require('path');
const net = require('net');
const debug = require('debug')('modulant:server');

// Create separate apps for primary and secondary servers
const primaryApp = express();
const secondaryApp = express();

// Enable CORS and parameter parsing for both servers
const corsMiddleware = (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Methods', '*');
  next();
};

// Add request logging middleware
const requestLogger = (req, res, next) => {
  debug('Request URL:', req.url);
  debug('Raw query:', req._parsedUrl.query);
  debug('Parsed query:', req.query);
  next();
};

// Add performance tracking middleware
const performanceMiddleware = (req, res, next) => {
  const start = Date.now();
  const originalEnd = res.end;
    
  res.end = function() {
    const duration = Date.now() - start;
    debug('Request duration:', duration + 'ms');
    if (!res.headersSent) {
      res.set('X-Response-Time', duration + 'ms');
    }
    originalEnd.apply(res, arguments);
  };
  next();
};

primaryApp.use(corsMiddleware);
secondaryApp.use(corsMiddleware);

// Configure express query parser
primaryApp.use(express.urlencoded({ extended: true }));
secondaryApp.use(express.urlencoded({ extended: true }));

// Add query parser middleware
primaryApp.use(express.query({}));
secondaryApp.use(express.query({}));

// Add request logging and performance tracking in debug mode
primaryApp.use(requestLogger);
primaryApp.use(performanceMiddleware);
secondaryApp.use(requestLogger);
secondaryApp.use(performanceMiddleware);

// Add health check endpoint for both servers
primaryApp.get('/', (req, res) => {
  res.json({ status: 'ok', server: 'primary' });
});

secondaryApp.get('/', (req, res) => {
  res.json({ status: 'ok', server: 'secondary' });
});

// Serve static files from project root for primary server
primaryApp.use(express.static(path.join(__dirname, '../../'), {
  setHeaders: (res, filepath) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (filepath.endsWith('.js')) {
      res.set('Content-Type', 'application/javascript');
    }
  }
}));

// Primary server routes
primaryApp.get('/non-api/test', (req, res) => {
  debug('Primary server: Received request for /non-api/test');
  res.send('Non-API route response');
});

// Secondary server routes with parameter handling
secondaryApp.get('/api/test', (req, res) => {
  debug('Secondary server: Received request for /api/test');
  debug('Full URL:', req.url);
  debug('Raw query string:', req._parsedUrl.query);
  debug('Query parameters:', JSON.stringify(req.query, null, 2));

  // Handle array parameters
  const parameters = {};
  for (const [key, value] of Object.entries(req.query)) {
    if (key.endsWith('[]')) {
      // Ensure array values are always arrays
      parameters[key] = Array.isArray(value) ? value : [value];
      debug(`Processing array parameter ${key}:`, parameters[key]);
    } else {
      parameters[key] = value;
    }
  }

  // Return parameters in response for verification
  res.json({
    message: 'API route response',
    parameters
  });
});

// Test routes for response modification
secondaryApp.get('/modified/test', (req, res) => {
  debug('Secondary server: Received request for /modified/test');
  res.set('X-Original-Response', 'true');
  res.json({
    message: 'Original response',
    timestamp: Date.now()
  });
});

// Test routes for error handling
secondaryApp.get('/error/test', (req, res) => {
  debug('Secondary server: Simulating error for /error/test');
  res.status(500).json({
    error: 'Simulated server error',
    code: 'TEST_ERROR'
  });
});

secondaryApp.get('/timeout/test', (_req, _res) => {
  debug('Secondary server: Simulating timeout for /timeout/test');
  // Don't send response - let it timeout
});

secondaryApp.get('/dynamic/test', (req, res) => {
  debug('Secondary server: Received request for /dynamic/test');
  debug('Query parameters:', JSON.stringify(req.query, null, 2));
  res.json({
    message: 'API route response',
    parameters: req.query
  });
});

// Log all requests in debug mode
primaryApp.use((req, res, next) => {
  debug('Primary server:', req.method, req.url);
  next();
});

secondaryApp.use((req, res, next) => {
  debug('Secondary server:', req.method, req.url);
  next();
});

// Catch-all route for primary server
primaryApp.get('*', (req, res) => {
  if (req.path.endsWith('.js')) {
    const jsPath = path.join(__dirname, '../../', req.path);
    debug('Primary server: Serving JavaScript file:', jsPath);
    res.set('Content-Type', 'application/javascript');
    res.sendFile(jsPath);
  } else {
    debug(`Primary server: Serving test-page.html for path: ${req.path}`);
    res.sendFile(path.join(__dirname, 'test-page.html'));
  }
});

// Get port from command line arguments
const port = process.argv[2];

if (!port) {
  console.error('Port number is required. Usage: node test-server.js <port>');
  process.exit(1);
}

// Function to check if port is in use
function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer()
      .once('error', () => resolve(true))
      .once('listening', () => {
        server.close();
        resolve(false);
      })
      .listen(port);
  });
}

// Function to wait for port to be available
async function waitForPort(port, maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    const inUse = await isPortInUse(port);
    if (!inUse) return true;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  return false;
}

// Function to start server
const startServer = async (app, port, name) => {
  // Wait for port to be available
  const portAvailable = await waitForPort(port);
  if (!portAvailable) {
    console.error(`${name} server: Port ${port} is still in use after max attempts`);
    process.exit(1);
  }

  const server = app.listen(port, () => {
    console.log(`${name} server running on http://localhost:${port}`);
  });

  server.on('error', (err) => {
    console.error(`${name} server error:`, err);
    process.exit(1);
  });

  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    console.log(`${name} server: Server shutting down...`);
    server.close(() => {
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log(`${name} server: Server shutting down...`);
    server.close(() => {
      process.exit(0);
    });
  });

  return server;
};

// Start the appropriate server based on the port
if (port === '3000') {
  console.log('Starting primary server...');
  startServer(primaryApp, 3000, 'Primary');
} else if (port === '4000') {
  console.log('Starting secondary server...');
  startServer(secondaryApp, 4000, 'Secondary');
} else {
  console.error('Invalid port. Must be 3000 or 4000');
  process.exit(1);
}
