const express = require('express');
const path = require('path');
const net = require('net');

// Create separate apps for primary and secondary servers
const primaryApp = express();
const secondaryApp = express();

// Enable CORS for both servers
const corsMiddleware = (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Access-Control-Allow-Methods', '*');
    next();
};

primaryApp.use(corsMiddleware);
secondaryApp.use(corsMiddleware);

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
    console.log('Primary server: Received request for /non-api/test');
    res.send('Non-API route response');
});

// Secondary server routes
secondaryApp.get('/api/test', (req, res) => {
    console.log('Secondary server: Received request for /api/test');
    res.send('API route response');
});

secondaryApp.get('/dynamic/test', (req, res) => {
    console.log('Secondary server: Received request for /dynamic/test');
    res.send('API route response');
});

// Log all requests
primaryApp.use((req, res, next) => {
    console.log('Primary server:', req.method, req.url);
    next();
});

secondaryApp.use((req, res, next) => {
    console.log('Secondary server:', req.method, req.url);
    next();
});

// Catch-all route for primary server
primaryApp.get('*', (req, res) => {
    if (req.path.endsWith('.js')) {
        const jsPath = path.join(__dirname, '../../', req.path);
        console.log('Primary server: Serving JavaScript file:', jsPath);
        res.set('Content-Type', 'application/javascript');
        res.sendFile(jsPath);
    } else {
        console.log(`Primary server: Serving test-page.html for path: ${req.path}`);
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
    startServer(primaryApp, 3000, 'Primary');
} else if (port === '4000') {
    startServer(secondaryApp, 4000, 'Secondary');
} else {
    console.error('Invalid port. Must be 3000 or 4000');
    process.exit(1);
}
