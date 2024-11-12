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

async function createLocalServer() {
  const port = await findAvailablePort();
  const app = express();
  
  app.use(cors());
  
  // Mock endpoints to demonstrate routing
  app.get('/api/products', (req, res) => {
    res.json({
      source: 'local-server',
      products: [
        { id: 'local-1', name: 'Local Product 1', price: 19.99 },
        { id: 'local-2', name: 'Local Product 2', price: 29.99 }
      ]
    });
  });

  const server = app.listen(port, () => {
    console.log(`Local mock server running on http://localhost:${port}`);
  });

  return { server, port };
}

module.exports = { createLocalServer };
