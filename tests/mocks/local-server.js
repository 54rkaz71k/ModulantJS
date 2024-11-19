const express = require('express');
const cors = require('cors');
const net = require('net');

function findAvailablePort(startPort = 3000) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(startPort, () => {
      const port = server.address().port;
      server.close(() => {
        resolve(port);
      });
    });
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        findAvailablePort(startPort + 1)
          .then(resolve)
          .catch(reject);
      } else {
        reject(err);
      }
    });
  });
}

async function createLocalServer(app) {
  const port = await findAvailablePort();
  
  // Use provided app or create new one
  app = app || express();
  
  // Add CORS middleware
  app.use(cors());
  
  // Mock endpoints to demonstrate routing
  app.get('/api/test', (req, res) => {
    // Add small delay to ensure concurrent requests
    setTimeout(() => {
      res.json({
        source: 'local-server',
        message: 'Test response'
      });
    }, 50);
  });

  app.get('/api/products', (req, res) => {
    res.json({
      source: 'local-server',
      products: [
        { id: 'local-1', name: 'Local Product 1', price: 19.99 },
        { id: 'local-2', name: 'Local Product 2', price: 29.99 }
      ]
    });
  });

  // Add delay endpoint for testing timeouts
  app.get('/timeout/test', (req, res) => {
    // Never send response to simulate timeout
  });

  // Add error endpoint
  app.get('/error/test', (req, res) => {
    res.status(500).json({ error: 'Test error' });
  });

  // Add modified endpoint
  app.get('/modified/test', (req, res) => {
    // Add delay to ensure concurrent requests
    setTimeout(() => {
      res.json({ message: 'Modified response' });
    }, 100);
  });

  // Add dynamic endpoint
  app.get('/dynamic/test', (req, res) => {
    // Add longer delay to ensure concurrent requests
    setTimeout(() => {
      res.json({ message: 'Dynamic response' });
    }, 150);
  });

  const server = app.listen(port, () => {
    console.log(`Local mock server running on http://localhost:${port}`);
  });

  return { server, port, app };
}

module.exports = { createLocalServer };
